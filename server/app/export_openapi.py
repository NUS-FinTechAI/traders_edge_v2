"""Export the route contract without starting the application lifespan."""

import json
import os


def export_schema():
    # main creates an app at import time. Isolate that configuration from the
    # deployment environment; schema generation never starts either app.
    overrides = {
        'APP_ENV': 'development',
        'AUTH_MODE': 'guest',
        'DATABASE_URL': 'sqlite+aiosqlite:///:memory:',
        'AUTO_MIGRATE': 'false',
        'ALLOWED_ORIGINS': 'http://localhost:5173',
        'FIREBASE_PROJECT_ID': '',
        'INSTRUCTOR_FIREBASE_UIDS': '',
        'INSTRUCTOR_PROFILE_IDS': '',
        'RESEARCH_ENABLED': 'false',
        'RESEARCH_POLICY_VERSION': '',
        'RESEARCH_POLICY_TEXT': '',
    }
    previous = {key: os.environ.get(key) for key in overrides}
    try:
        os.environ.update(overrides)
        from app.config import Settings
        from app.main import create_app

        return create_app(Settings.from_env()).openapi()
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


if __name__ == '__main__':
    print(json.dumps(export_schema(), sort_keys=True, indent=2))
