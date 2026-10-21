# Repository guide

## Scope and source order

This is v2. The sibling `traders_edge` repository is read-only discovery material. The [game design document](docs/game-design.md) governs gameplay; read the preserved [supervisor summary](docs/source/traders-edge-supervisor-summary.md) for research, safety and evaluation goals. [ADR 0004](docs/decisions/0004-playable-game-overhaul.md) records the current gameplay authority and the replacement of the learning-run system; [ADR 0003](docs/decisions/0003-gameplay-brief-authority.md) is historical. The [curriculum spec](docs/content/curriculum-spec.md) is the content design source and the [build contract](docs/README.md#reference) records what was implemented. The [sample image](docs/source/Trader_s_Edge_Sample_UI.jpg) specifies screen content and mechanics, not appearance. Verify implementation claims against code, tests and configuration at the named branch/commit; historical audits and design proposals are not current runtime contracts.

## Map and current boundary

- [client/](client/): React 19, TypeScript and Vite. [router.tsx](client/router.tsx) lazy-loads every page; [app/](client/app/) holds the shell and player provider; [ui/](client/ui/) the design system and [tokens](client/ui/tokens.css); [features/](client/features/) one folder per area (home, adventure, level, arena, play, quiz, multiplayer, profile, leaderboard, archive, auth); [services/](client/services/) one module per API area, bound to the generated [api-types](client/api/api-types.ts) through the [HTTP transport](client/services/httpService.ts).
- [server/app/](server/app/): one FastAPI backend with guest/Firebase authentication, SQLAlchemy persistence and ordered migrations. Local development uses SQLite; production configuration requires verified Firebase identity and PostgreSQL.
- [server/app/game/](server/app/game/): the trading engine. Seeded market, order engine, bots, missions, server-owned clock, results and the balance gauntlet. State is rebuilt from the stored order log on every read. It knows nothing about chapters or currencies; `resolve_game` and `settle_game` hooks on `app.state` supply those.
- [server/app/campaign/](server/app/campaign/): chapters, levels, checks, stars, unlocks, bosses (preview, gate, final), the daily challenge and the two hooks.
- [server/app/player/](server/app/player/): profile, XP and levels, wallet (Doubloons, Gems), login streak, cosmetics, badges, shop and leaderboards.
- [server/app/quiz/](server/app/quiz/): quiz bank, attempts and classroom quiz rooms. Rooms grant no XP.
- [server/app/multiplayer/](server/app/multiplayer/): private lobbies (no prerequisite), ranked matchmaking (after the Chapter 3 boss) and Elo. Matches run on `app/game`.
- [server/app/research.py](server/app/research.py): owned exports of game events, campaign progress and quiz attempts, plus default-off study metadata/consent/withdrawal.
- [server/app/content/](server/app/content/): authored JSON in `campaign/` (ch1–ch8), `scenarios/`, `bots.json`, `quiz_bank.json` and `cosmetics.json`, the bundle loader and [validate.py](server/app/content/validate.py).
- [migrations](server/app/migrations.py) 1–12: 1–10 belong to the removed system and stay frozen (only profiles, sessions, XP ledger, activity days, economy accounts/events, reward grants and research tables are still used); 11 adds the game tables; 12 adds campaign progress, checks, boss results, quiz, lobby, queue and rating tables.
- [docs/source/](docs/source/): preserved research brief and screen reference. Keep source files verbatim.
- [docs/archive/](docs/archive/): v1 audit and design history; preserve their historical scope.
- [docs/decisions/](docs/decisions/): durable decisions and consequences. Distinguish proposals from implementation.
- [.devin/skills/](.devin/skills/): the [content](.devin/skills/add-lesson/SKILL.md), [scenario](.devin/skills/add-scenario-pack/SKILL.md), [reward](.devin/skills/add-badge-or-reward/SKILL.md), [safety](.devin/skills/safety-review-checklist/SKILL.md), [design](.devin/skills/design-review/SKILL.md), [screenshot](.devin/skills/capture-screenshots/SKILL.md), [decision](.devin/skills/write-adr/SKILL.md) and [PR-review](.devin/skills/run-pr-review/SKILL.md) workflows. Follow the actual branch contracts and report unavailable checks.

The game loop, campaign, economy, quizzes and multiplayer are implemented and tested locally. Content (8 chapters × 5 levels, 64 scenarios, 160 quiz questions) awaits independent financial/pedagogical review, and no production approval gate exists for it yet. Real Firebase sign-in, hosted deployment, account deletion/retention, researcher access and any validated learning measure remain pending. See [Server README](server/README.md) for the actual contracts.

## Commands

Use Node.js 24+, Python 3.12+ and uv 0.12.23. Run from the repository root; [README.md](README.md) lists the exact install, two-terminal run and CI check commands. `npm test` runs the client tests; the backend suite (including the balance gauntlet) and `python -m app.content.validate` are separate commands. `npm run lint` runs Oxlint and formatting checks, despite the internal `lint:eslint` script name. Regenerate the client contract with `npm run api:generate` after backend schema changes; CI runs `npm run api:check`. Use locked Python dependencies. See [Server README](server/README.md) for configuration, authentication and deployment limits.

For scoped documentation changes, invoke the installed root formatter explicitly, for example `node node_modules/prettier/bin/prettier.cjs --check README.md AGENTS.md`, listing only authorized changed files. `npm run format` rewrites the repository; do not use it to fix unrelated formatting during a narrow task.

## Product and architecture constraints

Follow the chapter order in the curriculum spec and enable each order type only after it is taught (each scenario's `allow` field). Each match has one game plan, chosen in the briefing: a strategy and a maximum loss. Orders are one click; do not add a written plan per order. Results compare the plan with what happened; missions, the plan review and the decision score are unvalidated process feedback, not proof of learning. Rank every match by profit as the [game design document](docs/game-design.md) requires. Never award XP for individual orders, trade count or volume. Preserve server-owned progression, ownership checks, hidden future bars and news, and natural-key idempotency (one reward per key, one settlement per participant).

Solo matches run on a server-owned real-time clock with pause, next-day stepping and 1×/2×/4× speed; multiplayer runs at a fixed pace with no pause. Fees and the spread defend against button-smashing; keep the balance gauntlet passing for every boss and daily rather than loosening its limits. Show news calmly in a feed.

Keep one modular backend, not microservices. `app/game` stays free of chapter and currency logic; extend the hooks instead. Append [migrations](server/app/migrations.py) rather than rewriting deployed versions; preserve saved games, progress and rewards. [SQLite/mocked-Firebase profile-refresh tests](server/tests/test_auth_consistency.py) establish ORM semantics; the separate [live PostgreSQL suite](server/tests/test_postgres_integration.py) verifies profile-lock waiting/refresh, concurrent awards, populated migration preservation and replay across workers/restart. These checks do not establish real Firebase sign-in, hosted deployment or learning efficacy; see [deployment.md](docs/operations/deployment.md).

Match profit and ranked rating are game outcomes, not learning evidence. No order confetti, urgent market alerts, countdown timers, flashing hot-stock displays, one-swipe execution, leverage, shorting or copy-trading. Never claim the app makes learners profitable. Keep region-specific rules in localization packs.

## Design and content review

Routine backend implementation decisions are delegated within the authorized scope. The owner must select a visual direction before final design specifications or product UI; replacement UI implementation also requires a separate go-ahead after technical and safety review. The current client follows the visual direction in the [build contract](docs/product/design-system.md). Record alternatives and independent critique. Keep frontend visual work in its separate task scope; do not overwrite another worktree's dirty changes.

No navy/neon styling, glowing hexagons, glass gradients or fantasy-map textures. Use the required treasure-map metaphor with accessible, meaningful navigation. Follow [design checklist](docs/product/design-system.md). Minimum touch target is 44px; support visible focus, reduced motion and non-color state labels. Refer to the [Sample UI](docs/source/Trader_s_Edge_Sample_UI.jpg) for expected UI layouts.

The authoring contract is in the [curriculum authoring guide](docs/content/authoring.md), the [content formats](docs/content/authoring.md) and the [validator](server/app/content/validate.py); extend the existing JSON formats rather than inventing a parallel one. Scenarios use fictional companies, need one obvious lesson, and must keep idle and random players losing where their balance class is gated. Bump a scenario's `version` when its market changes; saved matches on an older version refuse to load. Keep earned badges distinct from shop cosmetics; never reward trading frequency or present match rewards as validated competence. Validation and the gauntlet are not independent financial/pedagogical review.

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
