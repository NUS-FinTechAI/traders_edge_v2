# Trader’s Edge

A mobile-first financial decision-making academy with simulated game challenges. The owner-selected [game design brief](docs/source/traders-edge-game-design-brief.txt) governs gameplay; [ADR 0003](docs/decisions/0003-gameplay-brief-authority.md) records how it supersedes conflicting earlier rules.

The React/TypeScript client remains a setup screen with a tested HTTP service. The historical backend through `8098856` already provided guest sessions, Firebase token verification, SQLAlchemy persistence (local SQLite), learning checks, one-time XP, delayed reviews and saved, mastery-gated simulations. The ten-module catalog awaits independent content review; this is not a production-ready learning experience.

Merged backend PRs #24–30 add diagnostic, required/bonus, exit and delayed-review runs, finite reward inventory/activity and one bound `m05-l01` simulation audit. Edition `2026-10-04.4` (schema 1) has 30 entry items, 97 required steps (one simulation), 30 bonuses and 50 exit items. Migrations 3–4 preserve existing records. Other lesson bindings, unseen review forms and tutorials remain pending; this is not a full v1 port. The teammate owns frontend design; the setup client is unchanged, PR #22 remains open and its dirty work is preserved. See the [server contract](server/README.md) and [teaching plan](docs/curriculum/README.md).

PRs #36–40 adopt the supplied brief and add persisted shared challenges against simulated opponents, chapter entry/exit bosses and early chapter access, a common UTC daily challenge, login rewards, weekly Stocks, earned-premium accounting, finite shop purchases and derived player level. Learning mastery, learning XP and learning activity remain distinct from game outcomes. See [challenge](docs/challenges.md), [adventure](docs/adventure.md) and [economy](docs/economy.md) contracts. PR #43 adds standalone and private classroom [quizzes](docs/quizzes.md), with server-configured instructors, pinned attempts and withheld feedback. PR #44 adds [private/public human multiplayer](docs/multiplayer.md), shared observations, Elo rating and public-match game rewards. PR #45 adds [owned evidence exports and separately gated study metadata](docs/research.md); enrollment defaults off, and account deletion, retention, researcher access and validated learning rubrics remain unfinished.

PR #37 adds guarded live PostgreSQL tests and a reproducible production-configured container stack. PostgreSQL 16 transactions and local container startup were verified on 6 October 2026. Actual Firebase sign-in, a hosted destination, independent content approval and learning outcomes remain unverified; see [deployment evidence](docs/deployment.md).

Runtime verification on 6 October 2026 passed 277 backend tests, including 51 live PostgreSQL cases, 22 catalog tests and 14 frontend service tests. The rebuilt local production-configured API uses migrations 1–10, runs as user 10001 and matches all 47 tracked application files at the tested revision. Health and missing-token rejection establish local startup, not real Firebase sign-in or hosted release.

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

Run checks against the exact working tree; passing checks do not establish learning outcomes or publication approval. Run the explicit disposable PostgreSQL suite for live database evidence; local container startup is separate from hosted deployment and real Firebase verification. See [repository conventions](AGENTS.md), [contributing](CONTRIBUTING.md) and the [source index](docs/source/README.md).
