# Repository guide

## Scope and source order

This is v2. The sibling `traders_edge` repository is read-only discovery material. Read the preserved [supervisor summary](docs/source/traders-edge-supervisor-summary.md) alongside the [game design document](docs/game-design.md); the game design document governs conflicting gameplay requirements. See [ADR 0003](docs/decisions/0003-gameplay-brief-authority.md) for the historical source-authority decision. The [sample image](docs/source/Trader_s_Edge_Sample_UI.jpg) specifies screen content and mechanics, not appearance. Verify implementation claims against code, tests and configuration at the named branch/commit; historical audits and design proposals are not current runtime contracts.

## Map and current boundary

- [client/](client/): React, TypeScript and Vite. [App.tsx](client/App.tsx) remains a setup screen; [services/httpService.ts](client/services/httpService.ts) is tested but not connected to it. The connected client is separate, open work in PR #22; preserve its dirty worktree and the teammate’s visual design.
- [server/app/](server/app/): one FastAPI backend with guest/Firebase authentication, SQLAlchemy persistence, ordered migrations, learning/progression and saved simulation commands. Local development uses SQLite; production configuration requires verified Firebase identity and rejects SQLite.
- [server/app/content/](server/app/content/): the canonical private ten-module catalog, loader, validator and tests. Every module has `entry_tasks`; all 30 levels have instruction/choice/classification `tasks` and verified optional `bonus_tasks`; `m05-l01` also has a simulation audit. These are decision exercises, not execution of the full v1 scenarios.
- [server/app/learning_runs.py](server/app/learning_runs.py): owned, version-pinned learning/review runs, grading, maps/workflow and exact replay. Migration 3 adds only run/command tables. [simulation/lesson_api.py](server/app/simulation/lesson_api.py) and [bindings.py](server/app/simulation/bindings.py) constrain `m05-l01` and its dedicated audit; ordinary routes enforce that same policy.
- [server/app/rewards.py](server/app/rewards.py): finite learning policy, claims/equipment and UTC learning activity. Migration 4 adds only reward grants/commands and two nullable profile equipment columns; migrations 1–3 remain frozen.
- [server/app/challenges/](server/app/challenges/) and [gameplay.py](server/app/gameplay.py): shared synthetic challenges, chapter bosses/access and daily forms. Migrations 5 and 7 append challenge attempts/commands, common definitions and chapter evidence.
- [server/app/economy.py](server/app/economy.py) and [economy_models.py](server/app/economy_models.py): separate game currency, login claims/cooldown refresh/shop and player-level policy. Migration 6 appends accounts/events/commands. Game events do not create learning days or learning-earned badges.
- [server/app/quizzes/](server/app/quizzes/): supplementary standalone and private classroom quizzes. Migration 8 appends rooms, membership, attempts and receipts; instructor authorization is server-configured and private rooms grant no XP.
- [server/app/multiplayer/](server/app/multiplayer/): shared private code lobbies/public paired matches, observation barriers, Elo and transactional public rewards. Migration 9 appends lobby/member/command/queue/rating/throttle tables. Private access requires mastery of chapters 1–4; public requires 1–9.
- [server/app/research.py](server/app/research.py) and [research_models.py](server/app/research_models.py): owned evidence downloads and separately configured study metadata/consent/withdrawal. Migration 10 appends metadata and command receipts. Enrollment defaults off; accepted text/digest is pinned and analytics consent remains separate.
- [docs/source/](docs/source/): preserved gameplay/research briefs and screen reference. Keep source files verbatim.
- [docs/v1-audit/](docs/v1-audit/): source-backed inventories and migration evidence; preserve their historical scope.
- [docs/design/](docs/design/): historical prototypes, design constraints and review evidence, not shipped UI.
- [docs/decisions/](docs/decisions/): durable decisions and consequences. Distinguish proposals from implementation.
- [.devin/skills/](.devin/skills/): the [content](.devin/skills/add-lesson/SKILL.md), [scenario](.devin/skills/add-scenario-pack/SKILL.md), [reward](.devin/skills/add-badge-or-reward/SKILL.md), [safety](.devin/skills/safety-review-checklist/SKILL.md), [design](.devin/skills/design-review/SKILL.md), [screenshot](.devin/skills/capture-screenshots/SKILL.md), [decision](.devin/skills/write-adr/SKILL.md) and [PR-review](.devin/skills/run-pr-review/SKILL.md) workflows. Follow the actual branch contracts and report unavailable checks.

