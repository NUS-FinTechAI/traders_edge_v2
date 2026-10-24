# Contributing

[README.md](README.md) has the install, run and check commands;
[ARCHITECTURE.md](ARCHITECTURE.md) and the [docs index](docs/README.md)
explain the system.

## Sources of truth

- The [game design document](docs/game-design.md) governs gameplay. Before
  changing gameplay, read the relevant sections and raise any conflict with
  the task.
- The [supervisor summary](docs/source/traders-edge-supervisor-summary.md)
  sets research, safety and evaluation goals; the
  [sample UI](docs/source/Trader_s_Edge_Sample_UI.jpg) fixes screen content,
  not appearance. Keep `docs/source/` unedited.
- [ADR 0004](docs/decisions/0004-playable-game-overhaul.md) records the current
  design. The [reference docs](docs/README.md#reference) describe what was
  built; when they disagree with the code, fix the doc.

## Product rules

- Teach in the curriculum's chapter order and enable each order type only
  after it is taught (the scenario's `allow`).
- One game plan per match (strategy and maximum loss); orders are one click.
- Profit decides every match. Missions, the plan review and the decision score
  are unvalidated process feedback; profit and ranked rating are game
  outcomes, not learning evidence.
- Never award XP for orders, trade count or volume. Badges reward process and
  are never sold.
- The server owns progression, ownership checks, hidden future bars and news,
  and settlement; every reward has one natural key.
- Fees and the spread make random clicking lose; keep the balance gauntlet
  passing without loosening its limits.
- No order confetti, urgent alerts, countdown timers, flashing prices,
  one-swipe execution, leverage, shorting or copy-trading, and no claim that
  the game makes players profitable. See
  [safety and wellbeing](docs/product/safety-and-wellbeing.md).

## Code and content

- Keep one modular backend. `server/app/game/` stays free of chapter and
  currency logic; extend the hooks in `campaign/` instead.
- Append database migrations; never edit a deployed one or discard saved
  games, progress or rewards.
- After a backend schema change run `npm run api:generate` and commit the
  generated client types.
- Extend the existing content formats ([authoring guide](docs/content/authoring.md)),
  keep ids stable, use fictional companies and bump a scenario's `version`
  when its market or missions change. Validation is not content review.
- UI follows the [design system](docs/product/design-system.md): 44px
  targets, visible focus, reduced motion, non-colour state labels. The owner
  approves the visual direction before replacement UI is built.
- No dead code, unused dependencies, filler comments or marketing language.
- No em dashes in code, copy or docs; `npm run lint` checks for them.

## Tests

- Add permanent tests for production behaviour only; delete temporary tests
  for development tooling after use.
- One behaviour per test, a descriptive name, Arrange–Act–Assert, observable
  behaviour rather than internals.
- Cover normal, edge and failure cases. Keep tests deterministic and
  independent: no reliance on execution order, shared mutable state, real
  network services or sleeps. Mock external services, never the behaviour
  under test.
- Never weaken assertions, skip tests or change expected results to make a
  test pass.

## Branches, commits and pull requests

- Branch from `master` as `feat/`, `fix/`, `docs/` or `chore/` plus a short
  scope; keep each PR narrow. Never force-push a shared branch.
- Write concise imperative [Conventional Commits](https://www.conventionalcommits.org/).
- Run the README checks. For documentation, also check relative links and
  format only the files you changed with
  `node node_modules/prettier/bin/prettier.cjs --write <files>`.
- Describe the change, the reason, the acceptance evidence and what reviewers
  should focus on. Report checks that could not run.
- UI changes: attach 390px before/after screenshots of the changed screens
  (360, 430 and 768px where layout changes), the states checked (loading,
  empty, error, locked, success) and keyboard and focus results.
- Reviews: rewards, simulation and copy need a safety review; content needs an
  independent financial and pedagogical review; UI needs a design and
  accessibility review. Check ownership, unlocks, privacy, idempotent
  settlement, restart and migration behaviour.
- Merge after findings are resolved and CI passes. Get explicit agreement
  before deleting files, and update the docs in the same PR as the behaviour
  they describe.
