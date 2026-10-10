# Learning rewards and safety

The backend separates learning rewards from the game economy authorized by the [supplied brief and ADR 0003](decisions/0003-gameplay-brief-authority.md). Neither learning XP nor competitive profit establishes competence or future profitability. The API awards 20 XP once per passed lesson, 50 once per module check and 10 once per passed delayed review (`review:<lesson_id>`). Retries cannot farm these events. The optional leaderboard ranks opted-in pseudonyms by learning XP, not multiplayer rank. Merging the code does not approve the authored content for publication or establish deployment readiness.

Module maps project standard completion and separate verified bonus stars for all 30 levels. Bonuses grant zero XP/activity and never gate progress. Replay returns the saved completion state rather than granting an additional reward; `bonus_star` is completion state, not an award delta. Legacy completion remains labeled; no baseline or bonus evidence is fabricated. Older module-level reflection prompts are content-only; text length is not assessed reasoning quality.

## Implemented finite inventory

`server/app/rewards.py` owns six code-policy items, each at rule version `1`:

- `badge-first-lesson` and `avatar-compass`: a positive recorded `lesson:` XP event.
- `badge-foundations` and `title-foundations-complete`: recorded mastery checks for all four foundation modules.
- `badge-core`: recorded mastery checks for all nine core modules.
- `badge-first-review`: a positive recorded `review:` XP event.

Inventory returns owned/eligible/locked items, rule/criteria, evidence and equipment. Claim/equip commands have a separate replay ledger; they award no XP and create no activity. Owned retired items retain the original public snapshot/evidence and remain available for compatible equipment slots. Server checks owner and item kind; omitted slots remain unchanged, explicit null unequips. See [server contract](../server/README.md#rewards-and-learning-activity) for routes. Visual keys are identifiers, not delivered artwork. The separate economy derives player level from total XP; public human multiplayer uses its separate Elo rating, not the learning leaderboard.

`GET /api/me/activity` returns a bounded inclusive calendar (default 30, maximum 366 days) and current/longest UTC streaks computed from all recorded learning-day history. Current streak runs through today if active, otherwise yesterday. The basis is rewarded learning events, never login, zero-XP bonus, claim/equip or trading. This is descriptive history, not a daily obligation or check-in reward.

## Separate game rewards

[Economy policy 1](economy.md) implements UTC login claims, first daily AI-victory Stocks, weekly expiry, a two-hour daily defeat/abandonment cooldown, premium refresh and finite shop purchases. These rewards use server-persisted game events and never insert learning activity or qualifying lesson/review evidence. Profiles expose `learning_xp`, `game_xp` and `player_level`; level is 1 plus one level per 100 total XP, not a competence score. [Public paired matches](multiplayer.md) now settle 10 game XP per finisher plus 10 premium for a unique winner or 5 for another finisher; tied finishers receive 5 each. Private matches and forfeiting participants receive no completion award, and private matches do not alter public rating. Supplementary standalone quizzes award once-only game XP under the [quiz policy](quizzes.md); private classroom quizzes award none. No real-money purchase endpoint exists.

Shared AI and chapter/daily results rank net portfolio profit under [versioned challenge](challenges.md) and [adventure](adventure.md) contracts. Boss victories grant game chapter access, not earlier learning mastery. The opponent defaults and chapter associations are not validated difficulty or concept-specific assessment. A no-order decision can win by outperforming opponents; game rank is not a judgment that trading is necessary or that a profitable decision was sound.

## Safety boundaries

Learning mastery and learning-earned badges must not use profit. Versioned simulated competitions may rank net profit and settle their game rewards under ADR 0003. Individual order placement, fills, trade count, volume or increased leverage do not earn rewards. No reward may depend on funding or linking a brokerage account. Reasoned no-trade decisions remain valid.

Readiness precedes markets, products, portfolio construction, execution and risk. Every actual simulated order requires a prior written plan; routine choices/classifications do not place orders or require essays. Only `m05-l01` currently binds a final graded simulation audit. Its synthetic case supplies no investment thesis and is not a recommendation to buy NORTH. Completion checks an accurate observed audit, rejection of a fill guarantee and a verified reason if no orders exist, not inactivity, profit or order count. The separate bonus remains independent. Other lesson bindings and Module 9 multi-scenario assessment remain pending. Advanced execution remains absent. Human multiplayer is separately implemented: private lobbies require structured mastery of chapters 1–4 and public matchmaking requires 1–9. Boss-earned access cannot bypass those checks. Bounded endless simulation remains a distinct mode.

Keep the core jurisdiction-neutral. Product terms, tax, account rules, settlement periods, margin thresholds and reporting channels require reviewed localization. Current sources include US and Spanish regulators without importing their local legal rules into the core. Content remains pending independent financial/pedagogical review; production publication fails closed. Local checks do not establish learning efficacy.

No loss-chasing, broken-streak shame, countdowns, urgent market notifications, order confetti, one-swipe execution or copy-trading. Simulated competition standings must identify their game basis and must not claim real-world financial skill. A helper may explain misconceptions or factual game results without pressuring learners, promising returns or expressing disappointment at a break. Frontend design remains the teammate's scope.
