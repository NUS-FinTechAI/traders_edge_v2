# Repository guide

## Sources of truth

- The [game design document](docs/game-design.md) governs gameplay. Before
  changing gameplay, read the relevant sections, follow them, and highlight
  any conflict with the task.
- The [supervisor summary](docs/source/traders-edge-supervisor-summary.md)
  sets research, safety and evaluation goals. The
  [sample UI](docs/source/Trader_s_Edge_Sample_UI.jpg) fixes screen content and
  mechanics, not appearance. Keep `docs/source/` verbatim.
- [ADR 0004](docs/decisions/0004-playable-game-overhaul.md) records the current
  design; ADRs 0001–0003 are partly superseded.
- The [reference docs](docs/README.md#reference) describe what was built; the
  [curriculum spec](docs/content/curriculum-spec.md) is the content design
  source. Verify claims against code, tests and configuration at the named
  commit. [docs/archive/](docs/archive/) is history, not current behaviour.
- The sibling `traders_edge` repository is read-only discovery material.

## Map

- [client/](client/): React 19, TypeScript, Vite; see
  [ARCHITECTURE.md](ARCHITECTURE.md#client).
- [server/app/](server/app/): one FastAPI backend.
  [game/](server/app/game/) is the trading engine and stays free of chapter
  and currency logic (extend the hooks instead);
  [campaign/](server/app/campaign/), [player/](server/app/player/),
  [quiz/](server/app/quiz/), [multiplayer/](server/app/multiplayer/),
  [research.py](server/app/research.py) and the authored
  [content/](server/app/content/). See [ARCHITECTURE.md](ARCHITECTURE.md).
- [Migrations](server/app/migrations.py) 1–12: 1–10 belong to the removed
  system and stay frozen; 11 adds game tables, 12 campaign, quiz, lobby and
  rating tables ([data model](docs/reference/data-model.md)).
- [docs/](docs/README.md): product, reference, content, operations, decisions
  and archive.
- [.devin/skills/](.devin/skills/): workflows for
  [content](.devin/skills/add-lesson/SKILL.md),
  [scenarios](.devin/skills/add-scenario-pack/SKILL.md),
  [rewards](.devin/skills/add-badge-or-reward/SKILL.md),
  [safety review](.devin/skills/safety-review-checklist/SKILL.md),
  [design review](.devin/skills/design-review/SKILL.md),
  [screenshots](.devin/skills/capture-screenshots/SKILL.md),
  [ADRs](.devin/skills/write-adr/SKILL.md) and
  [PR review](.devin/skills/run-pr-review/SKILL.md). Report checks they name
  that are unavailable.

Implemented and tested locally: game loop, campaign, economy, quizzes,
multiplayer. Pending: independent content review (production refuses gameplay
until `server/app/content/review.json` is `approved`), real Firebase sign-in,
hosted deployment, account deletion and retention, researcher access and any
validated learning measure.

## Commands

Node.js 24+, Python 3.12+, uv 0.12.23, run from the repository root with
locked dependencies. [README.md](README.md) lists install, run and check
commands; the [server guide](server/README.md) covers configuration and
deployment limits.

- `npm test` runs client tests only; the backend suite (with the balance
  gauntlet) and `python -m app.content.validate` are separate.
- `npm run lint` runs Oxlint and the formatting check.
- After backend schema changes run `npm run api:generate`; CI runs
  `npm run api:check`.
- Format only the files you changed:
  `node node_modules/prettier/bin/prettier.cjs --write <files>`. Never run
  `npm run format` during a narrow task; it rewrites the repository.

## Product rules

- Follow the curriculum's chapter order; enable each order type only after it
  is taught (the scenario's `allow`).
- One game plan per match (strategy and maximum loss) in the briefing; orders
  are one click with no per-order plan.
- Rank every match by profit. Missions, the plan review and the decision score
  are unvalidated process feedback; match profit and ranked rating are game
  outcomes, not learning evidence.
- Never award XP for orders, trade count or volume. Keep earned badges
  distinct from shop cosmetics and never present rewards as validated
  competence.
- Preserve server-owned progression, ownership checks, hidden future bars and
  news, and natural-key idempotency (one reward per key, one settlement per
  participant).
- Solo matches run on a server clock with pause, step and 1×/2×/4×;
  multiplayer runs at a fixed pace with no pause. News stays in a calm feed.
- Fees and the spread defend against button-smashing; keep the balance
  gauntlet passing without loosening its limits.
- No order confetti, urgent alerts, countdown timers, flashing prices,
  one-swipe execution, leverage, shorting or copy-trading. Never claim the app
  makes learners profitable. Keep region-specific rules in localization packs
  ([safety](docs/product/safety-and-wellbeing.md)).

## Architecture rules

- One modular backend, not microservices.
- Append migrations; never rewrite a deployed one. Preserve saved games,
  progress and rewards.
- [SQLite/mocked-Firebase tests](server/tests/test_auth_consistency.py)
  establish ORM semantics only; the
  [live PostgreSQL suite](server/tests/test_postgres_integration.py) verifies
  lock waiting, concurrent awards, populated upgrades and replay across
  workers. Neither establishes real Firebase sign-in, hosting or learning
  efficacy ([deployment](docs/operations/deployment.md)).

## Content rules

- Extend the existing JSON formats in the
  [authoring guide](docs/content/authoring.md) and
  [validator](server/app/content/validate.py); do not invent a parallel format.
- Fictional companies; one obvious lesson per scenario; idle and random
  players must lose where the balance class is gated.
- Bump a scenario's `version` when its market or missions change.
- Validation and the gauntlet are not independent financial or pedagogical
  review.

## Design rules

- The owner selects the visual direction before final specifications or
  product UI; replacement UI also needs a separate go-ahead after technical
  and safety review. Record alternatives and independent critique.
- Follow the [design system](docs/product/design-system.md): treasure-map
  navigation with real meaning; no navy/neon, glowing hexagons, glass
  gradients or fantasy-map textures; 44px targets, visible focus, reduced
  motion and non-colour state labels.
- Keep frontend visual work in its own task scope and never overwrite another
  worktree's dirty changes.

## Work and review

- Branches: `chore/`, `docs/`, `feat/` or `fix/` plus a short scope. Declare
  owned files and dependencies; keep PRs narrow.
- Use the existing git identity and concise imperative Conventional Commits.
  No tool attribution, persona names or co-author trailers. Never force-push
  shared branches.
- `.coordination/` is not available in this checkout: use explicit session
  handoffs (ownership, findings, checks, open dependencies) and never claim a
  log was updated. Put durable decisions in the right existing doc.
- Review every PR independently for correctness, scope, tests and plain
  language. Rewards, simulation and copy need safety review; content needs
  financial and pedagogical review; product UI needs design and accessibility
  review. Delegation waives none of these and authorises no destructive
  operation.
- Propose cleanup as KEEP, REFACTOR or REMOVE-CANDIDATE with evidence; get
  specific confirmation before deleting files. Preserve research and audit
  evidence.
- No filler comments, invented citations, marketing language, decorative
  emoji, dead code, unused dependencies, or unfinished work described as
  complete. Keep research claims, targets, branch work and merged behaviour
  distinct.

## Testing

- Permanent tests only for production behaviour. Temporary tests for
  development-only code are allowed when needed and deleted after
  verification; never commit them.
- One behaviour per test, a descriptive name, Arrange–Act–Assert, observable
  behaviour rather than internals.
- Cover normal, edge and failure cases. Keep tests independent and
  deterministic: no execution-order dependence, shared mutable state, real
  network services or arbitrary sleeps. Mock external dependencies, never the
  behaviour under test. Keep setup minimal and follow existing conventions.
- Never weaken assertions, skip tests or change expected results to make a
  test pass. Run the relevant tests and report what ran, what failed and what
  could not run.

## Definition of done

State the goal and observable acceptance criteria first. Relevant checks and
CI pass, documentation matches the named baseline, and independent reviewers'
findings are resolved before merge. Verify success, rejection, retry/reload
and migration paths for affected contracts. Product UI also needs 390px
before/after evidence and design/accessibility review. Do not report a phase
or the learning workflow complete while approval, integration or evidence is
missing.
