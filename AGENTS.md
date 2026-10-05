# Repository guide

## Source order and map

This is v2; sibling `traders_edge` is read-only discovery material. Read `docs/source/traders-edge-supervisor-summary.md` first. The sample image specifies screen content and mechanics, not appearance. For v1 behavior, code/tests/configuration outrank old documentation. Preserve supplied source files verbatim.

- `client/src/`: React/TypeScript presentation; Vite development/build tooling.
- `server/app/`: FastAPI authentication, learning routes, progression and persistence.
- `server/app/content/`: private authored curriculum, source register and validator.
- `server/app/simulation/`: deterministic synthetic-market engine; private future state.
- `server/tests/`: API, persistence and simulation behavior tests.
- `docs/`: curriculum, assessment, simulation, data/API, localization, evaluation and decisions.
- `docs/v1-audit/`, `docs/source/`: discovery evidence and product authority.
- `docs/design/`: brief, competitor study and selected static design evidence.
- `.agents/skills/`: focused authoring and review workflows.
- `.coordination/`: ignored ownership, disagreements, reviews and PR drafts.

## Commands

Install: `npm ci && npm --prefix client ci`; `uv sync --project server --extra test --locked`.
Run client: `npm run dev`. Run API: `uv run --project server --locked python -m uvicorn app.main:app --reload`.
Use the same hostname for both; guest cookies are same-site. See `server/README.md` for environment settings.

Check: `npm run lint`, `npm run typecheck`, `npm run build`.
Format: `npm run format`.
API tests: `uv run --project server --extra test --locked python -m unittest discover -s server/tests`.
Content: `uv run --project server --locked python -m app.content.validate` and `uv run --project server --locked python -m unittest app.content.test_catalog`.
Migrate: `uv run --project server --locked python -m app.db`; back up persistent data before upgrades. Local storage is `server/data/learning.db`, not a disposable source file.

## Product and design constraints

Teach readiness and risk before execution, strategies or advanced products. Require a written plan before every simulated trade. Never reward virtual profit, trade count or volume. A reasoned decision not to trade is valid. Module-check completion, recorded reflection and descriptive confidence statistics must not be presented as validated financial competence. Multiplayer and endless practice require server-enforced mastery prerequisites.

No profit leaderboards, order confetti, urgent market alerts, countdowns, flashing hot-stock displays, one-swipe execution, default leverage or copy-trading. Activity streaks describe learning, not trading. Never claim the app makes learners profitable. Keep regional rules out of the neutral core.

The owner selected refined Fieldbook and authorized implementation. Use the selected reference and current design specification when present; follow `docs/design/anti-slop-checklist.md`. Preserve meaningful treasure-map navigation, 44px targets, visible focus, reduced motion and non-color state labels. No navy/neon styling, glowing hexagons, glass gradients or fantasy-map textures. Static prototype checks do not replace real application review.

## Adding content

Lessons: edit the canonical catalog, retain stable IDs, specify objective and primary-source basis, supply all nine learning-cycle strings and complete question/answer explanations. Run the content validator/tests and obtain independent accuracy review; authored content must remain pending until reviewed. See `docs/curriculum/README.md` and `.agents/skills/add-lesson/SKILL.md`.

Scenarios: extend the engine’s existing pack contract, document synthetic or licensed historical provenance, private seed, friction and loss assumptions. Never expose future prices, liquidity or direction through public responses. Test deterministic replay, hidden futures, fills, fees and persistence. See `docs/simulation-model.md` and `.agents/skills/add-scenario-pack/SKILL.md`.

Rewards: use verifiable learning events and idempotent server awards. Read the current reward/progression contract before adding a badge; do not invent a parallel schema or certify reflection quality from text length. See `docs/gamification-and-safety.md` and `.agents/skills/add-badge-or-reward/SKILL.md`.

## Work and review

Use `chore/`, `docs/`, `feat/` or `fix/` task branches and concise imperative Conventional Commits. Keep PRs narrow and use existing git identity. No tool attribution, persona names or coauthor trailers in tracked files or history. No force pushes to shared branches.

Record ownership and disagreements in `.coordination/`; distill durable decisions into ADRs. Every PR needs correctness/scope review; rewards, simulation and copy need safety review; product UI needs design/accessibility review and 390px before/after evidence. Every commit must build and pass relevant checks. CI must pass before merge.

No filler comments, invented citations/statistics, marketing language, decorative emoji, dead code, unused dependencies or unfinished behavior described as complete. Document actual implementation separately from proposals. New database changes require appended explicit migrations, not edits that rewrite an applied migration.

Done means behavior works, checks pass, docs match code, reviewers resolve findings and CI passes. Do not report a deployment, content approval or participant outcome without the corresponding evidence.
