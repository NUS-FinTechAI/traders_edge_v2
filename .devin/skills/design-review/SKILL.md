---
name: design-review
description: Review changed learning screens and navigation for meaningful progression, accessible interaction and truthful states.
---

# Design Review

Use for product UI or navigation changes; frontend visual design belongs to the teammate, not this review workflow. Paths are repository-relative.

1. Read the visual direction in `docs/game-architecture.md`, `docs/design/anti-slop-checklist.md`, `docs/design/review-process.md`, `docs/design/brief.md` (historical, for audience and exclusions) and the current implementation. Historical Fieldbook selection and prototype QA do not approve a reopened direction or prove current runtime behavior.
2. Agree the branch, owned screens, acceptance criteria and evidence with the frontend teammate. Verify alternatives, independent critique, owner selection before final specifications and a separate implementation go-ahead after technical/safety review before replacement UI; do not overwrite another worktree's changes.
3. Follow home → chapter map → level (cards, check) → match briefing → trading → results → updated map. The treasure-map route must encode the actual Preview Battle, levels, reward nodes, Chapter Boss and Gate Boss, with one understandable next action and honest locked/error recovery.
4. Reject mandatory essays, dead controls, misleading resume and bonus rewards without criteria. Verify check feedback and re-queued questions, order placement and rejection messages, pause/step, finish, return and persisted reload against the actual API rather than prototype storage.
5. Compare 390px before/after evidence, then inspect 360, 430 and 768px. Check 44px targets, keyboard order/visible focus, labels, non-color states, measured contrast, 200% text enlargement and reduced motion; inspect empty/loading/error/locked/success states.
6. Reject navy/neon, glow, glass gradients, fantasy-map textures and decorative charts that obscure learning. Check plain-language terms and guidance without urgency, trading celebration or profitability claims.
7. Return file/line or screen/state evidence, severity, acceptance criterion and concrete correction for each finding. Hand off disagreements and unresolved dependencies in-session when `.coordination/` is absent or inaccessible; do not bypass it.
8. Do not claim beginner comprehension, screen-reader conformance, learning outcomes or production performance from screenshots or an expert walkthrough. Obtain independent design/accessibility review of the changed product flow.
