# Repository guide

Trader’s Edge: a FastAPI backend (`server/`) and a React, TypeScript and Vite
client (`client/`). Follow [CONTRIBUTING.md](CONTRIBUTING.md); it holds the
product rules, code rules, test rules and review requirements.

## Read first

- [Game design document](docs/game-design.md): governs gameplay. Flag any
  conflict between it and a task.
- [ARCHITECTURE.md](ARCHITECTURE.md) and the [docs index](docs/README.md):
  system layout and one reference doc per topic.
- [README.md](README.md): install, run and check commands (Node.js 24+,
  Python 3.12+, uv 0.12.23, locked dependencies, repository root).

## Constraints

- Verify claims against code, tests and configuration; docs can lag.
- `docs/source/` and `docs/game-design.md` are owner inputs: never edit them.
- `server/app/game/` must not know about chapters or currencies.
- Append migrations; never rewrite migrations 1–12.
- Never award XP for orders, trade count or volume; profit decides matches
  but is not learning evidence.
- `npm test` covers the client only; also run the backend suite and
  `python -m app.content.validate`.
- Format only changed files; `npm run format` rewrites the whole repository.
- Commits: concise imperative Conventional Commits under the existing git
  identity, with no co-author or tool attribution trailers.
- Do not delete files, push to shared branches or merge without explicit
  approval.

Pending, so never describe as done: independent content review (production
refuses gameplay until `server/app/content/review.json` is `approved`), real
Firebase sign-in, account deletion and retention, researcher access and any
measured learning outcome.
