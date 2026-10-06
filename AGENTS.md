# Repository guide

## Scope and source order

This is v2. The sibling `traders_edge` repository is read-only discovery material. The owner selected `docs/source/traders-edge-game-design-brief.txt` as the product direction on 6 October 2026. Read it alongside the preserved supervisor summary; the newer brief governs conflicting gameplay requirements. See `docs/decisions/0003-gameplay-brief-authority.md`. The sample image specifies screen content and mechanics, not appearance. Verify implementation claims against code, tests and configuration at the named branch/commit; historical audits and design proposals are not current runtime contracts.

## Map and current boundary

- `client/`: React, TypeScript and Vite. `App.tsx` remains a setup screen; `services/httpService.ts` is tested but not connected to it. The connected client is separate, open work in PR #22; preserve its dirty worktree and the teammate’s visual design.
- `server/app/`: one FastAPI backend with guest/Firebase authentication, SQLAlchemy persistence, ordered migrations, learning/progression and saved simulation commands. Local development uses SQLite; production configuration requires verified Firebase identity and rejects SQLite.
- `server/app/content/`: the canonical private ten-module catalog, loader, validator and tests. Every module has `entry_tasks`; all 30 levels have instruction/choice/classification `tasks` and verified optional `bonus_tasks`; `m05-l01` also has a simulation audit. These are decision exercises, not execution of the full v1 scenarios.
- `server/app/learning_runs.py`: owned, version-pinned learning/review runs, grading, maps/workflow and exact replay. Migration 3 adds only run/command tables. `simulation/lesson_api.py` and `bindings.py` constrain `m05-l01` and its dedicated audit; ordinary routes enforce that same policy.
- `server/app/rewards.py`: finite code policy, claims/equipment and UTC learning activity. Migration 4 adds only reward grants/commands and two nullable profile equipment columns; migrations 1–3 remain frozen.
- `docs/source/`: preserved research brief and screen reference. Keep source files verbatim.
- `docs/v1-audit/`: source-backed inventories and migration evidence; preserve their historical scope.
- `docs/design/`: historical prototypes, design constraints and review evidence, not shipped UI.
- `docs/decisions/`: durable decisions and consequences. Distinguish proposals from implementation.
- `.devin/skills/`: the eight content, scenario, reward, safety, design, screenshot, decision and PR-review workflows. Follow the actual branch contracts and report unavailable checks.

Merged backend PRs #24–30 add reviewed diagnostic, required/optional, exit and delayed-review runs, finite rewards/activity and one bound `m05-l01` simulation audit to the existing backend foundations. Merging does not establish deployment or independent content approval. Edition `2026-10-04.4`, schema 1, has 30 entries, 97 required steps (one simulation), 30 bonuses and 50 exits. Other lesson bindings, Module 9 multi-scenario missions, news/tutorial interactions, unfamiliar review forms, advanced execution and multiplayer remain pending. Inventory supplies six code-policy items, not visual assets or player-level/multiplayer-rank policy. Guided simulation requires modules 1–4; bounded endless scenarios require modules 1–9. See `server/README.md` for the actual contracts; eligibility alone does not implement a mode.

## Commands

Use Node.js 24+, Python 3.12+ and uv 0.12.23. Run from the repository root; [README.md](README.md) lists the exact install, two-terminal run and CI check commands. `npm test` runs the HTTP-service tests; backend discovery and catalog tests are separate commands. `npm run lint` runs Oxlint and formatting checks, despite the internal `lint:eslint` script name. Use locked Python dependencies. See `server/README.md` for configuration, authentication and deployment limits.

For scoped documentation changes, invoke the installed root formatter explicitly, for example `node node_modules/prettier/bin/prettier.cjs --check README.md AGENTS.md`, listing only authorized changed files. `npm run format` rewrites the repository; do not use it to fix unrelated formatting during a narrow task.

## Product and architecture constraints

Teach readiness and risk before execution, strategies or advanced products. Require a written plan before every simulated trade, not every quiz choice. Assess risk recognition, calibration, plan adherence and reflection; current text-presence checks do not establish reasoning quality. Rank simulated competitions by net portfolio profit as the supplied brief requires, and award their versioned game rewards. Never treat profit as proof of learning or award XP for individual orders, trade count or volume. Preserve server-owned progression, ownership checks, hidden future state and same-response command replay.

Keep one modular backend, not microservices. Extend existing content and persistence contracts; migration 3 added only two run-related tables and reused existing attempts and XP records. Broader entity diagrams are targets, not instructions to build every abstraction now. The later reward slice uses migration 4's two reward tables and two nullable profile columns only. Append migrations rather than rewriting deployed versions; preserve saved attempts, progress, simulation state and rewards. Profile-lock refresh tests use SQLite/mocked Firebase and do not prove live PostgreSQL locking. The latest Docker check could not connect to the daemon socket, so live PostgreSQL remains unverified. Do not infer deployment or learning efficacy from local tests.

