# Progression

The campaign is `server/app/campaign/`, built from
`server/app/content/campaign/ch1.json … ch8.json`. The player economy is
`server/app/player/` (profile, XP, wallet, streak, cosmetics, badges, shop,
leaderboards). Boss rules and settlement are in [matches](matches.md). Every
award uses a natural unique key, so a repeated request pays nothing. All
amounts are product defaults, not research findings. The in-game earning
guide (HUD balance chips, the profile and the shop) repeats these amounts from
`client/features/profile/earnRules.ts`; change both together.

## Campaign

| Chapter | Title                   | Region           |
| ------- | ----------------------- | ---------------- |
| 1       | Market Basics           | Harbor of Basics |
| 2       | Orders & the Order Book | Order Book Bay   |
| 3       | Reading Charts          | Chart Cliffs     |
| 4       | Risk Management         | Risk Reef        |
| 5       | Indicators              | Indicator Isles  |
| 6       | News & Fundamentals     | News Coast       |
| 7       | Trading Strategies      | Strategy Summit  |
| 8       | Trader Psychology       | Mindset Peak     |

A chapter map is `Preview Battle → Level 1 … Level 5 → Chapter Boss`, with a
reward node after any level that has a map reward. Locked chapters 2–8 offer a
Gate Boss.

A level has three steps:

1. **Lesson cards**: 4–5 cards, some with an interactive visual
   (`client/features/level/visuals/`).
2. **Check**: 4–5 multiple-choice or true/false questions.
   `POST …/check` grades one answer and returns the explanation; the client
   re-queues a wrong answer until it is right. The first answer to each
   question is stored as first-try accuracy (`campaign_checks`).
   `POST …/check/complete` succeeds once every question has a correct answer.
   A replayed check must be answered again before completing.
3. **Practice mission**: a `level` match on `chN-lM-practice`, open once the
   check is complete.

Stars are raised, never lowered:

- **Normal star**: check complete and every basic mission done in one match.
  Also grants the level's map reward.
- **Special star**: every bonus mission done in one match. A scenario without
  bonus missions cannot give one.
- Each chapter holds 12 stars: 5 levels × 2 plus the boss × 2.

## Unlocks

| Unlocks                   | When                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| Chapter 1                 | Always open                                                                                       |
| Chapter _n_               | Chapter *n*−1's boss won, or chapter _n_'s gate boss won (`unlocked_by`: `start`, `boss`, `gate`) |
| Level 1                   | Preview Battle played to its last day                                                             |
| Level _n_                 | Level *n*−1's normal star                                                                         |
| Chapter Boss              | A normal star on all five levels                                                                  |
| Daily challenge           | Chapter 1 boss won                                                                                |
| Ranked matchmaking        | Chapter 3 boss won                                                                                |
| Private lobbies, practice | No prerequisite                                                                                   |
| Chapter quiz              | Its chapter unlocked                                                                              |

A gate win opens the chapter but gives no stars for the skipped one. Locked
items return 403 with the reason (for example "Finish Level 2 first").

Campaign reads (`/api/campaign`, chapter maps, levels, `/api/archive`,
`/api/bosses`, `/api/practice`) work signed out: Chapter 1 open, nothing
earned. `GET /api/campaign` includes a `next` target for the Continue button:
the Preview Battle, the first level without a normal star, or the boss.

## XP and levels

| Source                                    | XP                         |
| ----------------------------------------- | -------------------------- |
| Level check finished (first time)         | 10                         |
| Level normal / special star (first time)  | 20 / 10                    |
| Preview Battle (first play to the end)    | 10                         |
| Gate or Chapter Boss (first win of each)  | 50                         |
| Daily: finished / won (each once per day) | 15 / 15                    |
| Practice match finished (max 3 per day)   | 10                         |
| Ranked match: loss / win (max 5 per day)  | 10 / 20                    |
| Chapter quiz ≥ 80 % (first pass)          | 20                         |
| Mixed mastery ≥ 80 % (first pass)         | 50                         |
| Daily review quiz (once per day)          | 10                         |
| Daily login, streak day 1–7               | 10, 10, 10, 10, 20, 20, 20 |

No XP is paid per order, trade count or volume. Forfeits, private lobby
matches and classroom quiz rooms give none.

Level _L_ to _L_+1 costs `100 + 25·(L−1)` XP; the cap is level 50. Ranks
(`RANKS` in `player/levels.py`) are nautical so they never claim trading
skill: Deckhand (1–4), Able Seaman (5–9), Navigator (10–14), Quartermaster
(15–19), First Mate (20–29), Captain (30–39), Commodore (40–49), Admiral (50).
Each rank is also a `rank` title in `cosmetics.json` (`title-rank-<name>`),
owned on reaching its level; the two lists must stay in step.

## Currencies

