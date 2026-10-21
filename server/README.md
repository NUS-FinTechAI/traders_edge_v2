# Backend API

One FastAPI service for the game: trading matches, the campaign, the player
economy, quizzes, multiplayer and research exports. Exact formulas, payload
shapes and content formats are in the [build contract](../docs/game-architecture.md).

Local development stores data in SQLite at `server/data/learning.db`; closing
the API does not erase it. Guest credentials are held in an HTTP-only cookie,
with only a SHA-256 hash of the token stored. Guest sessions expire after seven
days. Clearing the cookie loses access to that guest profile; guest mode is for
local development, not account recovery.

## Run and verify

Requires Python 3.12 or newer and uv 0.12.23. From the repository root:

```sh
uv sync --project server --extra test --locked
uv run --project server --locked python -m uvicorn app.main:app --reload
uv run --project server --extra test --locked python -m unittest discover -s server/tests
uv run --project server --extra test --locked python -m app.content.validate
```

The client must send credentials. State-changing requests to `/api/` need an
allowed `Origin` (defaults: `http://localhost:5173` and
`http://127.0.0.1:5173`); in Firebase mode a request with a bearer token and
no `Origin` header is also accepted. Request bodies over 64 KiB are rejected.
Use the same hostname for client and API, because the guest cookie uses
`SameSite=Strict`. Every `/api/` response is `Cache-Control: no-store`.

```sh
curl -X POST -H 'Origin: http://localhost:5173' -c /tmp/traders-edge-cookies http://127.0.0.1:8000/api/session
curl -b /tmp/traders-edge-cookies http://127.0.0.1:8000/api/campaign
```

`GET /health` is unauthenticated liveness. Generated schemas are at `/docs`.
Request bodies reject unknown fields.

## Configuration

| Variable                  | Default                                          | Meaning                                                                       |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `APP_ENV`                 | `development`                                    | Set `production` for strict deployment checks                                 |
| `DATABASE_URL`            | Absolute local SQLite URL                        | Use `postgresql+psycopg://...` for PostgreSQL                                 |
| `AUTH_MODE`               | `guest` in development; `firebase` in production | Guest sessions or server-verified Firebase identity                           |
| `ALLOWED_ORIGINS`         | The two local client origins                     | Comma-separated exact browser origins                                         |
| `FIREBASE_PROJECT_ID`     | Unset                                            | Required when Firebase authentication is enabled                              |
| `AUTO_MIGRATE`            | `true` locally, `false` in production            | Apply pending migrations at startup; otherwise only check the schema version |
| `RESEARCH_ENABLED`        | `false`                                          | Enable study enrollment only after the required ethics/privacy approval       |
| `RESEARCH_POLICY_VERSION` | Unset                                            | Required nonblank, unpadded 1–80 character version when enrollment is enabled |
| `RESEARCH_POLICY_TEXT`    | Unset                                            | Required exact consent text; its UTF-8 SHA-256 digest binds acceptance        |

There is no instructor setting: any signed-in player can host a classroom quiz
room.

In production, gameplay routes (level content and checks, the daily challenge,
`/api/games`, quizzes, lobbies and matchmaking) return 503 until
`app/content/review.json` records `"status": "approved"`. The shipped content is
`authored_requires_independent_review`.

Startup validation fails when `AUTH_MODE` is not `guest` or `firebase`, when
Firebase mode has no project ID, when enabled enrollment lacks a valid policy
version or text, and, in production, unless authentication is Firebase, the
database URL starts with `postgresql+psycopg://` and every allowed origin
starts with `https://`.

## Authentication

- **Guest** (development default): `POST /api/session` creates or reuses a
  profile and sets the cookie; `DELETE /api/session` revokes it. Guest sessions
  are refused in Firebase mode.
- **Firebase**: every authenticated request needs `Authorization: Bearer
  <ID token>`. The Firebase Admin SDK verifies the signature, project,
  expiry and revocation using application default credentials. The first
  verified request creates the profile. Verification errors return 401.

Public reads (`GET /api/campaign`, chapter maps, levels, `/api/archive`,
`/api/bosses`, `/api/practice`, `/api/config`) work signed out; signed-out
users see Chapter 1 open and nothing earned. `GET /api/config` returns only
the auth mode and, in Firebase mode, the project ID.

Mutating requests lock the player's profile row (`SELECT … FOR UPDATE`; SQLite
uses `BEGIN IMMEDIATE`) and run one at a time per identity. A unique-key
conflict from a concurrent request returns 409; retry it.

## Endpoints

