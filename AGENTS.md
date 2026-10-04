# Repository guide

## Scope and source order

This is v2. The sibling `traders_edge` repository is read-only discovery material.
Read `docs/source/traders-edge-supervisor-summary.md` first. The sample image specifies screen content and mechanics only; it does not specify appearance. Code, tests and current configuration are evidence for v1 behavior; old documentation is orientation.

## Map and commands

- `client/`: React, TypeScript, Vite; `App.tsx` is the temporary setup screen.
- `server/app/`: FastAPI health endpoint; no product backend yet.
- `docs/source/`: preserved research brief and screen reference.
- `docs/v1-audit/`: evidence and migration decisions.
- `docs/design/`: brief, independent explorations and review evidence.
- `docs/decisions/`: durable decisions with context, options, decision and consequences.
- `.coordination/`: ignored task board, discussions, reviews and PR drafts.

Install: `npm ci && npm --prefix client ci`. Develop: `npm run dev`.
Build: `npm run build`. Type-check: `npm run typecheck`.
Lint and formatting: `npm run lint`. Format: `npm run format`.
API setup and test dependencies: see `server/README.md`. Test: `uv run --project server --extra test --locked python -m unittest discover -s server/tests`.

## Product constraints

Teach readiness and risk before execution, strategies or advanced products. Require a written plan before every simulated trade. Assess risk recognition, calibration, plan adherence and reflection; never reward virtual profit, trade count or volume. Multiplayer and endless practice require mastery prerequisites.

No profit leaderboards, order confetti, urgent market alerts, countdowns, flashing hot-stock displays, one-swipe execution, default leverage or copy-trading. Streaks describe learning, not trading. Never claim the app makes learners profitable. Keep region-specific rules in localization packs.

## Design gates

Do not build product UI before the owner selects a direction. Static concept prototypes are permitted for that selection. Do not produce the final design specification until approval. Implementation requires a separate go-ahead after technical and safety review.

No navy/neon styling, glowing hexagons, glass gradients or fantasy-map textures. Use the required treasure-map metaphor with accessible, meaningful navigation. Follow `docs/design/anti-slop-checklist.md` once established. Minimum touch target is 44px; support visible focus, reduced motion and non-color state labels.

## Work and review

Use task branches named `chore/short-scope`, `docs/short-scope`, `feat/short-scope` or `fix/short-scope`. Keep each PR narrow. Use the existing git identity. Do not add tool attribution, persona names or coauthor trailers anywhere in tracked work or git history. Write concise imperative Conventional Commit messages.

Record task ownership and disagreements in `.coordination/`; distill decisions into ADRs. Review each PR for correctness, scope, tests and plain language. Safety review is required for rewards, simulation and copy; design review for product UI. Every commit must build and pass relevant tests. CI must pass before merge. Do not change shared branches with force pushes.

No filler comments, invented citations, marketing language, decorative emoji, dead code, unused dependencies or unfinished functionality described as complete. Preserve source files verbatim. Separate research claims from design proposals.

## Adding content

Lesson, scenario and badge schemas do not exist yet. Until Phase 2 defines them, record proposed content in the relevant design document; do not invent a parallel runtime format. A lesson must identify its source basis and learning objective. A scenario must identify provenance, seed, friction and hidden future state. A badge must reward a verifiable learning process, never trade frequency or profit. Authoring skills and validation commands will be added when those contracts exist.

## Definition of done

The change works, relevant checks pass, documentation matches behavior, reviewers resolve findings, and CI passes before merge. Product UI changes also need 390px before/after evidence and accessibility/design review. Do not report a gated phase complete while its approval or evidence is missing.