Challenge profit results and public multiplayer rating are separate from learning evidence. No order confetti, urgent market alerts, countdowns, flashing hot-stock displays, one-swipe execution, default leverage or copy-trading. Keep rewarded-learning activity distinct from the new daily login streak and its game rewards. Never claim the app makes learners profitable. Keep region-specific rules in localization packs.

## Design and content review

Routine backend implementation decisions are delegated within the authorized scope. The owner must select a visual direction before final design specifications or product UI; replacement UI implementation also requires a separate go-ahead after technical and safety review. Static concepts may support that selection. Record alternatives and independent critique. Historical design selection is not approval of the reopened design. Keep frontend visual work in its separate task scope; do not overwrite another worktree's dirty changes.

No navy/neon styling, glowing hexagons, glass gradients or fantasy-map textures. Use the required treasure-map metaphor with accessible, meaningful navigation. Follow `docs/design/anti-slop-checklist.md`. Minimum touch target is 44px; support visible focus, reduced motion and non-color state labels.

The authoring contract is in `docs/curriculum/README.md`, `server/README.md` and `server/app/content/validate.py`; extend the canonical catalog rather than inventing a parallel runtime format. Every module's `entry_tasks`, lesson `tasks` and `bonus_tasks` are executable decision practice; the older module-level reflection prompts remain `content_only`. Lessons need source basis and objectives; scenarios need provenance, seed, friction and private future state. Pin task/rubric versions in new runs and keep diagnostic/exit/review feedback hidden until the form completes. Review failure uses the pinned interval; bound simulation audits use their dedicated payload without changing `StepAnswer` hashing. Fresh audits must echo the latest public `observation_token`, including after same-tick order changes; historical committed tokenless audits still replay. Verify ordinary routes enforce bound policy and replay precedes fresh gates. Keep existing learning-earned badges distinct from game challenge cosmetics; never reward trading frequency or present challenge rewards as validated competence. Catalog validation is not independent financial/pedagogical review; production must continue refusing unapproved content.

## Work and review

Use isolated task branches named `chore/short-scope`, `docs/short-scope`, `feat/short-scope` or `fix/short-scope`. Declare owned files and dependencies; keep PRs narrow and coordinate integration across branches. Use the existing git identity and concise imperative Conventional Commit messages. Do not add tool attribution, persona names or coauthor trailers to tracked work or git history. Do not force-push shared branches.

The ignored `.coordination/` directory is the intended task/review log, but it is unavailable in this publication checkout. Use explicit session handoffs to state ownership, findings, checks and unresolved dependencies; do not claim persistent logs were updated. Distill durable decisions into the appropriate existing documentation within the authorized scope.

Review every PR independently for correctness, scope, tests and plain language. Rewards, simulation and copy need safety review; content needs financial/pedagogical review; product UI needs design/accessibility review. Delegation does not waive those reviews or authorize destructive operations. Inventory cleanup as KEEP, REFACTOR or REMOVE-CANDIDATE with evidence and consequences; obtain specific confirmation before deleting files. Preserve research and audit evidence rather than treating length as proof of uselessness.

No filler comments, invented citations, marketing language, decorative emoji, dead code, unused dependencies or unfinished functionality described as complete. Separate research claims, target contracts, branch work and merged behavior.

## Test

Each test case should verify one behavior or scenario. Multiple assertions are acceptable when they support the same behavior. Use descriptive test names that state the condition and expected outcome. 
Follow the Arrange–Act–Assert structure: prepare the inputs, perform the action, and verify the result. Test observable behavior rather than internal implementation details.

Cover normal behavior, relevant edge cases, and expected failure conditions. Keep tests independent and deterministic. They must not depend on execution order, shared mutable state, real network services, or arbitrary delays. Mock external dependencies when needed, but do not mock the behavior being tested. Keep test setup minimal. Reuse fixtures or helpers when they improve clarity. Follow the project's existing testing framework, conventions, and file structure.

Never weaken assertions, skip tests, or change expected results merely to make a failing test pass. Run the relevant tests after making changes. Report what was run, any failures, and any tests that could not be run.

## Definition of done

State the goal and observable acceptance criteria before implementation. Relevant checks pass, documentation matches the named baseline, independent reviewers resolve findings and CI passes before merge. Verify success, rejection, retry/reload and migration paths for affected contracts. Product UI also needs 390px before/after evidence and accessibility/design review. Do not report a phase or the full learning workflow complete while approval, integration or evidence is missing.
