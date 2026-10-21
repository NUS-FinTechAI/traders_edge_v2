# Deployment

Server settings and startup checks are in the
[server guide](../../server/README.md#configuration).

## Container stack

`compose.yaml` runs three services:

| Service    | Does                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| `postgres` | PostgreSQL 16, reachable only inside the Compose network; the named volume keeps data across restarts     |
| `migrate`  | Applies migrations with `python -m app.db`, then exits; the API waits for it                              |
| `api`      | The API as user 10001 without reload, bound to `127.0.0.1:${API_PORT:-8000}`; health-checked on `/health` |

The image (`server/Dockerfile`, Python 3.12, uv 0.12.23) installs from
`server/uv.lock` and copies only the application, the manifests and the
README. The Compose environment is production: `APP_ENV=production`,
PostgreSQL, Firebase authentication, explicit HTTPS origins and
`AUTO_MIGRATE=false`. Guest authentication cannot be enabled through it.
Because the shipped `content/review.json` is not `approved`, gameplay routes
return 503 in this stack until the content review is recorded.

Supply these through the host environment or an untracked, access-restricted
environment file:

| Variable                                                              | Value                                                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`                                                   | A unique database password                                                                                                      |
| `DATABASE_URL`                                                        | `postgresql+psycopg://traders_edge:<URL-encoded-password>@postgres:5432/traders_edge`, or a managed PostgreSQL URL              |
| `FIREBASE_PROJECT_ID`                                                 | The Firebase project                                                                                                            |
| `ALLOWED_ORIGINS`                                                     | Comma-separated HTTPS browser origins                                                                                           |
| `API_PORT`                                                            | Optional host port (default 8000)                                                                                               |
| `RESEARCH_ENABLED`, `RESEARCH_POLICY_VERSION`, `RESEARCH_POLICY_TEXT` | Optional; enable only after the study and its consent text are approved ([research](../reference/research.md#study-enrollment)) |

Firebase needs application default credentials from the platform's workload
identity or a runtime secret mount. Never put a service-account file in the
build context or image. The Compose file mounts no credentials, so configure
that secret before testing authenticated requests.

```sh
docker compose --project-name traders-edge up --build --detach
docker compose --project-name traders-edge ps
curl --fail http://127.0.0.1:8000/health
```

- A missing or old schema stops API startup; do not run two migration
  services against one database at once.
- Back up an existing database and test the upgrade to migration 12 on a
  restored copy first.
- Never use `down --volumes` on a persistent instance; it deletes player data.

## Client build

The client is a static Vite build (`npm run build`, output in `client/dist/`).
Production builds call same-origin API routes unless `VITE_BACKEND_URL` is
set. Firebase sign-in also needs the `VITE_FIREBASE_*` web-app settings; see
`client/.env.example`.

## Hosting

No hosted deployment exists yet. What the repository provides today is the
container stack above, which binds the API to loopback and expects an HTTPS
reverse proxy in front of it, and the static client build. When a real
hosting project and credentials are available, record the destination, image
revision, migration result, health check, valid and revoked token checks and
browser-origin results here.

## Live PostgreSQL tests

Create a disposable database whose name starts with `traders_edge_qa`,
reachable only on loopback, and set `TRADERS_EDGE_TEST_POSTGRES_URL` to its
`postgresql+psycopg://` URL. The tests reject remote hosts, other database
names and URL options; each test works in a random schema and drops only that
schema.

```sh
uv run --project server --extra test --locked python -m unittest discover -s server/tests -p test_postgres_integration.py -v
```

`test_postgres_integration.py` checks that upgrading a populated database to
migration 12 keeps every row, that the profile lock waits and refreshes, that
two players can be awarded XP and activity concurrently, and that a command
replays the same response across two workers and a restart.
`test_research.py` repeats its cases on PostgreSQL. Without the URL these 15
tests are skipped; the PostgreSQL CI job sets it.

## Not established

A passing health check shows the process started and the schema matched. It
does not show that Firebase tokens are accepted, that a hosted HTTPS
deployment works, or that the content is approved. Earlier container and
PostgreSQL runs (6 October 2026) used the removed learning-run system and do
not cover migrations 11–12.
