# Backend deployment and live database verification

The backend has a reproducible container build and an explicit migration step. The Compose stack runs PostgreSQL 16, applies append-only migrations, then starts the API as user 10001 without reload. It binds the API to loopback; put an HTTPS reverse proxy in front of it for an external deployment. PostgreSQL is reachable only within the Compose network. Its named volume retains data across ordinary restarts.

The build context is allowlisted to the server application, locked dependency manifests and README. Local databases, credential files, editor files, test fixtures and virtual environments are excluded. Dependencies install from `server/uv.lock`. The container runs the existing production configuration: PostgreSQL, Firebase authentication, explicit HTTPS browser origins and fail-closed content approval. Guest authentication cannot be enabled through this Compose file.

## Configure and start

Supply these through a host environment or an untracked, access-restricted environment file:

- `POSTGRES_PASSWORD`: a unique database password.
- `DATABASE_URL`: `postgresql+psycopg://traders_edge:<URL-encoded-password>@postgres:5432/traders_edge` for this stack, or a separately managed PostgreSQL database URL if adapting the topology.
- `FIREBASE_PROJECT_ID`: the actual Firebase project.
- `ALLOWED_ORIGINS`: a comma-separated allowlist of actual HTTPS browser origins.
- `API_PORT`: an unused host port; defaults to 8000.

Firebase needs application default credentials supplied by the deployment platform's workload identity or an explicit runtime secret mount. Do not put a service-account file in the build context or an image. The supplied Compose file does not mount credentials: configure that platform-specific secret before testing authenticated requests. Supplying a project name alone does not prove Firebase works.

```sh
docker compose --project-name traders-edge up --build --detach
docker compose --project-name traders-edge ps
curl --fail http://127.0.0.1:8000/health
```

The migration service must finish successfully before the API starts. `AUTO_MIGRATE` is false for the running API, so a missing or old schema fails startup. Do not run two migration services against the same database concurrently. Back up an existing database and test the upgrade on an isolated restored copy before changing a deployed instance. Do not use `down --volumes` for a persistent instance; that deletes learner data.

Health confirms process liveness after startup schema validation. It does not verify Firebase token acceptance, learner access, approval of authored content, external HTTPS or a cloud deployment. Authenticated learning remains unavailable in production until the independent content approvals are recorded; do not mark content approved to make a deployment smoke test pass.

## Live PostgreSQL tests

Create a dedicated disposable database whose name begins with `traders_edge_qa`, exposed only on loopback. Set `TRADERS_EDGE_TEST_POSTGRES_URL` to its `postgresql+psycopg://` URL. The test suite rejects remote hosts, non-QA database names and URL options. Each test creates a random QA schema and removes only that schema afterward; it never drops the database or public schema. The QA login needs permission to create schemas in this disposable database.

```sh
uv run --project server --extra test --locked python -m unittest discover -s server/tests -p test_postgres_integration.py -v
```

Without the explicit test URL these four tests skip. The dedicated PostgreSQL integration CI job sets the URL and requires live tests to pass. The tests cover populated migrations 1–3 through 4 with complete prior-row preservation, repeat migration, actual profile-row lock waiting and cached-object refresh, concurrent cross-profile aggregate increments, and exact command replay across separate application workers and an application restart. An unrelated profile cannot read the saved run. These are real PostgreSQL transactions, not dialect compilation or SQLite substitutes.

On 6 October 2026 these checks passed against PostgreSQL 16 in a dedicated Docker container. A local production-configured API container also started after explicit migrations and rejected guest/missing-token access. This establishes local container startup and fail-closed authentication, not successful real Firebase sign-in or deployment to a hosted destination. Record the destination, image revision, migration result, health check, valid/invalid/revoked token checks and HTTPS browser-origin results when the actual hosting project and credentials are supplied.
