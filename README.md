# Trader’s Edge

A mobile-first financial decision-making academy supported by a trading simulator.

The React/TypeScript client remains a setup screen with a tested HTTP service. The historical backend through `8098856` already provided guest sessions, Firebase token verification, SQLAlchemy persistence (local SQLite), learning checks, one-time XP, delayed reviews and saved, mastery-gated simulations. The ten-module catalog awaits independent content review; this is not a production-ready learning experience.

Merged backend PRs #24–30 add diagnostic, required/bonus, exit and delayed-review runs, finite reward inventory/activity and one bound `m05-l01` simulation audit. Edition `2026-10-04.4` (schema 1) has 30 entry items, 97 required steps (one simulation), 30 bonuses and 50 exit items. Migrations 3–4 preserve existing records. Merging is not deployment or a full v1 port: other lesson bindings, unseen review forms, tutorials and multiplayer remain pending. The teammate owns frontend design; the setup client is unchanged, PR #22 remains open and its dirty work is preserved. See the [server contract](server/README.md) and [teaching plan](docs/curriculum/README.md).

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

Client: http://localhost:5173. API schema: http://localhost:8000/docs. The setup screen does not call the API. See [API configuration](server/README.md) and the [HTTP service source](client/services/httpService.ts); use the same hostname for client/API guest cookies.

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

Run checks against the exact working tree; passing checks do not establish learning outcomes, publication approval or live PostgreSQL/deployment readiness. See [repository conventions](AGENTS.md), [contributing](CONTRIBUTING.md) and the [source brief](docs/source/traders-edge-supervisor-summary.md).
