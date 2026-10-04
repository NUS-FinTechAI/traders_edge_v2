# V1 discovery summary

The rebuild should preserve mission-based progression, controlled scenario replay, progressive tool disclosure, post-module checks and portfolio explanations. It should rewrite the assessment rules, execution engine boundaries, mobile interface and persistence. V1 is useful evidence, not a safe starting product to copy wholesale.

## Scope and evidence

Audited v1 commit `2bf6b5930858fdbb61bc388d4554d4657d9ce377`. The original checkout remained read-only, including its pre-existing modified `.DS_Store` and untracked notes. The area reports cite actual source paths and distinguish inspection from execution:

- [Frontend](frontend.md): routes, screen mechanics, state, accessibility, assets and browser-test boundaries.
- [Platform](platform.md): API/authentication, persistence, realtime contracts, deployment and infrastructure risks.
- [Learning and simulation](learning-simulation.md): seeded curriculum, scoring, order execution, analytics and repeatability.

All 209 existing backend tests passed in 6.17 seconds in a clean archive with Python 3.13.0 and the v1 requirements. Transitive dependencies were resolved during installation; there is no fully locked Python environment in v1. The tests use substantial mocking and do not establish database/Firebase integration or a production deployment. No v1 frontend build or browser test result is claimed.

## What survives

| Concept                    | What to preserve                                                                                | What must change                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Missions and learning path | Stable content IDs, bounded tasks, required/bonus separation, prerequisite checks               | Ten-module sequence, explicit learning objectives and source basis, mastery rather than participation              |
| Scenario playback          | Controlled windows, hidden outcomes, varied paths, scripted news/context                        | Versioned datasets and provenance; private future data; independent random generators                              |
| Order execution            | Price-time matching, reservations, partial fills, cancellation concepts and regression examples | Plan checks, ownership, fees/friction, deterministic math and corrected reservation lifecycle                      |
| Portfolio analytics        | Diversification, concentration, drawdown and passive comparisons                                | Formula/version validation; cash and short-exposure semantics; outcomes as reflection evidence rather than rewards |
| User progression           | Verified identity, server-owned progress and learning activity                                  | Idempotent learning events, delayed review, durable sessions and explicit privacy choices                          |
| Interface mechanics        | Dashboard, module/map selection, outcomes, quizzes, activity, profile and archive concept       | Approved mobile visual direction, keyboard access, focus handling and honest locked/error/resume states            |

## Findings that shape v2

V1 combines mission points with final-net-worth scoring. Its ten quiz pass thresholds are zero, so participation can count as completion without correct answers. Neither its order payload nor its execution flow requires a written plan. Multiplayer lacks a mastery prerequisite. These are product-contract changes, not copy fixes.

A public level-details route returns future scenario schedules and seeds. Multiplayer cancellation lacks a check that the requester owns the order. “Resume” restarts a scenario rather than restoring orders, positions and elapsed ticks. Rooms are process-local; database initialization is not a migration system. Preserve verified identity binding and negative tests, then rebuild those contracts explicitly.

The seeded market code is not independently repeatable across tickers. In a clean-archive probe, ticker A with seed 7 repeated the same five closing prices when run alone. Merely constructing ticker B with seed 99 changed A's price path, because the implementation also seeds and consumes shared global random generators. The current test suite passes despite this uncovered behavior.

The frontend contains a trading countdown and level-completion confetti tied to financial-success presentation. It does not show confetti after individual orders; that distinction matters. Endless mode is only a locked card, achievement awarding is not implemented, and the mockup's archive/global rank/reward inventory should not be described as existing v1 features.

## Resolved contradictions

1. The research brief overrides the old curriculum order and unsafe mockup copy. [Decision 0001](../decisions/0001-learning-authority-and-safety.md) retains map/stars/learning rewards while removing the sniper badge, trading invitation, countdown and profit-based ranking.
2. The frontend's Resume label is contradicted by the same start payload and fresh backend initialization. V2 needs an explicit interruption/resume contract.
3. Client quiz completion checks do not establish server mastery. Diagnostic pre-tests and mastery checks need separate purposes and rules.
4. Tool flags are not uniformly decorative: single-player enforces some order/tool rules. Multiplayer presentation toggles do not imply the same guarantee.
5. An old v1 note alleges duplicate selected columns in `_get_level`. Current code selects and unpacks 15 matching fields; the alleged defect is absent at this commit.
6. Benchmark comparison remains educational evidence. Excess return, just like profit, must not become a reward or leaderboard score.

## Owner-reported usability and speed

The owner reports that v1 is slow, hard to use and unintuitive. Treat these as rebuild acceptance concerns, not merely a request for new colors. The static audits identify possible contributors—dense screens, large state handlers, repeated geometry polling, live data downloads and synchronous request-path work—but no measured baseline attributes the reported slowness to one cause.

Phase 2 must define beginner task tests and explicit performance budgets. The first-time journey should expose an obvious next learning action, explain terms where they appear, progressively reveal tools and provide clear loading/error/retry states. Verification must measure time to usable content, interaction response and key-flow completion on representative mobile conditions; it must distinguish browser, API, database and scenario-start delays.

## Phase 2 decisions still required

Retain React/TypeScript and FastAPI as the default stack while evaluating PostgreSQL, Firebase, mobile web delivery and deployment from the audited constraints. Specify the content pipeline, server/private scenario boundary, simulation state and recovery, assessment/mastery, learning XP, rank, localization and minimal evaluation records. Historical data rights/provenance and v1 artwork licensing are unresolved; do not import either without establishing permission and suitability.

The first owner gate is a choice among three independently designed dashboard/map/quiz prototypes. Final design tokens and screen specifications follow that choice. Product implementation requires a second, separate go-ahead after technical and safety review.
