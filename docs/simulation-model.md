# Simulation engine

The pure engine is in `server/app/simulation/engine.py`. It models a controlled, synthetic, long-only market. It is not historical data or an exchange emulator. API ownership, mastery gates, persistence and idempotency belong to the transport/storage layer; the pure engine does not authenticate callers.

## Scenario and privacy

A private seed creates independent paths for four fictional assets over 120 observations by default. Supported packs are rising, falling, sideways and volatile. Each uses its own random generator; creating a second session does not change the first. Version 1 snapshots serialize to JSON and resume the same path and order queue. Keep the seed, pack direction, complete price series and future liquidity server-side. `public_view` returns observations only through the current step.

## Orders and accounting

Every order requires a written reason, risk, reconsideration condition, position-size explanation and positive planned loss boundary. Text validation establishes presence, not the quality of a financial thesis. The boundary records intention; it is not a guaranteed execution loss limit.

Orders execute on a subsequent observation. Market orders cross the spread. Limits execute only when the quoted side reaches the limit and never receive a worse price. Stops trigger on the mid-price and then execute as market orders; gaps can produce a worse fill than the trigger. Shared per-asset capacity creates partial fills in submission order. Cancelling releases unfilled cash/share reservations; reaching the last observation expires outstanding orders.

The spread is 0.2% of mid-price. Slippage adds up to 0.05% of the quote according to the fraction of that step's capacity consumed by the fill. Commission is 0.1% of each fill's notional plus 0.25 once on the order's first fill. Amounts are rounded to cents. The minimum example asset price is 1.00. These are explicit teaching assumptions, not a broker's fee schedule.

Cash and positions cannot go negative. Open buy orders reserve estimated cash; market/stop reservations use a 5% quote buffer. A price gap can reduce a fill or reject the unfilled order when cash/exposure is insufficient. Long exposure to each asset is capped at 25% of current portfolio value when submitting and filling buys. Price movement after purchase can move the weight above 25%; the system does not silently rebalance. No margin, leverage, shorting, live data or automatic liquidation is implemented in this engine.

## Review

The public view includes cash, positions, filled orders, fees, concentration, current equity and maximum observed drawdown. A passive equal-value basket provides context. It assumes fractional units and is gross of fees; that difference is labelled. Neither final balance nor excess return is a competence score or reward input.

A learner may finish after observing at least ten steps with a written reflection, including a decision to make no trade. Ending cancels open orders. Reflection text is retained for the learner; it is not automatically graded as evidence of high-quality reasoning. Future unseen observations remain private even after an early end.

## Verification

The engine tests cover independent deterministic seeds, hidden futures, required plans, quantity and exposure checks, exact fill/fee arithmetic, partial fills, limit protection, stop gaps, cancellation reservations, shared liquidity, JSON resume, expiry, no-trade reflection and nonnegative holdings/cash. This test scope does not establish real-market fidelity or learner outcomes.

## Saved sessions and API

`POST /api/simulations` starts `guided` practice after the first four module mastery checks or `endless` practice after the first nine. Both accept an `idempotency_key`. Endless means repeatable bounded scenarios; it does not imply a continuously running market. Up to three unfinished scenarios may be retained at once.

List or resume owned sessions with `GET /api/simulations` and `GET /api/simulations/{id}`. Submit orders to `/{id}/orders`, observations to `/{id}/advance`, cancellation to `/{id}/orders/{order_id}/cancel`, and reflection to `/{id}/debrief`. Every mutation requires a request key. An unchanged retry returns the original committed response, including after an application restart; reusing the key for a different action returns 409. An order payload contains `symbol`, `side`, `type`, whole-number `quantity`, a decimal-string `price` for limits/stops, and the five plan fields described above. Advancing accepts `steps` from 1 to 5. Debrief accepts a 30–1500-character reflection.

Session ownership is enforced on every command. Private snapshots and command results commit atomically. Saved engine versions are checked before use; incompatible versions return409 instead of silently changing a path. Migration 2 creates the command ledger and preserves existing learning records. API tests cover mastery gates, ownership, replay, concurrent requests, restarts, migration, plan validation, cancellation and no-trade reflection without trading XP.
