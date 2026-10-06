# Contributing

Read [AGENTS.md](AGENTS.md) and the [source brief](docs/source/traders-edge-supervisor-summary.md). Use [README.md](README.md) for exact install/run/check commands. Treat plans and historical design evidence as proposals or dated records, not proof of merged functionality.

## Scope and delivery

- State the goal, observable done criteria, owned files and dependencies. Work in an isolated task branch/worktree and keep the PR narrow; never overwrite another branch's dirty changes. Frontend visual design remains a separate workstream.
- Distinguish `master`, PR #22's connected client and merged interactive backend (#24–30) contracts. Routine decisions are delegated, but independent correctness, safety, content and design reviews still apply.
- Use explicit session handoffs when ignored coordination storage is unavailable in the checkout. Report blockers honestly; do not claim logs, tests, reviews or approvals that did not happen.
- Preserve research, audits, stable content IDs, deployed migrations and learner history. Propose cleanup with KEEP/REFACTOR/REMOVE-CANDIDATE evidence, dependencies and consequences; deleting files requires specific confirmation.

## Checks and review

Run lint, type-check, build, HTTP-service tests, backend tests, catalog validation and catalog tests using the locked commands in README. For documentation-only changes, also verify relative links/source paths and `git diff --check`; do not reformat unrelated files. Report exact commands, results and any checks not run. Test counts alone do not establish product completeness.

The PR description should include the change, reason, acceptance evidence, baseline/branch dependencies and reviewer focus. Review affected ownership, prerequisites, privacy, same-key replay, restart/migration behavior and reward safety. Product UI needs 390px evidence and accessibility/design review; content publication needs independent financial/pedagogical approval. Merge only after findings are resolved and CI passes. Update documentation with behavior changes, without describing pending contracts as complete.
