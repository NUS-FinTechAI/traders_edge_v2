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

In an ordinary unbound sandbox, a learner may finish after observing at least ten steps with a written reflection, including a decision to make no trade. The bound lesson instead requires the structured audit described below. Ending cancels open orders. Reflection text is retained for the learner; it is not automatically graded as evidence of high-quality reasoning. Future unseen observations remain private even after an early end.

## Implemented bound lesson: m05-l01

Local, unreleased integration adds one final graded `simulation` step after `m05-l01` knowledge cards. `bindings.py` pins `m05-l01-limit-audit-v1`; `lesson_api.py` binds, resumes and reviews it through the learning-run routes. See the [canonical endpoint/audit contract](../server/README.md#bound-m05-l01-simulation); ordinary `StepAnswer` remains unchanged for request-hash compatibility.

This uses the actual four-symbol engine (`NORTH`, `HARBOR`, `PLAIN`, `COVE`) with a private 30-observation path, final tick 29. Only optional NORTH buy limits are permitted: at or below opening ask, unit-price cap excluding fees, quantity at most five and at most two orders including cancelled ones. Advance at most two observations per command and observe at least ten before review. Every actual order needs its full prior written plan. No investment thesis is supplied; observing without orders is a valid educational decision, not a recommendation.

Success requires an accurate audit of every recorded order's status, filled quantity and submitted limit, plus session fees and `price_limit_guarantees_fill: false`. With no orders, verify `no_thesis_supplied` or `current_ask_above_cap` against the current NORTH **ask**, not midpoint/earlier quote. With orders the reason is null. Incorrect audits return specific issues and permit new-key correction; a missing/stale `observation_token` or stale tick/engine returns 409 before evidence. The returned token hashes only public observed engine state and changes for same-tick order placement/cancellation. Historical committed tokenless audits replay unchanged; fresh audits require the token. No trade, fill, order count or profit earns completion. The normal once-only lesson award follows a passed audit; bonus remains separate.

Ordinary order/advance/cancel routes validate the reciprocal binding and restrictions. Raw debrief and fresh post-finish mutations return 409. Success preserves `audited_observation` and feedback phase `before_finish_cancellation`, then finishes/cancels pending remainders: the audited pre-cancel state is not the finished order state. GET resumes either through the run or ordinary session route; session lists add nullable `learning_run_id`. Same-key bind/review and ordinary commands replay before fresh gates or retired-version checks. Seed, source kind and futures remain private.

Other lesson bindings, Module 9 multi-scenario assessment, news/tutorials and advanced execution remain pending. This slice is not a full v1 scenario port, semantic plan assessment, real-market validation or learning-efficacy evidence.

## Verification

The engine tests cover independent deterministic seeds, hidden futures, required plans, quantity and exposure checks, exact fill/fee arithmetic, partial fills, limit protection, stop gaps, cancellation reservations, shared liquidity, JSON resume, expiry, no-trade reflection and nonnegative holdings/cash. This test scope does not establish real-market fidelity or learner outcomes.

## Saved sessions and API

`POST /api/simulations` starts `guided` practice after the first four module mastery checks or `endless` practice after the first nine. Both accept an `idempotency_key`. Endless means repeatable bounded scenarios; it does not imply a continuously running market. Up to three unfinished scenarios may be retained at once.

List or resume owned sessions with `GET /api/simulations` and `GET /api/simulations/{id}`. Submit orders to `/{id}/orders`, observations to `/{id}/advance`, cancellation to `/{id}/orders/{order_id}/cancel`, and reflection to `/{id}/debrief`. Every mutation requires a request key. An unchanged retry returns the original committed response, including after an application restart; reusing the key for a different action returns 409. An order payload contains `symbol`, `side`, `type`, whole-number `quantity`, a decimal-string `price` for limits/stops, and the five plan fields described above. Advancing accepts `steps` from 1 to 5. Debrief accepts a 30–1500-character reflection.

Session ownership is enforced on every command. Private snapshots and command results commit atomically. Saved engine versions are checked before use; fresh reads/writes of incompatible versions return 409 instead of silently changing a path. Committed same-key commands replay before that compatibility check. Migration 2 creates the command ledger and preserves existing learning records. API tests cover mastery gates, ownership, replay, concurrent requests, restarts, migration, plan validation, cancellation and no-trade reflection without trading XP.