Merged backend PRs #24–30 add reviewed diagnostic, required/optional, exit and delayed-review runs, finite rewards/activity and one bound `m05-l01` simulation audit to the existing backend foundations. Merging does not establish deployment or independent content approval. Edition `2026-10-04.4`, schema 1, has 30 entries, 97 required steps (one simulation), 30 bonuses and 50 exits. PRs #38–40 add shared simulated opponents, chapter entry/exit bosses and early chapter access, common daily challenges and game economy. Other lesson bindings, Module 9 multi-scenario missions, news/tutorial interactions, unfamiliar review forms, advanced execution, account deletion/retention, researcher access and validated learning rubrics remain pending. PR #43 adds standalone/classroom quiz contracts with server-only instructor authorization and frozen first answers. Learning inventory supplies six code-policy items; the separate economy supplies finite shop items and a derived player-level policy, not artwork. PRs #44–45 add shared human multiplayer/public Elo and three owner-scoped evidence exports with default-off study metadata/consent/withdrawal. These contracts do not establish approved participant evaluation. Guided simulation requires modules 1–4; bounded endless scenarios require modules 1–9. Private human lobbies require chapters 1–4; public matchmaking requires chapters 1–9. Boss-earned access does not mark earlier modules mastered or bypass these practice prerequisites. See [Server README](server/README.md) for the actual contracts; eligibility alone does not implement a mode.

## Commands

Use Node.js 24+, Python 3.12+ and uv 0.12.23. Run from the repository root; [README.md](README.md) lists the exact install, two-terminal run and CI check commands. `npm test` runs the HTTP-service tests; backend discovery and catalog tests are separate commands. `npm run lint` runs Oxlint and formatting checks, despite the internal `lint:eslint` script name. Use locked Python dependencies. See [Server README](server/README.md) for configuration, authentication and deployment limits.

For scoped documentation changes, invoke the installed root formatter explicitly, for example `node node_modules/prettier/bin/prettier.cjs --check README.md AGENTS.md`, listing only authorized changed files. `npm run format` rewrites the repository; do not use it to fix unrelated formatting during a narrow task.

## Product and architecture constraints

Teach readiness and risk before execution, strategies or advanced products. Require a written plan before every simulated trade, not every quiz choice. Assess risk recognition, calibration, plan adherence and reflection; current text-presence checks do not establish reasoning quality. Rank simulated competitions by net portfolio profit as the [game design document](docs/game-design.md) requires, and award their versioned game rewards. Never treat profit as proof of learning or award XP for individual orders, trade count or volume. Preserve server-owned progression, ownership checks, hidden future state and same-response command replay.

Keep one modular backend, not microservices. Extend existing content and persistence contracts; migration 3 added only two run-related tables and reused existing attempts and XP records. Broader entity diagrams are targets, not instructions to build every abstraction now. The later reward slice uses migration 4's two reward tables and two nullable profile columns only. Append [migrations](server/app/migrations.py) rather than rewriting deployed versions; preserve saved attempts, progress, simulation state and rewards. [SQLite/mocked-Firebase profile-refresh tests](server/tests/test_auth_consistency.py) establish ORM semantics; the separate [live PostgreSQL suite](server/tests/test_postgres_integration.py) verifies actual profile-lock waiting/refresh, shared aggregates, populated migration preservation and replay across workers/restart. Docker and PostgreSQL 16 were available on 6 October 2026, and the production-configured local container started with fail-closed authentication. These checks do not establish real Firebase sign-in, hosted deployment or learning efficacy; see [deployment.md](docs/deployment.md).

Challenge profit results and public multiplayer rating are separate from learning evidence. No order confetti, urgent market alerts, countdowns, flashing hot-stock displays, one-swipe execution, default leverage or copy-trading. Keep rewarded-learning activity distinct from the new daily login streak and its game rewards. Never claim the app makes learners profitable. Keep region-specific rules in localization packs.

## Design and content review

Routine backend implementation decisions are delegated within the authorized scope. The owner must select a visual direction before final design specifications or product UI; replacement UI implementation also requires a separate go-ahead after technical and safety review. Static concepts may support that selection. Record alternatives and independent critique. Historical design selection is not approval of the reopened design. Keep frontend visual work in its separate task scope; do not overwrite another worktree's dirty changes.

No navy/neon styling, glowing hexagons, glass gradients or fantasy-map textures. Use the required treasure-map metaphor with accessible, meaningful navigation. Follow [design checklist](docs/design/anti-slop-checklist.md). Minimum touch target is 44px; support visible focus, reduced motion and non-color state labels. Refer to the [Sample UI](docs/source/Trader_s_Edge_Sample_UI.jpg) for expected UI layouts.