| Currency  | Icon      | Held in                                 | Earned from                                                 | Spent on                                       |
| --------- | --------- | --------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| Sim cash  | green `$` | One match only                          | Scenario starting cash                                      | Simulated orders                               |
| Doubloons | gold coin | Wallet, `stocks_balance` (GDD "Stocks") | Daily login; first daily win of the day (200)               | The weekly title (1,000)                       |
| Gems      | purple    | Wallet, `premium_balance`               | Ranked play only ([amounts](multiplayer.md#ranked-rewards)) | Shop cosmetics; skipping a daily cooldown (20) |

Doubloons expire at Monday 00:00 UTC: the first wallet write of a new week
zeroes them and records `expiry:<week>`. Gems do not expire and are never sold
for real money; there is no purchase endpoint.

The balance chips open an earning guide. Each earning row links to its
activity page and closes the dialog; the Streak tab has one daily check-in
link to Home. The dialog omits footer notes.

## Login streak

`POST /api/me/daily-login` claims once per UTC day; a second claim returns
`already_claimed: true`. Consecutive days extend the streak; a missed day
restarts it at day 1 with no other penalty. Rewards repeat in a 7-day cycle:

| Cycle day | 1   | 2   | 3   | 4   | 5   | 6   | 7   |
| --------- | --- | --- | --- | --- | --- | --- | --- |
| Doubloons | 20  | 20  | 20  | 30  | 30  | 30  | 50  |
| XP        | 10  | 10  | 10  | 10  | 20  | 20  | 20  |

## Shop and cosmetics

`GET /api/shop` lists priced items from `cosmetics.json`;
`POST /api/shop/purchase {item_id}` buys one once.

| Section | Sources (shipped)                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Avatars | `starter` (4, owned by everyone), `boss` (8 guide avatars, one per chapter boss win), `map` (4), `shop` (12 animals, 120 Gems each)                      |
| Titles  | `rank` (8), `boss_special` (8, one per chapter boss special star), `map` (4), `weekly` (Colossal Challenger, 1,000 Doubloons), `shop` (3, 300 Gems each) |
| Themes  | `shop` (3 candle themes, 100 Gems each), `free` (colour-blind-safe and high-contrast palettes)                                                           |
| Badges  | 16, earned only                                                                                                                                          |

`PATCH /api/me` equips an owned avatar, title or earned badge. A null
`title_id` shows the rank; a null `badge_id` removes the displayed badge.
Equipped collection cards use a green border and corner tick. Avatars and
titles can be replaced by equipping another owned item. Badges, candle themes
and accessibility palettes show an Unequip button; base themes are replaced
by equipping another base. The Themes gallery keeps the reset-to-default action.
Players choose one badge in Profile → Collection → Badges. Its emblem appears
beside their name in their profile, opted-in public leaderboards and multiplayer
lobbies, with an accessible badge name. Equipping never grants a badge or reward.
Themes are equipped in the profile's Themes gallery and stored per
device in the browser; the server records ownership only.
`GET /api/me/collection` lists badges, avatars and titles with owned and
equipped state, how to unlock each, and summary stats.

## Badges

Badges are earned only and based on process, not profit size
(`player/badges.py`). Match badges count any non-private match; none needs a
profit-ranked win, and orders cancelled on the tick they were placed never
count. Badges are checked after each settled non-private match, check
completion, standalone quiz and login claim. Some conditions are proxies for
the [curriculum spec](../content/curriculum-spec.md) §B6 wording.

| Badge          | Condition                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------ |
| First Steps    | Normal star on Chapter 1 Level 1                                                                 |
| First Plan     | Finish a match (no forfeit) with a plan and at least one fill                                    |
| Quick Learner  | 10 level checks with every question right first time                                             |
| Chart Reader   | Win the Chapter 3 boss                                                                           |
| Risk Manager   | Finish a match where every bought symbol had a stop-loss placed and the worst drawdown was ≤ 2 % |
| Sniper         | 5 limit orders placed and not cancelled, across finished matches                                 |
| Fee Fighter    | Finish a scenario whose id contains `chop` or `range` with at least 3 trades and fees under $30  |
| Cool Head      | At least 3 orders, and every buy after a sale is no larger than the buy before it                |
| Patient Trader | Finish within the loss limit with at least one order and none before 40 % of the match           |
| Explorer       | Every special star in one chapter (5 levels and the boss)                                        |
| Gatecrasher    | Win any gate boss                                                                                |
| Boss Slayer    | Win every chapter boss                                                                           |
| Streak Master  | A 30-day login streak                                                                            |
| Quiz Master    | 10 standalone quizzes with a perfect score                                                       |
| Ranked Debut   | 5 ranked matches finished without forfeiting                                                     |
| Calibrated     | At least 20 "sure" quiz answers, at least 85 % of them correct                                   |

## Activity and leaderboards

Settling a non-private match, finishing a check, finishing a standalone quiz
and claiming the login reward each record a UTC activity day.
`GET /api/me/activity` returns the last 365 days with a count of XP events per
day (heatmap), the streak length and the current 7-day reward cycle.

`GET /api/leaderboards/xp` ranks by total XP and `GET /api/leaderboards/ranked`
by Elo. Both show only players who opted in with `leaderboard_opt_in` (default
off), list the top 50 and include the caller's own rank and value.

XP, stars, badges and rank show activity and completed objectives, not
validated trading competence.
