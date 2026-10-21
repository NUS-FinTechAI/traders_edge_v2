---
name: add-badge-or-reward
description: Add or change badges, cosmetics, XP or currency rules while keeping rewards process-based, idempotent and server-owned.
---

# Add Badge Or Reward

Use when proposing a badge, cosmetic, star, XP amount or Doubloon/Gem rule. Paths are repository-relative.

1. Read `docs/reference/progression.md`, `docs/reference/matches.md` (Settlement), `docs/product/safety-and-wellbeing.md`, the Cosmetics section of `docs/content/authoring.md`, `server/app/content/cosmetics.json`, `server/app/player/` (`ledger.py`, `badges.py`, `cosmetics.py`, `levels.py`, `service.py`), `server/app/campaign/settlement.py`, `server/app/campaign/daily.py` and the tests `server/tests/test_player.py`, `test_campaign.py` and `test_daily.py`.
2. Rewards must reward process, not activity or profit size. Reject trade-count, volume, fills, leverage or individual order placement as inputs. Profit may decide a match and its win reward, but badges must not depend on profit size. Private lobby matches and classroom quiz rooms pay nothing.
3. Add cosmetics to `cosmetics.json` with the right id prefix, `source`, and `price`, `chapter` or `level` as the validator requires. New badges also need a condition in `badges.py` (`standing` for saved records, `match_badges` for the settled match).
4. Every award goes through `ledger.award_xp`, `ledger.credit` or `ledger.grant` with a natural unique key (`<event>:<id or day>`). Never add a route that lets the client claim a win, XP or currency; settlement derives everything from the stored result.
5. Keep the wallet invariants: balances never go negative, Doubloons expire weekly, Gems are earned only from ranked play and are never sold for real money.
6. Test the new rule once and twice (no double award), its failure path, and that settlement replay returns the stored response. Run `uv run --project server --extra test --locked python -m app.content.validate` and `uv run --project server --extra test --locked python -m unittest discover -s server/tests` from the target checkout root with a separate environment per worker. If reusing an interpreter, set `PYTHONPATH="$PWD/server:$PWD/server/tests"` explicitly and verify `app.__file__` belongs to this checkout.
7. Obtain safety review of criteria and copy; forbid urgency, streak-loss threats and trading celebrations. Coordinate artwork with the frontend owner and require design/accessibility review. Hand off changed ids, keys, checks and unresolved review; this workflow adds no approval authority.
