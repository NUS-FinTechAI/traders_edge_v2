# Architecture

The client is React/TypeScript with Vite. FastAPI owns authentication, grading, progression and persistence; the browser must not award XP or decide mastery. The current API uses SQLAlchemy with SQLite for local development and a PostgreSQL adapter for production configuration. No request needs a live market-data download.

## Boundaries

| Area           | Source                                      | Responsibility                                                                                       |
| -------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Client         | `client/src/`                               | Presentation, accessible interaction and API requests                                                |
| Authentication | `server/app/auth.py`, `config.py`           | Local guest cookies or verified Firebase bearer identity; owner checks                               |
| Learning       | `learning.py`, `progression.py`             | Public lesson views, private grading, sequential gates, reviews, journal and learning XP             |
| Content        | `server/app/content/`                       | Versioned private catalog, sources, glossary and validator                                           |
| Storage        | `db.py`, `migrations.py`, `migration_v*.py` | Transactions, constraints and ordered migrations                                                     |
| Simulation     | `server/app/simulation/engine.py`, `api.py` | Deterministic synthetic paths, planned orders, public observations and persisted idempotent commands |

Learning submissions persist an attempt, update progression, schedule review and award any first-completion XP within a transaction. A learner/request key pair makes retried submissions idempotent. SQLite serializes writes with `BEGIN IMMEDIATE`; PostgreSQL mutation authentication locks the profile row, with database uniqueness constraints as a second guard. See the [data model](docs/data-model.md).

The catalog contains private answer keys. API responses whitelist public question and learning-cycle fields; feedback reveals answers after a complete submission. Every lesson and module has publication status, and production learning routes reject pending content. A module-check pass is a storage state under the current rubric, not a validated financial-competence certification.

Guided sessions require the first four module checks; endless sessions require the first nine. Simulation routes persist command results and snapshots so retries and resumes preserve the same exercise. Each learner can have up to three unfinished sessions.

The simulation engine accepts a private seed and produces versioned snapshots. Keep its seed, scenario direction, future prices and future liquidity on the server. Only the engine’s public projection may reach the client. It models long-only synthetic assets and explicit teaching friction; it does not model a real exchange or determine investment suitability. [Simulation assumptions](docs/simulation-model.md) are part of its contract.

## Deployment and limits

Development uses a seven-day guest cookie with only its token hash stored. Production configuration requires Firebase verification, PostgreSQL and explicit HTTPS origins; it disables guest sessions and automatic migration by default. Firebase uses application-default credentials. Live Firebase/PostgreSQL deployment has not been established by local SQLite tests.

The static refined design reference is separate from application source. Its screenshots are historical review evidence. Product accessibility, mobile loading and beginner task success require checks on the actual running client. [Performance and usability requirements](docs/performance-and-usability.md) and the [evaluation plan](docs/evaluation-plan.md) separate engineering evidence from learner outcomes.

Region-specific legal and product rules belong outside the neutral curriculum; [localization boundaries](docs/localization-packs.md) record current support. Durable choices and their consequences are in [decision records](docs/decisions/).
