# Trader’s Edge

Trader’s Edge is a trading education game for beginners. Players learn a
concept from short lesson cards, check it with a few questions, then apply it
in a simulated market against AI rivals. All money is simulated and every
company is fictional.

## Features

- **Adventure.** 8 chapters × 5 levels on a treasure map. Each level has
  lesson cards, a check (wrong answers come back until they are right) and a
  trading mission with basic and bonus objectives. Each chapter has a Preview
  Battle before the lessons, a Gate Boss to skip ahead, and a Chapter Boss.
- **Trading arena.** A live candlestick market on a server clock (pause,
  next day, 1×/2×/4×), market, limit and stop-loss orders as they are taught,
  fees and a spread, named AI rivals on a live profit leaderboard, a calm news
  feed, missions and a results screen with key moments.
- **Daily challenge.** One scenario per weekday against one AI, unlocked by
  the Chapter 1 boss.
- **Practice arena.** Free practice markets against up to three AI rivals.
- **Quiz mode.** Chapter quizzes, a daily review and mixed mastery, plus
  classroom quiz rooms with a join code.
- **Multiplayer.** Private lobbies with a join code (for classes) and ranked
  matchmaking with Elo, unlocked by the Chapter 3 boss.
- **Profile.** Level and rank, badges, avatars and titles, an activity
  heatmap, a login streak, a shop (Doubloons and Gems) and leaderboards.

Profit decides every match. XP is never paid for placing orders.

## Run

From the repository root, use Node.js 24+, Python 3.12+ and uv 0.12.23 (the CI version):

```sh
npm ci
npm --prefix client ci
uv sync --project server --extra test --locked
npm run dev
```

In another terminal, from the same root:

```sh
uv run --project server --locked python -m uvicorn app.main:app --reload
```

The client runs on `http://localhost:5173` and the API on
`http://127.0.0.1:8000`. Local development uses guest sessions and SQLite
(`server/data/learning.db`).

## Check

```sh
npm run lint
npm run typecheck
npm run build
npm test
npm run api:check
uv run --project server --extra test --locked python -m unittest discover -s server/tests
uv run --project server --extra test --locked python -m app.content.validate
```

The backend suite includes the balance gauntlet
(`server/tests/test_game_balance.py`). Live PostgreSQL tests run only when
`TRADERS_EDGE_TEST_POSTGRES_URL` is set; see [deployment](docs/deployment.md).

## Status

The game loop, campaign, economy, quizzes and multiplayer are implemented and
tested locally. Not yet established:

- independent financial and pedagogical review of the content;
- real Firebase sign-in and a hosted deployment;
- any measured learning outcome. The decision score on the results screen is
  not validated.

## Documentation

- [Architecture overview](ARCHITECTURE.md) and the
  [build contract](docs/game-architecture.md)
- [Game design document](docs/game-design.md) (governs gameplay) and the
  [curriculum spec](docs/curriculum/game-spec.md)
- [Server guide](server/README.md) and [API guide](docs/api.md)
- [Campaign and progression](docs/adventure.md),
  [trading matches](docs/challenges.md), [engine model](docs/simulation-model.md),
  [economy](docs/economy.md), [quizzes](docs/quizzes.md),
  [multiplayer](docs/multiplayer.md)
- [Data model](docs/data-model.md), [research evidence](docs/research.md),
  [deployment](docs/deployment.md), [safety](docs/gamification-and-safety.md)
- [Decisions](docs/decisions/), [repository conventions](AGENTS.md),
  [contributing](CONTRIBUTING.md), [changelog](CHANGELOG.md)
