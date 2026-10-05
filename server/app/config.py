from dataclasses import dataclass, field
import os
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    environment: str = 'development'
    database_url: str = field(default_factory=lambda: f"sqlite+aiosqlite:///{Path(__file__).resolve().parents[1] / 'data' / 'learning.db'}")
    auth_mode: str = 'guest'
    allowed_origins: tuple[str, ...] = ('http://localhost:5173', 'http://127.0.0.1:5173')
    session_days: int = 7
    cookie_name: str = 'traders_edge_session'
    firebase_project_id: str | None = None
    auto_migrate: bool = True

    @classmethod
    def from_env(cls):
        default = cls()
        production = os.getenv('APP_ENV', 'development') == 'production'
        return cls(
            environment=os.getenv('APP_ENV', default.environment),
            database_url=os.getenv('DATABASE_URL', default.database_url),
            auth_mode=os.getenv('AUTH_MODE', 'firebase' if production else 'guest'),
            allowed_origins=tuple(x.strip() for x in os.getenv('ALLOWED_ORIGINS', ','.join(default.allowed_origins)).split(',') if x.strip()),
            firebase_project_id=os.getenv('FIREBASE_PROJECT_ID'),
            auto_migrate=os.getenv('AUTO_MIGRATE', 'false' if production else 'true').lower() == 'true',
        )

    def validate(self):
        if self.auth_mode not in {'guest', 'firebase'}:
            raise ValueError('AUTH_MODE must be guest or firebase')
        if self.auth_mode == 'firebase' and not self.firebase_project_id:
            raise ValueError('FIREBASE_PROJECT_ID is required for Firebase authentication')
        if self.environment == 'production':
            if self.auth_mode != 'firebase' or not self.database_url.startswith('postgresql+psycopg://'):
                raise ValueError('Production requires verified Firebase and PostgreSQL')
            if not self.allowed_origins or any(not x.startswith('https://') for x in self.allowed_origins):
                raise ValueError('Production requires explicit HTTPS browser origins')
