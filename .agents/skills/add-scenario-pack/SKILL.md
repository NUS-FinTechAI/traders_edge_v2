---
name: add-scenario-pack
description: Add or change a controlled simulation scenario or market path while preserving deterministic replay, hidden futures and planned-order safety.
---

# Add Scenario Pack

All repository paths below are relative to the repository root.

Read `docs/simulation-model.md`, `server/app/simulation/engine.py` and `server/tests/test_simulation.py`. Inspect current transport/snapshot tests before changing serialization.

1. Specify the learning objective, provenance, supported market condition and friction assumptions. Existing packs are synthetic; do not label generated paths historical.
2. Extend the existing session/pack mechanism. Use the session’s private random generator and explicit seed; do not depend on global random state, wall-clock movement or network downloads.
3. Keep seed, direction, complete path and future liquidity private. Expose observations only through the engine’s public projection. Any snapshot-format change needs version compatibility or an explicit migration.
4. Preserve written plans, long-only constraints and realistic adverse cases. A planned loss boundary is not a guaranteed stop price. No trade is a valid completion path.
5. Test repeatable seeds, independent sessions, resume equivalence, no future leakage, spread/slippage/fee arithmetic, gaps, limits, partial fills and cash/share reservations. Include the edge cases the change introduces.
6. Run the API test suite and update the simulation model with exact assumptions. Review any new transport route for ownership, prerequisites and idempotent mutation before exposing it.
