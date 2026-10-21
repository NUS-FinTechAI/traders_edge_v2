# Trader’s Edge

Trader’s Edge is a trading education game for beginners: short lesson cards,
a quick check, then a trading mission in a simulated market against AI rivals.
All money is simulated and every company is fictional.

## Features

- **Adventure**: 8 chapters × 5 levels on a treasure map, each chapter with a
  Preview Battle, a Gate Boss to skip ahead and a Chapter Boss.
- **Trading arena**: live candlestick market on a server clock (pause, next
  day, 1×/2×/4×), market, limit and stop-loss orders as they are taught, fees
  and a spread, AI rivals on a profit leaderboard, missions and a results
  screen with key moments.
- **Daily challenge** (after the Chapter 1 boss) and a **practice arena**.
- **Quizzes**: chapter quizzes, daily review, mixed mastery and classroom
  rooms with a join code.
- **Multiplayer**: private lobbies for classes and ranked matchmaking with Elo
  (after the Chapter 3 boss).
- **Profile**: level and rank, badges, avatars, titles, themes, activity
  heatmap, login streak, shop and opt-in leaderboards.

Profit decides every match; XP is never paid for placing orders.

## Quick start

Node.js 24+, Python 3.12+ and uv 0.12.23, from the repository root:

```sh
npm ci
npm --prefix client ci
uv sync --project server --extra test --locked
npm run dev
```

In a second terminal:

```sh
uv run --project server --locked python -m uvicorn app.main:app --reload
```

Client: `http://localhost:5173`. API: `http://127.0.0.1:8000` (schemas at
`/docs`). Local development uses guest sessions and SQLite
(`server/data/learning.db`).

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm test
npm run api:check
uv run --project server --extra test --locked python -m unittest discover -s server/tests
uv run --project server --extra test --locked python -m app.content.validate
```

The backend suite includes the balance gauntlet. Live PostgreSQL tests run
only when `TRADERS_EDGE_TEST_POSTGRES_URL` is set
([deployment](docs/operations/deployment.md#live-postgresql-tests)).

## Documentation

[docs/README.md](docs/README.md) indexes every document. Start with
[ARCHITECTURE.md](ARCHITECTURE.md), the
[game design document](docs/game-design.md) and the
[server guide](server/README.md). Repository rules are in
[AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md); history is in
the [changelog](CHANGELOG.md).

## Status

The game loop, campaign, economy, quizzes and multiplayer are implemented and
tested locally. Not yet done:

- independent financial and pedagogical review of the content (production
  refuses gameplay until it is recorded);
- real Firebase sign-in and a hosted deployment;
- account deletion, retention rules and researcher access;
- any measured learning outcome; the decision score is unvalidated.
