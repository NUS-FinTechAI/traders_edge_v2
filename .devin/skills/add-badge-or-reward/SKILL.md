---
name: add-badge-or-reward
description: Review or change finite code-policy rewards while preserving learning evidence, ownership and exact replay.
---

# Add Badge Or Reward

Use when proposing a badge, cosmetic unlock, completion star or XP rule. Paths are repository-relative.

1. Read `docs/gamification-and-safety.md`, `server/README.md`, `server/app/rewards.py`, `server/app/progression.py`, `server/app/learning_runs.py`, `server/app/migration_v4.py` and `server/tests/test_rewards.py`. Verify actual current code, not an older claim that inventory is absent.
2. Distinguish one-time XP and completion stars from the six finite versioned policy items (`badge-first-lesson`, `badge-foundations`, `badge-core`, `badge-first-review`, `avatar-compass`, `title-foundations-complete`). Current XP is 20 per first lesson, 50 per first module check and 10 per delayed review; bonuses give zero XP. Visual assets, player-level policy and multiplayer rank are not supplied.
3. Extend the existing code policy only after reviewing event, evidence, version, public meaning and replay implications; do not invent a configuration format. Preserve owned grant snapshots/evidence when definitions retire. Migration 4 adds only two reward tables and two nullable profile equipment columns; migrations 1–3 stay frozen.
4. Require verifiable server-owned learning evidence. Reject profit, trade count, volume, fills, leverage, funding or order placement as reward inputs. Text presence/length, stars and XP are not reasoning-quality or competence measures.
5. Preserve owned/eligible/locked inventory, claim/equipment ownership and kind checks, omitted-slot preservation versus explicit-null clearing, and the separate reward-command namespace. Same-key replay precedes policy/publication checks and does not reapply old equipment. Claims/equipment create no XP/activity.
6. Test unchanged replay, changed-payload conflict, concurrency, atomic slot validation, retirement, owner/kind rejection, restarts and populated upgrades. Activity windows are at most 366 days, but current/longest UTC streaks use all history of rewarded learning days, not logins, bonus, claims/equipment or trading. Keep optional bonuses nonblocking and retained legacy evidence intact.
7. Run `uv run --project server --extra test --locked python -m unittest discover -s server/tests` from the target checkout root with a separate environment per worker. If reusing an interpreter, set `PYTHONPATH="$PWD/server:$PWD/server/tests"` explicitly and verify `app.__file__` belongs to this checkout; never repoint a shared editable installation. Obtain safety review of criteria/copy; forbid urgency, streak-loss threats and trading celebrations. Report exact checks and unavailable live PostgreSQL verification, not invented counts or deployment claims.
8. Hand off changed criteria/IDs, evidence and unresolved review. Coordinate visuals with the frontend teammate and require design/accessibility review; this workflow adds no permissions or approval authority.
