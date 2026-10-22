# Matches

Every mode plays one match on the [trading engine](engine.md).
`POST /api/games` asks the `resolve_game` hook (`campaign/games.py`) what the
player may play; `finish` calls `settle_game` (`campaign/settlement.py`).
Campaign unlocks and XP amounts are in [progression](progression.md);
lobbies, ranked play and Elo are in [multiplayer](multiplayer.md).

## Modes

| Mode       | Created by                    | Scenario                                  | Opponents                         | Clock             |
| ---------- | ----------------------------- | ----------------------------------------- | --------------------------------- | ----------------- |
| `level`    | `{mode, level_id}`            | The level's `chN-lM-practice`             | The scenario's bots (0–1 shipped) | Solo              |
| `boss`     | `{mode, chapter_id, boss}`    | See [bosses](#bosses)                     | The scenario's bots (1–3)         | Solo              |
| `daily`    | `{mode: "daily"}`             | Today's weekday scenario                  | One bot                           | Solo              |
| `practice` | `{mode, scenario_id?, bots?}` | A `practice-*` market (random if omitted) | Up to 3 of the scenario's bots    | Solo              |
| `private`  | Lobby start                   | The host's `mp-*` or `practice-*` choice  | 2–30 humans plus 0–3 bots         | Fixed 3 s per day |
| `ranked`   | Matchmaking                   | A random `mp-*` market                    | Two humans, no bots               | Fixed 3 s per day |

Solo clock: 2 s per day at 1×, with 2×, 4×, pause and "next day" while paused.

## Lifecycle

1. **Briefing** (`briefing`): scenario, history bars and rivals. The player
   picks one game plan: a strategy (`trend`, `dip`, `breakout`, `news`, `hold`,
   `cautious`) and a maximum loss of 1–50 %. Orders are one click; there is no
   per-order plan.
2. **Start** (`POST /start`): solo stores the plan and starts the clock. A
   daily starts only on the UTC day it was created for and outside a cooldown
   (409). Multiplayer matches are already running; each player sets the plan
   once during ticks 0–2, after which `start` returns 409. An order without a
   plan returns 422 "Choose your game plan before trading."
3. **Trading** (`running`): orders, cancels and solo clock commands. Missions
   update live in a dialog opened by the Missions star icon beside How to play.
   The dialog keeps the mission list, completion count and status labels.
   The ticket shows "risk if stopped: $X (Y %)".
4. **Ended** (derived) once the last day has passed.
5. **Finish** (`POST /finish`): allowed after the end, or at any time with
   `forfeit: true`. Returns the [result](engine.md#results). Calling it again
   returns the stored result.

`GET /api/games?status=active` lists unfinished matches to resume.

| Situation     | Rule                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Win           | Rank 1 on profit, unshared, without forfeiting, against at least one opponent                                                             |
| Tie           | Equal profit to the cent shares a rank; a shared first place is not a win                                                                 |
| Early exit    | Leaving a running match forfeits it: last place, every mission failed, open orders cancelled, no win rewards                              |
| After the end | Leaving after the last day finishes normally                                                                                              |
| Disconnect    | Nothing happens; the server clock runs on and positions are ranked normally                                                               |
| Stale match   | Scenario removed or `version` changed: hidden from the active list, unreadable (409), and `finish` closes it as a forfeit with no rewards |

## Bosses

| Kind    | `boss`    | Scenario                            | Playable when                                | Settlement                                                                                                                                                      |
| ------- | --------- | ----------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview | `preview` | This chapter's boss, fresh seed     | The chapter is unlocked                      | Cannot be failed. Playing to the last day records it and opens Level 1; leaving early records an attempt only                                                   |
| Gate    | `gate`    | Previous chapter's boss, fresh seed | Chapters 2–8 while locked (409 once open)    | A win unlocks the chapter                                                                                                                                       |
| Chapter | `final`   | This chapter's boss                 | Every level in the chapter has a normal star | A win gives the normal boss star, the chapter's guide avatar and the next chapter; a win with every bonus mission adds the special star and the chapter's title |

Retries are unlimited, each with a new random seed. Results are kept per kind
in `boss_results` (`preview`, `gate`, `boss`). Gate bosses reuse the previous
boss scenario rather than a separately authored parallel form. The Preview and
the Chapter Boss form the research pre/post pair (see [research](research.md)).

## Daily challenge

- Unlocks with the Chapter 1 boss (403 before).
- Seven scenarios rotate by UTC weekday: `daily-mon-steady-climb`,
  `daily-tue-range-chop`, `daily-wed-pullback`, `daily-thu-earnings-gap`,
  `daily-fri-breakout-fakeout`, `daily-sat-news-shock`,
  `daily-sun-bubble-crash`, each against one bot.
- The first attempt of the UTC day uses the day's shared seed, drawn at random
  on first use and stored in `daily_seeds`; retries use fresh seeds.
- One daily at a time: while today's daily is in the briefing, running or
  ended but unfinished, a new one returns 409 "Finish your current daily
  challenge first" and `GET /api/daily` names it in `active_game_id`. A daily
  that ended unfinished is settled on the next daily request.
- A loss or forfeit starts a 2-hour cooldown. The day resets at 00:00 UTC; a
  cooldown from an earlier day never blocks today. `POST /api/daily/refresh`
  spends 20 Gems to clear an active cooldown and the next daily records the
  refresh key.
- Rewards: daily XP (finish and win, each once per UTC day) and 200 Doubloons
  for the first win of the day.

## Practice arena

`GET /api/practice` lists the five `practice-*` markets with their bots.
Practice is open to every signed-in player. A finished practice match (not a
forfeit) gives practice XP at most three times per UTC day.

## Settlement

`finish` settles once per human participant. The engine result is stored on
`game_participants.result`; a repeat call returns it and only adds a
reflection if none was saved. The hook writes an `economy_events` marker
`game:<id>` holding its response, and every reward has its own natural key, so
nothing pays twice.

| Mode       | Settlement writes                                                    |
| ---------- | -------------------------------------------------------------------- |
| `level`    | Plays, best profit, stars, level map reward, XP                      |
| `boss`     | `boss_results`, boss stars, unlocks, guide avatar, chapter title, XP |
| `daily`    | XP, Doubloons, cooldown                                              |
| `practice` | XP (capped)                                                          |
| `ranked`   | XP, Gems, Elo (see [multiplayer](multiplayer.md#ranked-rewards))     |
| `private`  | Nothing: no rewards, activity day or badges                          |

Every non-private settlement also records an activity day and checks badges.

| Store            | Keys                                                                                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `xp_ledger`      | `level-check:<level>`, `level-normal:<level>`, `level-special:<level>`, `preview:<chapter>`, `boss-win:<chapter>`, `gate-win:<chapter>`, `daily-finished:<day>`, `daily-won:<day>`, `practice:<game>`, `ranked:<game>`, `login:<day>`, `quiz-pass:<topic>`, `quiz-review:<day>` |
| `economy_events` | `game:<game>` (settlement marker), `daily-win:<day>`, `ranked:<game>`, `ranked-first-win:<day>`, `login:<day>`, `purchase:<item>`, `daily-refresh:<cooldown end>`, `expiry:<week>`, `elo:<game>`                                                                                |
| `reward_grants`  | One row per owned avatar, title, theme or badge id                                                                                                                                                                                                                              |

Bot difficulty, scenario tuning and the decision score are product defaults,
not validated measures. A win shows a better result in one synthetic market,
not trading skill.
