# Trader’s Edge

A mobile-first financial learning application with a controlled trading simulator. The ten-module curriculum starts with essential money and risk before execution or advanced products. Learning progress and XP reflect reasoning checks, never virtual profit or trading volume.

The current backend includes persistent profiles, lessons, module checks, delayed review, a private journal and an opt-in learning leaderboard. The deterministic simulation engine supports written plans, transaction costs and partial fills. Content is authored but awaits independent financial-accuracy review; production publication is gated. See [implementation status](docs/plan.md) for current delivery limits and the [selected design reference](docs/design/explorations/review.md).

## Run locally

Requires Node.js 24, Python 3.12+ and uv 0.12.23. No Docker is needed.

```sh
npm ci && npm --prefix client ci
uv sync --project server --extra test --locked
```

Run `npm run dev` for the client and, in another terminal, `uv run --project server --locked python -m uvicorn app.main:app --reload` for the API. Use `localhost` consistently: client `http://localhost:5173`, API `http://localhost:8000`, endpoint reference `http://localhost:8000/docs`.

Local progress is stored in `server/data/learning.db`. Guest access uses a browser cookie; clearing it loses access to that guest profile. [API setup](server/README.md) covers configuration and the production boundary.

## Verify

```sh
npm run lint && npm run typecheck && npm run build
uv run --project server --extra test --locked python -m unittest discover -s server/tests
uv run --project server --locked python -m app.content.validate
uv run --project server --locked python -m unittest app.content.test_catalog
```

Start with [AGENTS.md](AGENTS.md) for repository conventions, [ARCHITECTURE.md](ARCHITECTURE.md) for ownership and data flow, and [CONTRIBUTING.md](CONTRIBUTING.md) for review. The [curriculum contract](docs/curriculum/README.md), [simulation model](docs/simulation-model.md) and [source brief](docs/source/traders-edge-supervisor-summary.md) explain the product’s learning and safety constraints.
