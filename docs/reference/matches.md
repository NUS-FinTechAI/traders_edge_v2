# Trading matches

Every mode plays the same match on the trading engine in `server/app/game/`.
This page describes the modes and the match lifecycle. The engine rules are in
the [engine model](engine.md); exact payloads are in the
[build contract](../game-architecture.md#games).

## Modes

| Mode       | Created by                         | Scenario                                                                 | Opponents                         | Clock             |
| ---------- | ---------------------------------- | ------------------------------------------------------------------------ | --------------------------------- | ----------------- |
| `level`    | `POST /api/games {mode, level_id}` | The level's `chN-lM-practice`                                            | The scenario's bots (0–1 shipped) | Solo              |
| `boss`     | `{mode, chapter_id, boss}`         | Chapter or previous-chapter boss (see [campaign](progression.md#bosses)) | 1–3 bots                          | Solo              |
| `daily`    | `{mode: "daily"}`                  | Today's weekday scenario                                                 | One bot                           | Solo              |
| `practice` | `{mode, scenario_id?, bots?}`      | A `practice-*` market (random if omitted)                                | Up to 3 of the scenario's bots    | Solo              |
| `private`  | Lobby start                        | The host's `mp-*` or `practice-*` choice                                 | 2–30 humans plus 0–3 bots         | Fixed 3 s per day |
| `ranked`   | Matchmaking                        | A random `mp-*` market                                                   | Two humans, no bots               | Fixed 3 s per day |

Solo clock: 2 s per day at 1×, with 2× and 4×, pause and "next day" (only
while paused). Multiplayer clock commands return 403.

## Lifecycle

1. **Briefing** (`status: briefing`). The match shows the scenario, the
   history bars and the rivals. The player picks a plan: a strategy (`trend`,
   `dip`, `breakout`, `news`, `hold` or `cautious`) and a maximum loss of
   1–50 %.
2. **Start** (`POST /start`). Solo: stores the plan and starts the clock.
   Multiplayer matches are already running; `start` stores the plan once.
3. **Trading** (`running`). Market orders fill at once at the close plus or
   minus half the spread. Limit and stop-loss orders rest and are checked
   against each later bar. Orders the scenario does not allow, or that break
   cash, holdings or position-size rules, are rejected with a reason. Missions
   update live (`pending`, `on_track`, `behind`, `done`, `failed`). Bots show
   only their profit, rank and style.
4. **Ended** (`ended`, derived) once the last day has passed.
5. **Finish** (`POST /finish`). Allowed after the end, or at any time with
   `forfeit: true`. A forfeit ranks the player last, fails every mission and
   cancels open orders. The response is the result: rank, profit, missions,
   stars, rewards, plan review, stats, decision score and breakdown, key
   moments, the scenario debrief and an optional reflection. Calling it again
   returns the stored result. `settled` is set once every human has finished.

`GET /api/games?status=active` lists unfinished matches for resuming.
Disconnecting does nothing to a match: the server clock keeps running and
positions are ranked normally.

## Winning

Profit is final equity (cash plus holdings at the last close) minus starting
cash, after fees and spread. Ranks share equal profits to the cent. A win
needs rank 1, unshared, without forfeiting. Profit decides the match; missions
and the decision score show process and never decide a win.

## Daily challenge

- Unlocks with the Chapter 1 boss.
- Seven scenarios rotate by UTC weekday: `daily-mon-steady-climb`,
  `daily-tue-range-chop`, `daily-wed-pullback`, `daily-thu-earnings-gap`,
  `daily-fri-breakout-fakeout`, `daily-sat-news-shock`,
  `daily-sun-bubble-crash`, each against one bot.
- The first attempt of the UTC day uses the day's shared seed, so everyone
  plays the same market; retries use random seeds.
- Rewards: 15 XP for the first finish of the day (not a forfeit), 15 XP for the
  first win, 200 Doubloons for the first win.
- A loss or forfeit starts a 2-hour cooldown. A cooldown started on an earlier
  UTC day never blocks the new day. `POST /api/daily/refresh` spends 20 Gems
  to clear an active cooldown; the next daily records the refresh key.
- `GET /api/daily` shows the scenario, opponent, attempts today, cooldown,
  win state and the weekly Doubloon track.

## Practice arena

`GET /api/practice` lists the five `practice-*` markets with their bots.
Practice matches are open to every signed-in player. A finished practice match
(not a forfeit) gives 10 XP, at most three times per UTC day.

## Balance

Boss and daily scenarios are checked by the Monte-Carlo gauntlet in
`server/tests/test_game_balance.py`: over seeds 0–49 an idle player must win at
most 5 % of boss matches and 10 % of dailies, and a random clicker at most
10 % and 25 %. Lesson practice scenarios are not gated. The gauntlet uses
synthetic players; it says nothing about how hard a match feels to a person.

## Limits

Bot difficulty, scenario tuning and the decision score are product defaults,
not validated measures. A win shows a better result in one synthetic market,
not trading skill.
