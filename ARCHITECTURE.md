# Architecture

Trader’s Edge is one FastAPI backend and one React client. The
[build contract](docs/game-architecture.md) holds the exact formulas, payloads
and content formats; this page is the overview. The
[game design document](docs/game-design.md) governs gameplay, and
[ADR 0004](docs/decisions/0004-playable-game-overhaul.md) records why the game
replaced the earlier learning-run system.

## Backend

`server/app/` is a modular monolith. Each package owns its tables and routes.

| Module                                           | Owns                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `game/`                                          | Matches: scenarios, seeded market, order engine, bots, missions, clock, results, balance gauntlet         |
| `campaign/`                                      | Chapters, levels, checks, stars, unlocks, the daily challenge, and the `resolve_game`/`settle_game` hooks |
| `player/`                                        | Profile, XP and levels, wallet, login streak, cosmetics, badges, shop, leaderboards                       |
| `quiz/`                                          | Quiz bank, quiz attempts, classroom quiz rooms                                                            |
| `multiplayer/`                                   | Private lobbies, ranked matchmaking, Elo                                                                  |
| `research.py`                                    | Owned evidence exports and default-off study consent                                                      |
| `content/`                                       | Authored JSON (campaign, scenarios, bots, quiz bank, cosmetics), the bundle loader and the validator      |
| `auth.py`, `config.py`, `db.py`, `migrations.py` | Guest or Firebase identity, settings, database sessions, ordered migrations                               |

### Match data flow

1. `POST /api/games` asks the `resolve_game` hook what the player may play.
   The hook (`campaign/games.py`) checks unlocks and picks the scenario, for
   example today's daily or the chapter boss, and returns a `GameSpec`.
2. `game/service.py` stores a `games` row with a random seed (or the daily's
   shared seed), the participants (the player and any bots) and a paused
   briefing clock.
3. `POST /start` stores the player's plan (a strategy and a maximum loss) and
   starts the clock. The clock is a JSON anchor on the game row:
   `current_tick = anchor_tick + (now − anchor_at) / tick_ms`, frozen while
   paused. Pause, resume, step and speed re-anchor it. Multiplayer matches use
   a fixed 3 s tick and reject clock commands.
4. Every read rebuilds the match state. `engine.replay` regenerates the price
   path from the scenario and seed (`market.py`), then replays the stored human
   orders from `game_orders` and the deterministic bots tick by tick up to the
   current tick. Only commands write to the database. Future bars and news are
   never sent.
5. Orders are validated against the rebuilt state. A rejected order returns 422
   with a plain-language reason. Each command, accepted or rejected, is logged
   to `game_events` with the context the player saw.
6. `POST /finish` computes the result (rank, profit, missions, plan review,
   decision score, key moments) and calls the `settle_game` hook
   (`campaign/settlement.py`). The hook awards stars, boss results, unlocks,
   XP, Doubloons, Gems, Elo and badges. It writes an `economy_events` marker
   `game:<id>` and gives every reward its own natural key, so a repeated
   finish pays nothing twice.

`game/` does not know about chapters or currencies; everything mode-specific
sits behind the two hooks, which `main.py` registers on `app.state`.

### Persistence

SQLite locally, PostgreSQL in production. Migrations are append-only:
`migrations.py` applies 1–12 in order and refuses gaps. Migration 11 adds the
game tables and migration 12 the campaign, quiz, lobby and rating tables.
Tables from migrations 1–10 that belonged to the removed system remain but are
unused. Mutating requests lock the player's profile row (and, in SQLite, take
a write lock) so one player's commands run one at a time. See the
[data model](docs/reference/data-model.md).

### Research events

`game_events` holds every human command with its observed context (tick,
prices, cash, holdings, open orders, latest headline), the plan, the attempt
number and any Gem refresh. Players can download their own events, campaign
progress and quiz attempts. Study enrollment is off unless configured. See
[research](docs/reference/research.md).

## Client

`client/` is React 19, TypeScript and Vite.

- `router.tsx` lazy-loads every page. Home, login, the adventure maps and the
  archive are public; play routes use `authGuard`.
- `app/` holds the shell (HUD and navigation) and the player provider.
- `ui/` is the design system: tokens in `ui/tokens.css` and shared primitives.
- `features/` has one folder per area: `home`, `adventure`, `level`, `arena`,
  `play`, `quiz`, `multiplayer`, `profile`, `leaderboard`, `archive`, `auth`.
- `services/` has one module per API area. Each uses `httpService` with types
  generated from the backend's OpenAPI schema into `api/`
  (`npm run api:generate`; CI runs `npm run api:check`).

The arena polls `GET /api/games/{id}?since=<tick>` just after each expected
tick while running and every 4 s while paused, and merges the new bars and
news. Lobbies and the ranked queue poll every 2 s. Prices are drawn with a
dependency-free SVG chart.

## Content pipeline

Content is JSON in `server/app/content/`, loaded at startup and validated
strictly (unknown fields fail):

- `campaign/ch1.json … ch8.json`: chapters, levels, cards, checks, rewards;
- `scenarios/*.json`: 64 markets (40 level practices, 8 bosses, 7 dailies,
  5 practice, 4 multiplayer);
- `bots.json` (24 AI opponents), `quiz_bank.json` (160 questions),
  `cosmetics.json` (73 items).

`uv run --project server --extra test --locked python -m app.content.validate`
checks every file and the links between them. The balance gauntlet
(`game/balance.py`, run by `server/tests/test_game_balance.py`) plays idle,
random, buy-and-hold and trend-following synthetic players against each
scenario's bots over 50 seeds, and fails if idle or random players win a boss
or daily too often. Validation and the gauntlet check structure and balance,
not financial accuracy; the content still needs independent review.
