# Server

One FastAPI service: matches, campaign, player economy, quizzes, multiplayer
and research exports. Module layout and data flow are in
[ARCHITECTURE.md](../ARCHITECTURE.md); every endpoint is in the
[API reference](../docs/reference/api.md).

## Run and verify

Python 3.12+ and uv 0.12.23, from the repository root:

```sh
uv sync --project server --extra test --locked
uv run --project server --locked python -m uvicorn app.main:app --reload
uv run --project server --extra test --locked python -m unittest discover -s server/tests
uv run --project server --extra test --locked python -m app.content.validate
```

Local data lives in SQLite at `server/data/learning.db` and survives
restarts. Generated schemas are at `/docs`; `GET /health` is unauthenticated
liveness. A quick guest-mode check:

```sh
curl -X POST -H 'Origin: http://localhost:5173' -c /tmp/traders-edge-cookies http://127.0.0.1:8000/api/session
curl -b /tmp/traders-edge-cookies http://127.0.0.1:8000/api/campaign
```

`server/tests/` covers the engine, market, clock, bots, missions, scenarios,
balance, game API, campaign, daily, player, quiz, multiplayer, research,
migrations, auth, content and the API contract. The live PostgreSQL cases are
skipped unless `TRADERS_EDGE_TEST_POSTGRES_URL` points to a disposable
loopback database ([deployment](../docs/operations/deployment.md#live-postgresql-tests)).

## Configuration

| Variable                  | Default                                          | Meaning                                                                       |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `APP_ENV`                 | `development`                                    | `production` enables strict startup checks and the content review gate        |
| `DATABASE_URL`            | Absolute local SQLite URL                        | Use `postgresql+psycopg://...` for PostgreSQL                                 |
| `AUTH_MODE`               | `guest` in development; `firebase` in production | Guest sessions or server-verified Firebase identity                           |
| `ALLOWED_ORIGINS`         | `http://localhost:5173`, `http://127.0.0.1:5173` | Comma-separated exact browser origins                                         |
| `FIREBASE_PROJECT_ID`     | Unset                                            | Required in Firebase mode                                                     |
| `AUTO_MIGRATE`            | `true` locally, `false` in production            | Apply pending migrations at startup; otherwise only check the schema version  |
| `RESEARCH_ENABLED`        | `false`                                          | Enable study enrollment only after ethics and privacy approval                |
| `RESEARCH_POLICY_VERSION` | Unset                                            | Required nonblank, unpadded 1–80 character version when enrollment is enabled |
| `RESEARCH_POLICY_TEXT`    | Unset                                            | Required exact consent text; its UTF-8 SHA-256 digest binds acceptance        |

Startup fails when `AUTH_MODE` is not `guest` or `firebase`, when Firebase
mode has no project id, when enabled enrollment lacks a valid policy, and, in
production, unless authentication is Firebase, the database URL starts with
`postgresql+psycopg://` and every origin starts with `https://`.

In production, gameplay routes (level content and checks, the daily
challenge, `/api/games`, quizzes, lobbies and matchmaking) return 503 until
`app/content/review.json` records `"status": "approved"`. The shipped status
is `authored_requires_independent_review`.

There is no instructor setting: any signed-in player can host a classroom quiz
room.

## Authentication

- **Guest** (development default): `POST /api/session` creates or reuses a
  profile and sets an HTTP-only, `SameSite=Strict` cookie holding a token
  whose SHA-256 hash is stored; sessions last seven days.
  `DELETE /api/session` revokes it. Clearing the cookie loses the profile:
  guest mode is for local development, not account recovery. Guest sessions
  are refused in Firebase mode.
- **Firebase**: every authenticated request sends
  `Authorization: Bearer <ID token>`. The Firebase Admin SDK verifies
  signature, project, expiry and revocation with application default
  credentials; the first verified request creates the profile. Verification
  errors return 401.

Request handling (origins, body limit, per-identity ordering, caching) is in
the [API conventions](../docs/reference/api.md#conventions).

## Where things are documented

| Topic                                  | Doc                                             |
| -------------------------------------- | ----------------------------------------------- |
| Engine, missions, results, balance     | [engine](../docs/reference/engine.md)           |
| Match modes, bosses, daily, settlement | [matches](../docs/reference/matches.md)         |
| Unlocks, XP, currencies, shop, badges  | [progression](../docs/reference/progression.md) |
| Content formats and validation         | [authoring guide](../docs/content/authoring.md) |
| Tables and migrations                  | [data model](../docs/reference/data-model.md)   |
| Containers and PostgreSQL tests        | [deployment](../docs/operations/deployment.md)  |

Local checks do not establish real Firebase sign-in, a hosted deployment or
learning outcomes. Account deletion, retention rules and researcher access are
not implemented.
