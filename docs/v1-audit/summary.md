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

## Learning-loop reassessment, 5 October 2026

The owner rejected the connected v2 experience and specified sequential, interactive learning with module entry and exit quizzes. The table below preserves a historical comparison of v1 mechanics with the inspected PR #22 client and backend baseline `8098856`, before the backend changes in PRs #24–30. It is not the current backend status. The existing 253-file inventory remains extraction evidence; it does not establish that its retained concepts reached v2. No v1 source was changed or new v1 runtime result claimed in this follow-up.

| Mechanic                        | V1 source evidence                                                                                                                                         | Historical v2 gap or retained behavior                                                                                                 | Required direction                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Entry → levels → exit           | `frontend/src/features/levels/components/LevelSelectPage.tsx:79–123` renders both quiz phases around level cards                                           | `client/pages/Learning.tsx` in PR #22 has lessons and an exit assessment, but no diagnostic entry check                                | Restore an explicit entry baseline without demanding knowledge before teaching; keep exit assessment and remediation separate             |
| Step-based quizzes              | `frontend/src/features/quiz/components/QuizPage.tsx:210–324` presents one question, navigation and per-item feedback                                       | `client/components/Assessment.tsx:75–188` renders all questions plus required prose; lessons add prediction and decision fields        | Teach and assess one task at a time; use choice/classification/comparison where appropriate rather than generic essays                    |
| Level briefing and guided tools | `tradingPayloadMappers.ts:182–190` queues unlocks, missions and context; `useTradingTutorialFlow.ts:250–298` checks performed interactions                 | No equivalent level-linked briefing or guided-task contract exists in the connected lessons                                            | Explain objective and required/bonus tasks before play; introduce tools only when the learning objective needs them                       |
| Required and bonus missions     | `frontend/src/features/trading/components/MissionsPopup.tsx` and `GameEndMissionResultsSection.tsx` distinguish passing and optional results               | The simulation API has no level/mission completion model; authored bonus prompts are content-only                                      | Persist verifiable learning objectives, separate optional completion and explain standard/bonus awards                                    |
| Authored scenario context       | `backend/services/game_service/service/single_player_engine.py:751–805` reveals timed news/effects; seed includes starting holdings and tool configuration | Generic four-asset scenarios are not attached to named curriculum levels                                                               | Keep current engine safeguards; add reviewed level/scenario configuration, context and task evidence when execution enters the curriculum |
| Learning rewards and activity   | Dashboard activity and profile achievement presentation exist; achievement awarding is absent                                                              | V2 already has one-time XP, profile XP display and an opt-in leaderboard, but no earned-item inventory or standard/bonus level results | Preserve the ledger; add truthful level results, learning activity presentation and tested reward rules, not profit scoring               |
| Chart and saved state           | V1 offers candles but its Resume starts fresh                                                                                                              | V2 already has an SVG price-history chart with an exact-value table, durable snapshots and command replay                              | Preserve these; richer instructional observations are a later extension, not a reason to throw away working persistence                   |

Frontend trading filenames above are under `frontend/src/features/trading/`; the detailed area audit gives their full paths. V2 client line citations refer to the inspected PR #22 working tree, not the setup screen on master. Hash-based navigation alone is not a defect, and server rejection of a locked request is real authorization; missing explanatory UI must not be described as absent backend protection.

The target is not to transplant v1's five-module sequence or market-first curriculum. Module 1 can use interactive essential-money classification, capacity-versus-willingness comparisons and justified waiting cases without placing orders. The first-four-module execution gate remains unless an explicit reviewed change is made. Written plans remain required before every simulated order, not before every multiple-choice question.

## Remaining design and architecture work

The merged backend now separates diagnostic entry, required/bonus practice, exit checks and resumable delayed reviews; exposes level briefings; persists finite rewards/equipment and learning activity; and binds only `m05-l01` to a verified simulation audit. These additions build on existing authentication, persistence, XP, reviews and the deterministic simulator. Remaining work includes broader lesson bindings and Module 9 multi-scenario assessment, news/tutorial/tool ports, unseen assessment forms, multiplayer, artwork/player-level policy, frontend integration and learning evaluation. The familiar delayed-review items do not prove unseen retention or transfer. Historical dataset rights and artwork provenance remain unresolved; do not import them on the strength of an old reference.

The owner has delegated routine design and implementation decisions. Compare three independent working concepts, resolve critique and record the selected direction before final tokens or replacement product UI. Technical and safety review remain required. Screenshots and local test passes do not establish content accuracy, participant learning or production readiness.
