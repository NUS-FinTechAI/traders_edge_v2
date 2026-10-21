# Contributing

Read [AGENTS.md](AGENTS.md) (repository rules), the
[game design document](docs/game-design.md) and the
[docs index](docs/README.md). [README.md](README.md) has the exact install,
run and check commands.

## Scope

- State the goal, observable done criteria, owned files and dependencies.
  Work in an isolated branch or worktree and keep the PR narrow.
- Distinguish `master`, open branches and merged behaviour. Report blockers
  honestly; never claim logs, tests, reviews or approvals that did not happen.
- Preserve research, audits, stable content ids, deployed migrations and
  player history.

## Styles

`client/ui/tokens.css` holds the shared tokens and `client/ui/global.css` the
base styles; feature styles go in the feature's CSS module (for example
`client/features/arena/trading/Trading.module.css`). The rules for adding
tokens are in the [design system](docs/product/design-system.md#visual-direction).

## Checks

Run the README checks: lint, type-check, build, client tests, the API contract
check, backend tests (with the balance gauntlet) and content validation. For
documentation changes, also check relative links and `git diff --check`, and
format only the files you changed. Report exact commands, results and any
checks not run.

UI changes: attach 390px before/after screenshots of the changed screens, the
states checked (loading, empty, error, locked, success), keyboard and focus
results and any checks not run to the PR, following the
[screenshot workflow](.devin/skills/capture-screenshots/SKILL.md). Commit a
dated evidence folder only when a reviewer asks for a retained record.

## Pull requests

Describe the change, the reason, acceptance evidence, baseline and branch
dependencies, and where reviewers should focus. Review ownership, unlocks,
privacy, idempotent settlement and order ids, restart and migration
behaviour, balance and reward safety. Content needs independent financial and
pedagogical approval; UI needs design and accessibility review. Merge only
after findings are resolved and CI passes. Update docs with behaviour changes
without describing pending work as complete.
