# Trader’s Edge

A mobile-first financial decision-making academy with simulated game challenges.

The connected app includes chapter maps and saved learning checks, planned trading
challenges against AI or other players, daily challenges, player rewards and
standalone/private classroom quizzes. See [live-app readiness](docs/readiness.md)
for the demonstrated flows, v1 comparison and remaining gameplay/deployment gaps.

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

## Check

```sh
npm run lint
npm run typecheck
npm run build
npm test
uv run --project server --extra test --locked python -m unittest discover -s server/tests
uv run --project server --extra test --locked python -m app.content.validate
uv run --project server --extra test --locked python -m unittest app.content.test_catalog
```

Run checks against the exact working tree. Run the explicit disposable PostgreSQL suite for live database evidence; local container startup is separate from hosted deployment and real Firebase verification. See [repository conventions](AGENTS.md), [contributing](CONTRIBUTING.md) and the [source index](docs/source/README.md).
