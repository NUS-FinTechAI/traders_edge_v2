"""Service logging: one readable line per request, safe for a hosted log viewer.

Nothing private is logged. A request line has the method, the matched route
template (never the raw path, which can hold ids), the status, the duration
and a request id. Query strings, headers, cookies, bodies and client addresses
never reach a log line; errors with stack traces are Sentry's job
(`app/monitoring.py`).
"""
import logging
import re
import time
import uuid

LOG_FORMAT = '%(asctime)s %(levelname)s %(name)s %(message)s'
REQUEST_ID_HEADER = 'x-request-id'
VALID_REQUEST_ID = re.compile(r'[A-Za-z0-9._-]{1,64}')
QUIET_PATHS = {'/health'}

log = logging.getLogger('app.request')


def valid_log_level(value):
    return isinstance(value, str) and value in logging.getLevelNamesMapping()


def configure_logging(level):
    """Send application logs to stderr once; silence uvicorn's access log, which prints query strings and client addresses."""
    root = logging.getLogger()
    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(LOG_FORMAT))
        root.addHandler(handler)
    root.setLevel(level)
    for noisy in ('httpx', 'httpcore'):  # outbound client libraries log full URLs at INFO
        logging.getLogger(noisy).setLevel(max(root.level, logging.WARNING))
    access = logging.getLogger('uvicorn.access')
    access.handlers.clear()
    access.propagate = False
    access.disabled = True


def request_id_from(headers):
    """The caller's X-Request-ID when it is short and plain, otherwise a new one."""
    for name, value in headers:
        if name == REQUEST_ID_HEADER.encode():
            candidate = value.decode('latin-1')
            if VALID_REQUEST_ID.fullmatch(candidate):
                return candidate
    return uuid.uuid4().hex


def log_level_for(path, status):
    if status >= 500:
        return logging.ERROR
    if path in QUIET_PATHS:
        return logging.DEBUG
    return logging.WARNING if status >= 400 else logging.INFO


class RequestLogMiddleware:
    """Pure ASGI middleware: logs every HTTP request and returns its X-Request-ID."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return
        request_id = request_id_from(scope['headers'])
        started = time.perf_counter()
        status = 500

        async def send_with_id(message):
            nonlocal status
            if message['type'] == 'http.response.start':
                status = message['status']
                message.setdefault('headers', []).append((b'x-request-id', request_id.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            route = scope.get('route')
            path = getattr(route, 'path', None) or ('/health' if scope['path'] in QUIET_PATHS else '<unmatched>')
            log.log(log_level_for(path, status), '%s %s %d %.1fms rid=%s', scope['method'], path, status,
                    (time.perf_counter() - started) * 1000, request_id)
