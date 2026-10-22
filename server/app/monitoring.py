"""Optional Sentry error reporting: off unless SENTRY_DSN is set."""
from starlette.exceptions import HTTPException

PRIVATE_HEADERS = {'authorization', 'cookie', 'set-cookie', 'x-forwarded-for', 'x-real-ip'}
QUERY_KEYS = ('http.query', 'http.fragment')


def without_query(url):
    return url.split('?', 1)[0].split('#', 1)[0] if isinstance(url, str) else url


def scrub_event(event, hint):
    """Drop expected 4xx responses and strip identity, bodies and query strings."""
    error = (hint or {}).get('exc_info', (None, None, None))[1]
    if isinstance(error, HTTPException) and error.status_code < 500:
        return None
    request = event.get('request')
    if request:
        for key in ('cookies', 'data', 'query_string', 'env'):
            request.pop(key, None)
        if 'url' in request:
            request['url'] = without_query(request['url'])
        if isinstance(request.get('headers'), dict):
            request['headers'] = {k: v for k, v in request['headers'].items() if k.lower() not in PRIVATE_HEADERS}
    crumbs = event.get('breadcrumbs')
    for crumb in crumbs.get('values', []) if isinstance(crumbs, dict) else crumbs or []:
        data = crumb.get('data')
        if isinstance(data, dict):
            for key in QUERY_KEYS:
                data.pop(key, None)
            if 'url' in data:
                data['url'] = without_query(data['url'])
    for span in event.get('spans') or []:
        data = span.get('data')
        if isinstance(data, dict):
            for key in QUERY_KEYS:
                data.pop(key, None)
    return event


def start_monitoring(settings):
    if not settings.sentry_dsn:
        return
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        release=settings.release,
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size='never',
        traces_sample_rate=0.1,
        before_send=scrub_event,
        before_send_transaction=scrub_event,
    )