The authoring contract is in [curriculum authoring guide](docs/curriculum/README.md), [Server README](server/README.md) and [catalog validator](server/app/content/validate.py); extend the canonical catalog rather than inventing a parallel runtime format. Every module's `entry_tasks`, lesson `tasks` and `bonus_tasks` are executable decision practice; the older module-level reflection prompts remain `content_only`. Lessons need source basis and objectives; scenarios need provenance, seed, friction and private future state. Pin task/rubric versions in new runs and keep diagnostic/exit/review feedback hidden until the form completes. Review failure uses the pinned interval; bound simulation audits use their dedicated payload without changing [StepAnswer](server/app/api_schemas/learning_run_schema.py) hashing. Fresh audits must echo the latest public `observation_token`, including after same-tick order changes; historical committed tokenless audits still replay. Verify ordinary routes enforce bound policy and replay precedes fresh gates. Keep existing learning-earned badges distinct from game challenge cosmetics; never reward trading frequency or present challenge rewards as validated competence. Catalog validation is not independent financial/pedagogical review; production must continue refusing unapproved content.

## Game Design

The [game design document](docs/game-design.md) is the source of truth for gameplay requirements.

Before implementing or changing gameplay features:

1. Read the latest version of the relevant sections.
2. Follow the requirements described in the document.
3. If the document conflicts with the current task, highlight the conflict.

## Work and review

Use isolated task branches named `chore/short-scope`, `docs/short-scope`, `feat/short-scope` or `fix/short-scope`. Declare owned files and dependencies; keep PRs narrow and coordinate integration across branches. Use the existing git identity and concise imperative Conventional Commit messages. Do not add tool attribution, persona names or coauthor trailers to tracked work or git history. Do not force-push shared branches.

The ignored `.coordination/` directory is the intended task/review log, but it is unavailable in this publication checkout. Use explicit session handoffs to state ownership, findings, checks and unresolved dependencies; do not claim persistent logs were updated. Distill durable decisions into the appropriate existing documentation within the authorized scope.

Review every PR independently for correctness, scope, tests and plain language. Rewards, simulation and copy need safety review; content needs financial/pedagogical review; product UI needs design/accessibility review. Delegation does not waive those reviews or authorize destructive operations. Inventory cleanup as KEEP, REFACTOR or REMOVE-CANDIDATE with evidence and consequences; obtain specific confirmation before deleting files. Preserve research and audit evidence rather than treating length as proof of uselessness.

No filler comments, invented citations, marketing language, decorative emoji, dead code, unused dependencies or unfinished functionality described as complete. Separate research claims, target contracts, branch work and merged behavior.

## Testing

### Test Scope

- Only create permanent tests for production code that affects application behavior, business logic, or user-facing functionality.
- Do not create permanent tests for development-only code, including development scripts, debugging utilities, mock data generators, and temporary tooling.
- Temporary tests for development-only code are allowed only when necessary to verify an implementation. Delete them immediately after verification.
- Do not add development-only tests to the permanent test suite or include them in commits.

### Test Design

- Each test case should verify one behavior or scenario. Multiple assertions are acceptable when they support the same behavior.
- Use descriptive test names that state the condition and expected outcome.
- Follow the Arrange–Act–Assert structure: prepare the inputs, perform the action, and verify the result.
- Test observable behavior rather than internal implementation details.
- Cover normal behavior, relevant edge cases, and expected failure conditions.
- Keep tests independent and deterministic. Avoid dependencies on execution order, shared mutable state, real network services, or arbitrary delays.
- Mock external dependencies when needed, but do not mock the behavior being tested.
- Keep test setup minimal. Reuse fixtures or helpers when they improve clarity.
- Follow the project's existing testing framework, conventions, and file structure.

### Test Execution

- Never weaken assertions, skip tests, or change expected results merely to make a failing test pass.
- Run relevant tests after making changes.
- Report which tests were run, any failures, and any tests that could not be executed.

## Definition of done

State the goal and observable acceptance criteria before implementation. Relevant checks pass, documentation matches the named baseline, independent reviewers resolve findings and CI passes before merge. Verify success, rejection, retry/reload and migration paths for affected contracts. Product UI also needs 390px before/after evidence and accessibility/design review. Do not report a phase or the full learning workflow complete while approval, integration or evidence is missing.
