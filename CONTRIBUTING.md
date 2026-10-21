# Contributing

Read [AGENTS.md](AGENTS.md), the [game design document](docs/game-design.md) and the [build contract](docs/game-architecture.md). Use [README.md](README.md) for exact install/run/check commands. Treat plans and historical design evidence as proposals or dated records, not proof of merged functionality.

## Scope and delivery

- State the goal, observable done criteria, owned files and dependencies. Work in an isolated task branch/worktree and keep the PR narrow; never overwrite another branch's dirty changes. Frontend visual design remains a separate workstream.
- Distinguish `master`, open branches and merged contracts. Routine decisions are delegated, but independent correctness, safety, content and design reviews still apply.
- Use explicit session handoffs when ignored coordination storage is unavailable in the checkout. Report blockers honestly; do not claim logs, tests, reviews or approvals that did not happen.
- Preserve research, audits, stable content IDs, deployed migrations and learner history. Propose cleanup with KEEP/REFACTOR/REMOVE-CANDIDATE evidence, dependencies and consequences; deleting files requires specific confirmation.

## Shared theme

`client/ui/tokens.css` defines the shared colors, spacing, radii, type sizes and fonts; `client/ui/global.css` holds base styles. Use the existing semantic names such as `--bg`, `--surface`, `--text`, `--primary`, `--gain`, `--loss` and `--border`. Add a global token only when independent features share the visual role; do not put feature names or feature-only palettes in this file.

Keep feature-specific styles in the feature's CSS module (for example `client/features/arena/trading/Trading.module.css`). Prefer existing tokens, and keep layout rules local. Preserve provider logo artwork colors; they are not application theme colors. Verify contrast when changing the palette.

## Checks and review

Run lint, type-check, build, client tests, the API contract check, backend tests (including the balance gauntlet) and content validation using the locked commands in README. For documentation-only changes, also verify relative links/source paths and `git diff --check`; do not reformat unrelated files. Report exact commands, results and any checks not run. Test counts alone do not establish product completeness.

The PR description should include the change, reason, acceptance evidence, baseline/branch dependencies and reviewer focus. Review affected ownership, unlocks, privacy, idempotent settlement and order ids, restart/migration behavior, balance and reward safety. Product UI needs 390px evidence and accessibility/design review; content publication needs independent financial/pedagogical approval. Merge only after findings are resolved and CI passes. Update documentation with behavior changes, without describing pending contracts as complete.
