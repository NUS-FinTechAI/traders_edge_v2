# Architecture

One FastAPI backend and one React client. The
[game design document](docs/game-design.md) governs gameplay;
[ADR 0004](docs/decisions/0004-playable-game-overhaul.md) records why the game
replaced the earlier learning-run system. Detailed rules are in the
[reference docs](docs/README.md#reference).

## Backend

`server/app/` is a modular monolith; each package owns its tables and routes.

| Module                                              | Owns                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `game/`                                             | Matches: scenarios, seeded market, order engine, bots, missions, clock, results, balance gauntlet |
| `campaign/`                                         | Chapters, levels, checks, stars, unlocks, bosses, the daily challenge, the game hooks             |
| `player/`                                           | Profile, XP and levels, wallet, login streak, cosmetics, badges, shop, leaderboards               |
| `quiz/`                                             | Quiz bank, attempts, classroom rooms                                                              |
| `multiplayer/`                                      | Private lobbies, ranked matchmaking, Elo                                                          |
| `research.py`                                       | Owned evidence exports and default-off study consent                                              |
| `study/`                                            | Prior-knowledge instrument and onboarding; researcher access, scope, aggregates and CSV exports   |
| `content/`                                          | Authored JSON, the bundle loader, `review.json` and the validator                                 |
| `auth.py`, `config.py`, `db.py`, `migrations/`      | Guest or Firebase identity, settings, database sessions, ordered migrations                       |
| `codes.py`, `public_config.py`, `economy_models.py` | Join codes, `GET /api/config`, wallet and event tables (migration 6, reused)                      |

### Match data flow

1. `POST /api/games` calls the `resolve_game` hook (`campaign/games.py`),
   which checks unlocks and returns a `GameSpec` (scenario, mode, chapter,
   level, boss kind, context, bots).
2. `game/service.py` stores a `games` row with a random seed (or the daily's
   shared seed), the participants and a paused briefing clock.
3. `POST /start` stores the plan and starts the clock, a JSON anchor on the
   game row ([clock](docs/reference/engine.md#clock)). Solo starts first call
   the `before_start` hook, which refuses an expired or cooling-down daily.
4. Every read rebuilds the match: `market.py` regenerates the price path from
   scenario and seed, and `engine.py` replays the stored human orders and the
   deterministic bots up to the current tick. Only commands write. Future bars
   and news are never sent.
5. Orders are validated against the rebuilt state; a rejection returns 422
   with a plain-language reason. Every command, accepted or rejected, is
   logged to `game_events` with the context the player saw.
6. `POST /finish` computes the result and calls the `settle_game` hook
   (`campaign/settlement.py`), which awards stars, boss results, unlocks, XP,
   Doubloons, Gems, Elo and badges under natural keys
   ([settlement](docs/reference/matches.md#settlement)).

`game/` knows nothing about chapters or currencies. The hooks live on
`app.state`; the defaults in `game/service.py` allow `practice` only and award
nothing, and `main.py` replaces them:

```python
# Raises HTTPException(403/409) when not allowed, or service.Refused(status, detail)
# to refuse while keeping writes made first (e.g. settling an ended daily).
async def resolve_game(db, profile, request: CreateGame) -> GameSpec

# Settles one human participant after the engine computed `result`; returns
# {"rewards", "stars", "unlocked"}. Must be idempotent.
async def settle_game(db, profile, game, participant, result: dict) -> dict

# Called before a solo briefing starts; raises HTTPException to refuse.
async def before_start(db, profile, game) -> None
```

Lobbies and matchmaking call `game.service.create_multiplayer_game(...)`.

### Extending the backend

Add lessons and markets through the existing JSON formats and validators
([authoring guide](docs/content/authoring.md)). Keep scenario ids stable and
bump the version when markets or missions change. The opponents in
`game/bots.py` are deterministic rule-based strategies; they receive only
the bars and news visible at their observed tick.

Keep progression and reward changes in the campaign hooks above. The game
service can run practice matches with its default hooks; a different progression
system can supply its own resolver and idempotent settlement hook in
`create_app`. These are internal Python interfaces, so changes to them need
tests for the callers as well as the engine.

For another client, use the HTTP API and its authentication rules
([API reference](docs/reference/api.md)). A running server exposes generated
OpenAPI at `/openapi.json` and interactive documentation at `/docs`.
`client/api/` contains generated types and endpoint definitions for this
React client, checked by `npm run api:check`; there is no separately released
SDK or versioned integration guarantee.

### Persistence

SQLite locally, PostgreSQL in staging and production.
`server/app/migrations/migrations.py` applies versions 1–15 in order and
refuses gaps. Migration 11 adds the game tables; 12 adds campaign, quiz,
lobby and rating tables; 13 adds the prior-knowledge instrument and check
timestamps; 14 adds badge equipment; 15 adds unlock acknowledgements. Tables
from migrations 1–10 that belonged to the removed system remain but are
unused. Mutating requests lock the player's profile row (SQLite:
`BEGIN IMMEDIATE`), so one player's commands run one at a time. See the
[data model](docs/reference/data-model.md).

In production, `require_approved_content` refuses the game, quiz, multiplayer,
level and daily routes (503) until `content/review.json` is `approved`.

## Client

`client/` is React 19, TypeScript and Vite.

- `router.tsx` lazy-loads every page. `/`, `/login`, `/adventure`,
  `/adventure/:chapterId` and `/archive` are public; the rest use `authGuard`.
- `app/` holds the shell (HUD and navigation), the player provider and the
  theme applier.
- `ui/` is the design system: [tokens](client/ui/tokens.css) and shared
  primitives ([design system](docs/product/design-system.md)).
- `features/` has one folder per area: `home`, `adventure`, `level`, `arena`,
  `play`, `quiz`, `multiplayer`, `profile`, `leaderboard`, `archive`, `auth`,
  `research` (study onboarding, consent panel, researcher dashboard) and
  `rewards` (reward pictures and toasts).
- Authentication state is split across `components/AuthProvider.tsx`,
  `contexts/AuthContext.ts`, `controllers/authController.ts`,
  `hooks/useAuth.ts` and the route guard in `auth-guards/authGuard.ts`.
- `tests/` holds `node:test` unit tests for services and pure UI logic
  (`npm test`); there are no component render tests yet.
- `services/` has one module per API area (game, campaign, daily, player,
  quiz, lobby, auth, config, research), each using the typed `apiClient` and
  generated endpoint definitions in `api/`. The client delegates transport to
  `httpService`, including CSV exports through `callText`
  (`npm run api:generate`; CI runs `npm run api:check`).

The arena polls `GET /api/games/{id}?since=<tick>` 60 ms after `next_tick_at`
(clamped to 250–1,500 ms) while running and every 4 s in the briefing or
while paused, merging new bars and news. Lobbies and the ranked queue poll
every 2 s; a quiz room host's results every 5 s. Prices are drawn with a
dependency-free SVG candlestick chart. A first-match coach-mark tour
(`features/arena/tour/`) points at elements marked with `data-tour`; its step
plan, progression and per-profile storage are pure functions in `tour.ts`.

## Content pipeline

Content is JSON in `server/app/content/`, loaded at startup and validated
strictly: `campaign/ch1–ch8.json`, 64 `scenarios/*.json` (40 level practices,
8 bosses, 7 dailies, 5 practice, 4 multiplayer), `bots.json` (24),
`quiz_bank.json` (160 questions), `cosmetics.json` (73 items),
`research/prior_knowledge.json` (10 items) and `review.json`.
`python -m app.content.validate` checks every file and the links between
them; the balance gauntlet (`game/balance.py`, run by
`server/tests/test_game_balance.py`) fails if idle or random players win a
boss or daily too often. See the [authoring guide](docs/content/authoring.md).
