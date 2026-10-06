# Learning rewards and safety

The merged backend implements learning rewards, not a competence or profitability score. The API awards 20 XP once per passed lesson, 50 once per module check and 10 once per passed delayed review (`review:<lesson_id>`). Retries cannot farm these events. The optional leaderboard ranks opted-in pseudonyms by learning XP, not multiplayer rank. Merging the code does not approve the authored content for publication or establish deployment readiness.

Module maps project standard completion and separate verified bonus stars for all 30 levels. Bonuses grant zero XP/activity and never gate progress. Replay returns the saved completion state rather than granting an additional reward; `bonus_star` is completion state, not an award delta. Legacy completion remains labeled; no baseline or bonus evidence is fabricated. Older module-level reflection prompts are content-only; text length is not assessed reasoning quality.

## Implemented finite inventory

`server/app/rewards.py` owns six code-policy items, each at rule version `1`:

- `badge-first-lesson` and `avatar-compass`: a positive recorded `lesson:` XP event.
- `badge-foundations` and `title-foundations-complete`: recorded mastery checks for all four foundation modules.
- `badge-core`: recorded mastery checks for all nine core modules.
- `badge-first-review`: a positive recorded `review:` XP event.

Inventory returns owned/eligible/locked items, rule/criteria, evidence and equipment. Claim/equip commands have a separate replay ledger; they award no XP and create no activity. Owned retired items retain the original public snapshot/evidence and remain available for compatible equipment slots. Server checks owner and item kind; omitted slots remain unchanged, explicit null unequips. See [server contract](../server/README.md#rewards-and-learning-activity) for routes. Visual keys are identifiers, not delivered artwork; player-level policy and multiplayer rank are not supplied.

`GET /api/me/activity` returns a bounded inclusive calendar (default 30, maximum 366 days) and current/longest UTC streaks computed from all recorded learning-day history. Current streak runs through today if active, otherwise yesterday. The basis is rewarded learning events, never login, zero-XP bonus, claim/equip or trading. This is descriptive history, not a daily obligation or check-in reward.

## Safety boundaries

Profit, trade count, volume, order placement, fills and increased leverage must never create rewards or ranks. No reward may depend on funding or linking a brokerage account. A reasoned no-trade choice is valid, not a lower-status result.

Readiness precedes markets, products, portfolio construction, execution and risk. Every actual simulated order requires a prior written plan; routine choices/classifications do not place orders or require essays. Only `m05-l01` currently binds a final graded simulation audit. Its synthetic case supplies no investment thesis and is not a recommendation to buy NORTH. Completion checks an accurate observed audit, rejection of a fill guarantee and a verified reason if no orders exist, not inactivity, profit or order count. The separate bonus remains independent. Other lesson bindings and Module 9 multi-scenario assessment remain pending. Advanced execution and multiplayer are not implemented; bounded endless simulation after nine module checks is not multiplayer.

Keep the core jurisdiction-neutral. Product terms, tax, account rules, settlement periods, margin thresholds and reporting channels require reviewed localization. Current sources include US and Spanish regulators without importing their local legal rules into the core. Content remains pending independent financial/pedagogical review; production publication fails closed. Local checks do not establish learning efficacy.

No loss-chasing, broken-streak shame, countdowns, urgent market notifications, order confetti, profit leaderboards, one-swipe execution or copy-trading. A helper character may explain a misconception, not pressure the learner, praise financial gains or express disappointment at a break. Frontend design remains the teammate's scope.
