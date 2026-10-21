# Campaign and progression

The Adventure campaign is implemented in `server/app/campaign/` from the
chapter files in `server/app/content/campaign/`. Formulas and payloads are in
the [build contract](game-architecture.md); the content design is in the
[curriculum spec](curriculum/game-spec.md).

## Structure

Eight chapters, five levels each:

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
reward node after any level that has a map reward. Chapters 2–8 also offer a
Gate Boss while locked.

## A level

1. **Lesson cards**: 4–5 cards, each optionally with an interactive visual
   (`client/features/level/visuals/`).
2. **Check**: 4–5 multiple-choice or true/false questions.
   `POST /api/campaign/levels/{id}/check` grades one answer and returns the
   explanation. The first answer to each question is stored as first-try
   accuracy (`campaign_checks`). A wrong answer is queued again in the client
   until it is answered correctly. `POST …/check/complete` succeeds only when
   every question has a correct answer; it records the first-try score and
   awards 10 XP once.
3. **Practice mission**: a trading match on the level's scenario
   (`chN-lM-practice`), available once the check is complete. Basic and bonus
   missions are listed on the level and evaluated live in the arena.

Stars, raised but never lowered:

- **Normal star**: check complete and every basic mission done in one match
  (20 XP once). It also grants the level's map reward, if any.
- **Special star**: every bonus mission done in one match (10 XP once). A
  scenario without bonus missions cannot give a special star.

## Bosses

| Kind    | `boss` value | Scenario                            | Opens when                                            | On a win                                                                                                                                                              |
| ------- | ------------ | ----------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview | `preview`    | This chapter's boss, fresh seed     | The chapter is unlocked                               | Never recorded as a win (the result's `won` flag can still be true; settlement ignores it). First play gives 10 XP and opens Level 1. It is the research pre-measure. |
| Gate    | `gate`       | Previous chapter's boss, fresh seed | Chapters 2–8; the chapter card offers it while locked | 50 XP on the first win. Unlocks the chapter if it was locked.                                                                                                         |
| Chapter | `final`      | This chapter's boss                 | Every level in the chapter has a normal star          | 50 XP on the first win, normal star, the chapter's guide avatar, and the next chapter. All boss bonus missions also give the special star and the chapter's title.    |

A win needs rank 1 on profit, unshared, without forfeiting. Retries are
unlimited and each uses a new random seed. Results are kept in `boss_results`
(kinds `preview`, `gate`, `boss`) with best profit and attempt counts.

## Unlocks

- Chapter 1 is open. Chapter _n_ unlocks by winning chapter *n*−1's boss or
  chapter _n_'s gate boss (`unlocked_by`: `start`, `boss` or `gate`).
- Level 1 opens after the Preview Battle has been played; each later level
  needs the previous level's normal star.
- The Chapter Boss needs a normal star on all five levels.
- The daily challenge unlocks with the Chapter 1 boss; ranked matchmaking with
  the Chapter 3 boss. Private lobbies and quizzes for unlocked chapters have
  no campaign prerequisite.

A gate win opens the chapter but does not give stars for the skipped chapter.
Each chapter holds 12 stars (5 levels × 2 plus the boss × 2).

## Reads

- `GET /api/campaign`: chapter cards with state (`locked`, `open`,
  `complete`), stars, levels done and the gate state, plus a `next` target for
  the Continue button (the Preview Battle, the first level without a normal
  star, or the boss).
- `GET /api/campaign/chapters/{id}`: map nodes in path order with state
  (`locked`, `open`, `done`), stars, XP available, rewards, best profit,
  attempts and a lock reason.
- `GET /api/campaign/levels/{id}`: cards, check questions without answers,
  the practice summary and progress. Returns 403 while the chapter is locked.
- `GET /api/archive`: glossary terms from unlocked chapters.
- `GET /api/bosses`: every gate and chapter boss for the play hub.

These reads are public. Signed-out visitors see Chapter 1 open and nothing
earned; starting a match or answering a check needs a session.

## Limits

The content is authored but has not been independently reviewed for financial
accuracy or teaching quality. Stars and boss wins show completed objectives,
not validated competence. The Preview/boss pair uses one scenario with two
seeds; it is not a validated pre/post test.
