from dataclasses import dataclass, field
import os
from pathlib import Path

ENVIRONMENTS = ('development', 'staging', 'production')


def database_url(value):
    """Accept hosting providers' plain PostgreSQL URLs and use the psycopg driver."""
    for prefix in ('postgres://', 'postgresql://'):
        if value.startswith(prefix):
            return 'postgresql+psycopg://' + value.removeprefix(prefix)
    return value


@dataclass(frozen=True)
class Settings:
    environment: str = 'development'
    database_url: str = field(default_factory=lambda: f"sqlite+aiosqlite:///{Path(__file__).resolve().parents[1] / 'data' / 'learning.db'}")
    auth_mode: str = 'guest'
    allowed_origins: tuple[str, ...] = ('http://localhost:5173', 'http://127.0.0.1:5173')
    session_days: int = 7
    cookie_name: str = 'traders_edge_session'
    firebase_project_id: str | None = None
    firebase_credentials: str | None = field(default=None, repr=False)
    auto_migrate: bool = True
    research_enabled: bool = False
    research_policy_version: str | None = None
    research_policy_text: str | None = None

    @classmethod
    def from_env(cls):
        default = cls()
        environment = os.getenv('APP_ENV', default.environment)
        production = environment == 'production'
        return cls(
            environment=environment,
            database_url=database_url(os.getenv('DATABASE_URL', default.database_url)),
            auth_mode=os.getenv('AUTH_MODE', 'firebase' if production else 'guest'),
            allowed_origins=tuple(x.strip() for x in os.getenv('ALLOWED_ORIGINS', ','.join(default.allowed_origins)).split(',') if x.strip()),
            firebase_project_id=os.getenv('FIREBASE_PROJECT_ID'),
            firebase_credentials=os.getenv('FIREBASE_SERVICE_ACCOUNT') or None,
            auto_migrate=os.getenv('AUTO_MIGRATE', 'true' if environment == 'development' else 'false').lower() == 'true',
            research_enabled=os.getenv('RESEARCH_ENABLED', 'false').lower() == 'true',
            research_policy_version=os.getenv('RESEARCH_POLICY_VERSION'),
            research_policy_text=os.getenv('RESEARCH_POLICY_TEXT'),
        )

    @property
    def hosted(self):
        """Staging and production run behind HTTPS on a shared PostgreSQL database."""
        return self.environment != 'development'

    def validate(self):
        if self.environment not in ENVIRONMENTS:
            raise ValueError('APP_ENV must be development, staging or production')
        if self.research_enabled and (not isinstance(self.research_policy_version, str) or not self.research_policy_version.strip()
                or self.research_policy_version != self.research_policy_version.strip()
                or len(self.research_policy_version) > 80 or not isinstance(self.research_policy_text, str) or not self.research_policy_text.strip()):
            raise ValueError('Enabled study enrollment requires an unpadded policy version (1–80 characters) and nonblank consent text')
        if self.auth_mode not in {'guest', 'firebase'}:
            raise ValueError('AUTH_MODE must be guest or firebase')
        if self.auth_mode == 'firebase' and not self.firebase_project_id:
            raise ValueError('FIREBASE_PROJECT_ID is required for Firebase authentication')
        if self.environment == 'production' and self.auth_mode != 'firebase':
            raise ValueError('Production requires verified Firebase and PostgreSQL')
        if self.hosted:
            label = self.environment.capitalize()
            if not self.database_url.startswith('postgresql+psycopg://'):
                raise ValueError(f'{label} requires PostgreSQL')
            if not self.allowed_origins or any(not x.startswith('https://') for x in self.allowed_origins):
                raise ValueError(f'{label} requires explicit HTTPS browser origins')
