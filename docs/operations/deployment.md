# Deployment and live database checks

The backend has a container build and an explicit migration step.
`compose.yaml` runs PostgreSQL 16, applies migrations with
`python -m app.db`, then starts the API as user 10001 without reload. It binds
the API to loopback; put an HTTPS reverse proxy in front of it for an external
deployment. PostgreSQL is reachable only inside the Compose network, and its
named volume keeps data across restarts.

The image (`server/Dockerfile`) installs from `server/uv.lock` and copies only
the application, the dependency manifests and the README. The Compose
environment is production: PostgreSQL, Firebase authentication and explicit
HTTPS origins. Guest authentication cannot be enabled through it.

## Configure and start

Supply these through the host environment or an untracked, access-restricted
environment file:

- `POSTGRES_PASSWORD`: a unique database password.
- `DATABASE_URL`: `postgresql+psycopg://traders_edge:<URL-encoded-password>@postgres:5432/traders_edge`
  for this stack, or a separately managed PostgreSQL URL.
- `FIREBASE_PROJECT_ID`: the Firebase project.
- `ALLOWED_ORIGINS`: comma-separated HTTPS browser origins.
- `API_PORT`: an unused host port; defaults to 8000.
- Optional: `RESEARCH_ENABLED`, `RESEARCH_POLICY_VERSION`,
  `RESEARCH_POLICY_TEXT` (see [research](../reference/research.md)). Enable enrollment only
  after the study and its consent text are approved.

Optional settings default to disabled study enrollment. Any signed-in player may host a classroom quiz room, so there is no instructor setting:

- `RESEARCH_ENABLED`: enable only after the participant study and its consent policy receive the required approval.
- `RESEARCH_POLICY_VERSION`: a nonblank version of at most 80 characters with no surrounding whitespace, required when enrollment is enabled.
- `RESEARCH_POLICY_TEXT`: the exact approved consent text, required when enrollment is enabled. Change the version when changing accepted text. Acceptance requires the current version and SHA-256 text digest returned by the API.

With enrollment disabled, ordinary learning and owner-scoped evidence exports remain available under their existing authentication rules. Withdrawal stops study participation; it does not delete operational records. Account deletion, retention policy and cohort exports are not implemented.

Firebase needs application default credentials supplied by the deployment platform's workload identity or an explicit runtime secret mount. Do not put a service-account file in the build context or an image. The supplied Compose file does not mount credentials: configure that platform-specific secret before testing authenticated requests. Supplying a project name alone does not prove Firebase works.

```sh
docker compose --project-name traders-edge up --build --detach
docker compose --project-name traders-edge ps
curl --fail http://127.0.0.1:8000/health
```

The migration service must finish before the API starts. `AUTO_MIGRATE` is
false for the API, so a missing or old schema stops startup. Do not run two
migration services against one database at once. Back up an existing database
and test the upgrade to migration 12 on a restored copy first. Do not use
`down --volumes` on a persistent instance; it deletes player data.

The client is a static Vite build. Production builds call same-origin API
routes unless `VITE_BACKEND_URL` is set. Firebase sign-in also needs the
`VITE_FIREBASE_*` web-app settings; see `client/.env.example`.

## Live PostgreSQL tests

Create a disposable database whose name starts with `traders_edge_qa`,
reachable only on loopback, and set `TRADERS_EDGE_TEST_POSTGRES_URL` to its
`postgresql+psycopg://` URL. The tests reject remote hosts, other database
names and URL options. Each test works in a random schema and drops only that
schema.

```sh
uv run --project server --extra test --locked python -m unittest discover -s server/tests -p test_postgres_integration.py -v
```

`test_postgres_integration.py` checks that upgrading a populated database to
migration 12 keeps every row, that the profile lock waits and refreshes,
that two players can be awarded XP and activity concurrently, and that a
command replays the same response across two workers and a restart.
`test_research.py` repeats its cases on PostgreSQL. Without the URL these 15
tests are skipped; the PostgreSQL CI job sets it.

## What this does not establish

Health confirms the process started and the schema matched. It does not show
that Firebase tokens are accepted, that a hosted HTTPS deployment works, or
that the content is approved. Earlier container and PostgreSQL runs (6 October 2026) were made against the removed learning-run system and do not cover
migrations 11–12. Record the destination, image revision, migration result,
health check, valid and revoked token checks and browser-origin results when a
real hosting project and credentials are available.
