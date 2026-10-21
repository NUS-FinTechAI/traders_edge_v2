---
name: add-scenario-pack
description: Add or tune trading scenarios and bots without leaking future bars, breaking replay or letting idle and random players win.
---

# Add Scenario Pack

Use when adding or changing a market scenario, its missions or the bot roster. Paths are repository-relative.

1. Read `docs/reference/engine.md`, the Scenarios and Bots sections of `docs/content/authoring.md`, `server/app/game/scenario.py`, `market.py`, `engine.py`, `bots.py`, `objectives.py`, `balance.py` and `server/tests/test_game_balance.py`. Keep v1 read-only.
2. State the one lesson the market teaches, how the briefing names it, how the news and regimes create it, and what the debrief says. Use fictional companies and 3–5 letter tickers.
3. Write `server/app/content/scenarios/<id>.json` with the file name equal to `id`. Follow the naming in `docs/content/authoring.md` (`chN-lM-practice`, `chN-boss`, `daily-*`, `practice-*`, `mp-*`). Enable `limit`/`stop` in `allow` and chart `tools` only after the curriculum teaches them. Missions must name symbols, news and bots that exist in the scenario.
4. Set `balance` (`boss`, `daily`, `lesson` or omit). A boss needs at least one bot. Use `app.game.balance.gauntlet(scenario, range(50))` while tuning; never loosen the limits in `test_game_balance.py` to make a scenario pass.
5. Bump `version` whenever an existing scenario's market or missions change; saved matches on an older version then refuse to load instead of replaying differently. New bots go in `bots.json` with a strategy and parameters from `scenario.py`'s `STRATEGIES`; keep bot ids stable.
6. The engine must stay deterministic from `(scenario, seed, orders)`: no wall-clock or external data in price generation or bot decisions. Bots see only bars and news up to their observed tick. Future bars and news must never appear in the public state.
7. Test new engine behaviour with focused tests in `server/tests/test_game_*.py`. Run `uv run --project server --extra test --locked python -m app.content.validate` and `uv run --project server --extra test --locked python -m unittest discover -s server/tests` from the target checkout root with a separate environment per worker. If reusing an interpreter, set `PYTHONPATH="$PWD/server:$PWD/server/tests"` explicitly and verify `app.__file__` belongs to this checkout.
8. Play the scenario in the arena. Request safety review for copy and news tone and content review for financial statements; report unmodelled behaviour (shorting, partial fills, per-asset spreads) rather than implying it.
