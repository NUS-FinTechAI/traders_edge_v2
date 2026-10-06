---
name: add-scenario-pack
description: Extend a controlled simulation pack without leaking future state or bypassing planned-order safety and replay.
---

# Add Scenario Pack

Use when changing synthetic market paths, pack assumptions or scenario behavior. Paths are repository-relative.

1. Read `docs/simulation-model.md`, `server/app/simulation/engine.py`, `server/app/simulation/api.py` and `server/tests/test_simulation.py`; inspect saved-session/API tests before changing transport or snapshots. Keep v1 read-only.
2. State the objective, provenance, seed, friction and adverse-loss assumptions. The existing generic engine has rising, falling, sideways and volatile synthetic packs; do not label them licensed historical data or completed lesson missions.
3. Extend the existing pack/session contract, not a parallel scenario format. Read `server/app/simulation/bindings.py`, `server/app/simulation/lesson_api.py`, `server/app/learning_runs.py` and `server/tests/test_bound_simulation.py`: `m05-l01` already has a final graded simulation audit after knowledge cards. Other bindings and Module 9 multi-scenario assessment remain pending; review each new boundary rather than generalizing this one.
4. Use the session-local seeded generator. Keep seed, kind/direction, complete prices and future liquidity private; inspect public projections for leaks. Do not introduce live downloads or wall-clock-dependent paths.
5. Preserve fees, spreads, slippage, reservations and long-only constraints. Require a written plan before every actual order, including an exit/replacement order; quizzes need no order plan. Planned loss is not a guaranteed stop price, and reasoned no-trade remains valid.
6. Preserve ownership, guided prerequisites (modules 1–4), bounded endless prerequisites (1–9), saved state and exact replay before fresh gates/retired-version checks. For `m05-l01`, ordinary routes also enforce NORTH buy limits, opening-ask cap excluding fees, quantity ≤5, two orders including cancellations, advance ≤2, 30 observations/minimum ten/final tick 29. Raw debrief and fresh post-finish mutations return 409. Snapshot changes need compatibility/migration tests, not rewritten historical migrations.
7. Test seeds, independent sessions, save/resume, hidden futures, fees, gaps, fills and reservations. For bound audits require the returned public `observation_token` and test same-tick placement/cancellation stale 409 before evidence, committed historical tokenless replay, specific issue feedback, pre-finish snapshot versus cancellation, false fill guarantee and supported no-order reasons (`no_thesis_supplied` or current **ask** above cap). This no-thesis educational case is not a recommendation. Preserve dedicated audit versus unchanged `StepAnswer` hashing and nullable session-list `learning_run_id`; include missing-plan and locked-access cases.
8. Run `uv run --project server --extra test --locked python -m unittest discover -s server/tests` from the target checkout root with a separate environment per worker. If reusing an interpreter, set `PYTHONPATH="$PWD/server:$PWD/server/tests"` explicitly and verify `app.__file__` belongs to this checkout; never repoint a shared editable installation. Update assumptions in the maintained simulation contract within authorized scope; request safety review and report unimplemented bindings separately from tested engine behavior.
