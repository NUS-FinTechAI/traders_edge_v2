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
| `auth.py`, `config.py`, `db.py`, `migrations.py`    | Guest or Firebase identity, settings, database sessions, ordered migrations                       |
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

### Persistence

SQLite locally, PostgreSQL in staging and production. `migrations.py` applies 1–12 in
order and refuses gaps; migration 11 adds the game tables and 12 the
campaign, quiz, lobby and rating tables. Tables from migrations 1–10 that
belonged to the removed system remain but are unused. Mutating requests lock
the player's profile row (SQLite: `BEGIN IMMEDIATE`), so one player's
commands run one at a time. See the [data model](docs/reference/data-model.md).

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
  `research` (study onboarding, consent panel, researcher dashboard).
- `services/` has one module per API area (game, campaign, daily, player,
  quiz, lobby, auth, config, research), each calling `httpService.request` with types
  generated into `api/` (`npm run api:generate`; CI runs `npm run api:check`).

The arena polls `GET /api/games/{id}?since=<tick>` 60 ms after `next_tick_at`
(clamped to 250–1,500 ms) while running and every 4 s in the briefing or
while paused, merging new bars and news. Lobbies and the ranked queue poll
every 2 s; a quiz room host's results every 5 s. Prices are drawn with a
dependency-free SVG candlestick chart.

## Content pipeline

Content is JSON in `server/app/content/`, loaded at startup and validated
strictly: `campaign/ch1–ch8.json`, 64 `scenarios/*.json` (40 level practices,
8 bosses, 7 dailies, 5 practice, 4 multiplayer), `bots.json` (24),
`quiz_bank.json` (160 questions), `cosmetics.json` (73 items) and
`review.json`. `python -m app.content.validate` checks every file and the
links between them; the balance gauntlet (`game/balance.py`, run by
`server/tests/test_game_balance.py`) fails if idle or random players win a
boss or daily too often. See the [authoring guide](docs/content/authoring.md).
