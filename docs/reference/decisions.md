# Design decisions

The [game design document](../game-design.md) §12 leaves these questions
open. Each row records the implemented answer and where the detail lives.
[ADR 0004](../decisions/0004-playable-game-overhaul.md) records the decision
to build the game this way.

| Question (GDD §)     | Decision                                                                                                                                                             | Detail                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Profit (§3.3)        | Final equity − starting cash, after fees and spread                                                                                                                  | [Results](engine.md#results)                    |
| Ties (§3.3)          | Equal profit to the cent shares a rank; a shared first is not a win; no opponents means no win                                                                       | [Matches](matches.md#lifecycle)                 |
| Early exit (§3.3)    | Leaving a running match forfeits it: last place, no win rewards                                                                                                      | [Matches](matches.md#lifecycle)                 |
| Stale matches        | A removed or re-versioned scenario closes the match as a forfeit with no rewards                                                                                     | [Matches](matches.md#lifecycle)                 |
| Disconnects (§8.2)   | The server clock runs on; positions are ranked normally                                                                                                              | [Matches](matches.md#lifecycle)                 |
| Duration (§3.3)      | Shipped: lessons 25–36 days, bosses 30–40, practice 32–38, dailies and multiplayer 30; solo 2 s per day at 1× with 2×, 4×, pause and step; multiplayer 3 s, no pause | [Clock](engine.md#clock)                        |
| Starting conditions  | $10,000 simulated cash, long-only, no leverage                                                                                                                       | [Execution](engine.md#execution)                |
| Fees                 | 0.1 % of order value, minimum $1, plus the bid/ask spread, so random clicking loses                                                                                  | [Execution](engine.md#execution)                |
| Plan before trading  | One plan per match (strategy and maximum loss) in the briefing; one-click orders                                                                                     | [Matches](matches.md#lifecycle)                 |
| Order types          | Market from the start, limit after Ch2 L3, stop-loss after Ch2 L4, via each scenario's `allow`                                                                       | [Authoring](../content/authoring.md#scenarios)  |
| AI difficulty (§5.2) | Bosses rise through bot mix, parameters and reaction delay; a Monte-Carlo gauntlet keeps idle and random players losing bosses and dailies                           | [Balance](engine.md#balance-gauntlet)           |
| Daily form (§6)      | Weekday rotation of seven scenarios against one AI; shared first-attempt seed per day; unlocks after the Chapter 1 boss                                              | [Daily](matches.md#daily-challenge)             |
| Open daily, reset    | One daily at a time; reset at 00:00 UTC; a loss starts a 2-hour cooldown                                                                                             | [Daily](matches.md#daily-challenge)             |
| Currencies (§7)      | Sim cash, Doubloons (the GDD's "Stocks", weekly), Gems (premium, ranked and player level-up claims, never sold)                                                      | [Currencies](progression.md#currencies)         |
| Premium refresh      | 20 Gems skips the daily cooldown                                                                                                                                     | [Daily](matches.md#daily-challenge)             |
| Ranked rewards       | Contested wins only; XP and Gems capped at 5 matches per UTC day                                                                                                     | [Ranked rewards](multiplayer.md#ranked-rewards) |
| Ranked rating (§9)   | Elo from 1000, K = 32, pairwise between humans; tiers Bronze to Diamond; private lobbies never rate                                                                  | [Elo](multiplayer.md#elo)                       |
| Lobby size (§8)      | 2–30 humans plus up to 3 AI opponents                                                                                                                                | [Lobbies](multiplayer.md#private-lobbies)       |
| XP                   | Fixed amounts per source; none per order; none for private lobbies or classroom quizzes                                                                              | [XP](progression.md#xp-and-levels)              |
| Unlocks (§4.3)       | Chapter _n_ opens by winning chapter _n−1_'s boss or chapter _n_'s gate boss; retries unlimited and re-seeded                                                        | [Unlocks](progression.md#unlocks)               |
| Multiplayer access   | Private lobbies: no prerequisite. Ranked: Chapter 3 boss                                                                                                             | [Multiplayer](multiplayer.md)                   |
| Matchmaking          | Global pairing lock; searches expire after 2 minutes                                                                                                                 | [Ranked](multiplayer.md#ranked-matchmaking)     |
| Content approval     | Production refuses gameplay routes (503) until `content/review.json` is `approved`                                                                                   | [API](api.md#conventions)                       |
