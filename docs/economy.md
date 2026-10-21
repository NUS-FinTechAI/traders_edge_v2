# Economy and progression

The player economy is implemented in `server/app/player/` (wallet, XP, streak,
shop, badges) and the settle hook in `server/app/campaign/settlement.py`. The
amounts below are product defaults recorded in the
[build contract](game-architecture.md#progression), not research findings.
Every award uses a natural unique key, so a repeated request pays nothing.

## Currencies

| Currency  | Symbol | Where it exists                                           | Earned from                             | Spent on                                       |
| --------- | ------ | --------------------------------------------------------- | --------------------------------------- | ---------------------------------------------- |
| Sim cash  | `$`    | Inside one match only ($10,000 in every shipped scenario) | —                                       | Simulated orders                               |
| Doubloons | gold   | Wallet (`stocks_balance`; the GDD's "Stocks")             | Daily login, first daily win of the day | The weekly title (1,000)                       |
| Gems      | purple | Wallet (`premium_balance`)                                | Ranked matches only                     | Shop cosmetics; skipping a daily cooldown (20) |

Doubloons expire at Monday 00:00 UTC: the first wallet write of a new week
zeroes them and records an `expiry:<week>` event. Gems do not expire. Gems are
never sold for real money; there is no purchase endpoint.

## XP and levels

| Source                                                  | XP                          |
| ------------------------------------------------------- | --------------------------- |
| Level check finished (first time)                       | 10                          |
| Level normal star / special star (first)                | 20 / 10                     |
| Preview Battle (first play)                             | 10                          |
| Gate or Chapter Boss (first win of each)                | 50                          |
| Daily: finished / won (each once per day)               | 15 / 15                     |
| Practice match finished (max 3 per day)                 | 10                          |
| Ranked match: loss / win                                | 10 / 20 (none on a forfeit) |
| Chapter quiz ≥ 80 % / mixed mastery ≥ 80 % (first pass) | 20 / 50                     |
| Daily review quiz (once per day)                        | 10                          |
| Daily login, streak day 1–7                             | 10, 10, 10, 10, 20, 20, 20  |

No XP is paid per order, trade count or volume. Private lobby matches and
classroom quiz rooms give no XP.

Going from level _L_ to _L_+1 needs `100 + 25·(L−1)` XP; the cap is level 50.
Each player level maps to a rank name (`RANKS` in `server/app/player/levels.py`),
and each rank is also a `rank` title in `cosmetics.json` that the player owns
on reaching its level. The two lists must stay in step; the build contract
records the current names.

## Login streak

`POST /api/me/daily-login` claims once per UTC day. Claiming on consecutive
days extends the streak; a missed day restarts it at day 1. Rewards repeat in
a 7-day cycle:

| Cycle day | 1   | 2   | 3   | 4   | 5   | 6   | 7   |
| --------- | --- | --- | --- | --- | --- | --- | --- |
| Doubloons | 20  | 20  | 20  | 30  | 30  | 30  | 50  |
| XP        | 10  | 10  | 10  | 10  | 20  | 20  | 20  |

A second claim on the same day returns `already_claimed: true`. The streak is
a login count only; nothing is lost or locked when it breaks.

## Ranked Gems

Ranked settlement (no forfeit) pays Gems for a win, a smaller amount for a
loss in which the player placed an order, and a bonus for the first ranked win
of the UTC day. The amounts and any daily caps are `RANKED_GEMS` and related
constants in `server/app/campaign/settlement.py`; the build contract records
the current values.

## Activity

Settling a non-private match, finishing a check, finishing a standalone quiz
and claiming the login reward each record a UTC activity day.
`GET /api/me/activity` returns the last 365 days with a count of XP events per
day (for the heatmap), the streak length and the current 7-day reward cycle.

## Shop

`GET /api/shop` lists priced items from `cosmetics.json`;
`POST /api/shop/purchase {item_id}` buys one once.

| Item                               | Price           |
| ---------------------------------- | --------------- |
| 12 animal avatars                  | 120 Gems each   |
| 3 titles                           | 300 Gems each   |
| 3 candle colour themes             | 100 Gems each   |
| Weekly title "Colossal Challenger" | 1,000 Doubloons |

Two accessibility palettes are free. The client does not yet apply any theme
or palette, so owning one has no visible effect.

## Cosmetics and equipment

`PATCH /api/me` equips an owned avatar or title (or clears the title to show
the rank). Players own the four starter avatars and the rank titles they have
reached. Other items come from boss wins (guide avatars), boss special stars
(chapter titles), map rewards, the shop and the weekly title.
`GET /api/me/collection` lists badges, avatars and titles with owned and
equipped state and how to unlock each, plus summary stats.

## Badges

Sixteen badges are earned only and never sold. They reward process rather than
profit size; the implemented conditions are listed in the
[build contract](game-architecture.md#progression). Badges are checked after
each settled non-private match, check completion, standalone quiz and login
claim.

## Leaderboards

`GET /api/leaderboards/xp` ranks players by total XP and
`GET /api/leaderboards/ranked` by Elo rating. Both show only players who opted
in with `leaderboard_opt_in` (default off), list the top 50 and include the
caller's own rank and value.

## Safety

Rewards never depend on trade count, volume or leverage. The login streak has
no penalty or countdown. XP, stars, badges and rank show activity and
completed objectives, not validated trading competence.