All routes are under `/api`. Payloads and responses are listed in the
[build contract](../docs/game-architecture.md#api) and the
[API guide](../docs/api.md).

| Group       | Routes                                                                                                                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Games       | `POST /games`, `GET /games?status=active`, `GET /games/{id}?since=`, `POST /games/{id}/start`, `POST /games/{id}/clock`, `POST /games/{id}/orders`, `DELETE /games/{id}/orders/{order_id}`, `POST /games/{id}/finish`, `GET /games/{id}/result`          |
| Campaign    | `GET /campaign`, `GET /campaign/chapters/{id}`, `GET /campaign/levels/{id}`, `POST /campaign/levels/{id}/check`, `POST /campaign/levels/{id}/check/complete`, `GET /archive`, `GET /bosses`, `GET /practice`, `GET /daily`, `POST /daily/refresh`       |
| Player      | `GET /me`, `PATCH /me`, `POST /me/daily-login`, `GET /me/activity`, `GET /me/collection`, `GET /shop`, `POST /shop/purchase`, `GET /leaderboards/xp`, `GET /leaderboards/ranked`                                                                      |
| Quizzes     | `GET /quizzes`, `POST /quizzes/attempts`, `GET /quizzes/attempts/{id}`, `POST /quizzes/attempts/{id}/answers`, `POST /quizzes/rooms`, `GET /quizzes/rooms/{id}`                                                                                        |
| Multiplayer | `GET /lobbies/scenarios`, `POST /lobbies`, `POST /lobbies/join`, `GET /lobbies/{id}`, `POST /lobbies/{id}/start`, `POST /lobbies/{id}/leave`, `POST /matchmaking`, `GET /matchmaking`, `DELETE /matchmaking`                                           |
| Research    | `GET /me/research`, `POST /me/research/metadata`, `POST /me/research/consents`, `POST /me/research/withdrawals`, `GET /me/research/export/{game-events\|campaign-progress\|quiz-attempts}`                                                              |
| Auth/config | `POST /session`, `DELETE /session`, `GET /config`                                                                                                                                                                                                       |

Status codes: 401 without a valid session; 403 for a locked chapter, level,
boss, daily, ranked queue or a multiplayer clock command; 404 for an unknown or
foreign record; 409 for a state conflict (match not running, cooldown active,
reused `client_order_id` with a different order, first quiz answer already
given); 422 for invalid input or a rejected order (`{detail}` explains the rule
in plain language).

## Matches and settlement

`app/game` owns matches and calls two hooks registered in `main.py`:
`resolve_game` (`campaign/games.py`) decides what a `POST /api/games` request
may play, and `settle_game` (`campaign/settlement.py`) awards stars, XP,
currencies, Elo and badges. Match state is rebuilt from the scenario, seed and
stored orders on every read. Settlement writes a `game:<id>` economy event and
gives each reward a natural key, so repeating `finish` returns the stored result
and pays nothing twice. Private lobby matches award nothing. See
[trading matches](../docs/challenges.md) and the
[engine model](../docs/simulation-model.md).

## Content authoring and validation

Authored content lives in `app/content/`:

| Path                     | Content                                                                         |
| ------------------------ | ------------------------------------------------------------------------------- |
| `campaign/ch1–ch8.json`  | One chapter each: 5 levels with objectives, terms, cards, check, practice id   |
| `scenarios/<id>.json`    | 64 markets: `chN-lM-practice`, `chN-boss`, `daily-*`, `practice-*`, `mp-*`     |
| `bots.json`              | 24 AI opponents across 8 strategies                                             |
| `quiz_bank.json`         | 160 quiz questions, 20 per chapter                                              |
| `cosmetics.json`         | 28 avatars, 24 titles, 5 themes, 16 badges                                      |

The formats are in the [build contract](../docs/game-architecture.md#content-formats)
and the [authoring guide](../docs/curriculum/README.md). Content is loaded and
validated at startup, so invalid content stops the server. Check it first:

```sh
uv run --project server --extra test --locked python -m app.content.validate
```

On success it prints the counts (`64 scenarios, 8 chapters, 160 quiz
questions, 73 cosmetics` at `9db44ce`). Validation checks structure and links,
not financial accuracy or teaching quality.

## Balance test

`server/tests/test_game_balance.py` runs the Monte-Carlo gauntlet
(`app/game/balance.py`) over seeds 0–49 for every shipped scenario whose
`balance` is `boss` or `daily`. It fails if the idle player wins more than 5 %
of bosses or 10 % of dailies, or the random clicker more than 10 % of bosses or
25 % of dailies. Run it alone while tuning:

```sh
uv run --project server --extra test --locked python -m unittest discover -s server/tests -p test_game_balance.py
```

To see all four synthetic players for one scenario, call
`balance.gauntlet(load_scenarios()['ch3-boss'], range(50))` from a Python shell
in the server environment.

## Migrations

`app/migrations.py` applies migrations 1–12 in order and rejects gaps or
unknown versions. Migration 11 (`migration_v11.py`) adds `games`,
`game_participants`, `game_orders` and `game_events`. Migration 12
(`migration_v12.py`) adds `campaign_progress`, `campaign_checks`,
`boss_results`, `quiz_rooms_v2`, `quiz_room_members_v2`, `quiz_attempts_v2`,
`lobbies`, `lobby_members`, `matchmaking_queue` and `ratings`. Migrations 1–10
belong to the removed learning-run system; they stay frozen and most of their
tables are unused. Never edit a deployed migration; append a new one.

With automatic migration disabled, run
`uv run --project server --locked python -m app.db` before starting; the API
refuses to start when the recorded versions do not match. Back up the database
before upgrading.

## Tests and production limits

`server/tests/` covers the engine, market, clock, bots, objectives, scenarios,
balance, game API, campaign, daily, player, quiz, multiplayer, research,
migrations, auth and the API contract. At `9db44ce` the suite ran 249 tests
with 15 skipped; the skipped tests are the live PostgreSQL cases, which run
only when `TRADERS_EDGE_TEST_POSTGRES_URL` points to a disposable loopback
database (see [deployment](../docs/deployment.md)).

Production refuses guest auth, SQLite and non-HTTPS origins. Local checks do
not establish real Firebase sign-in, a hosted deployment or learning outcomes.
There is no production approval gate for content; the authored chapters,
scenarios and quiz bank still need independent financial and pedagogical
review before release. Account deletion, retention rules and researcher access
are not implemented.
