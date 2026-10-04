# Trader’s Edge

A mobile-first financial decision-making academy supported by a trading simulator.
The repository currently contains an empty React/TypeScript app and a FastAPI health endpoint. Product features follow discovery and design approval.

## Run

Use Node.js 24 or newer and Python 3.12 or newer.

```sh
npm ci
npm --prefix client ci
npm run dev
```

The client runs at http://localhost:5173. For the API, see [server/README.md](server/README.md).

## Check

```sh
npm run lint
npm run typecheck
npm run build
uv run --project server --extra test --locked python -m unittest discover -s server/tests
```

Install the server dependencies before running API tests. CI runs these checks on pull requests.
See [AGENTS.md](AGENTS.md) for repository conventions and [docs/plan.md](docs/plan.md) for phase gates.
