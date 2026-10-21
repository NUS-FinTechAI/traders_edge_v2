# Quizzes

`server/app/quiz/`, from `server/app/content/quiz_bank.json` (version
`2026-10-21.1`, 160 questions, 20 per chapter). Quiz questions are separate
from lesson checks; the validator rejects a quiz prompt that repeats a check
prompt. The bank format is in the [authoring guide](../content/authoring.md#quiz-bank).

## Topics

`GET /api/quizzes` lists topics with question counts, best score and pass
state, plus the player's rooms.

| Topic         | Id             | Questions                                                                    | Pass   |
| ------------- | -------------- | ---------------------------------------------------------------------------- | ------ |
| Chapter quiz  | `chapter-<N>`  | 10, sampled from that chapter; locked until the chapter is unlocked          | ≥ 80 % |
| Daily Review  | `daily-review` | 5 from unlocked chapters, weighted toward concepts missed in earlier answers | none   |
| Mixed Mastery | `mixed`        | 20, interleaved across unlocked chapters                                     | ≥ 80 % |

XP for each topic is in [progression](progression.md#xp-and-levels).

## Attempts

- `POST /api/quizzes/attempts {topic_id}` starts an attempt. Question order and
  option order are shuffled and stored on the attempt.
- `POST /api/quizzes/attempts/{id}/answers {question_id, option_id,
confidence?}` grades one answer and returns the attempt with feedback for
  answered questions. `confidence` is optional: `sure`, `think` or `guess`.
- The first answer is final: resending the same option returns the attempt; a
  different option returns 409.
- The attempt completes when every question is answered; XP, the activity day
  and badges are then updated.

## Classroom rooms

- Any signed-in player can create a room: `POST /api/quizzes/rooms {topic_id,
title}` returns a six-character join code.
- A student joins by starting an attempt with `room_code`. Each member gets
  one attempt per room; starting again returns the same attempt.
- Room attempts draw from every chapter, whatever the student has unlocked.
- `GET /api/quizzes/rooms/{id}`: the host sees every member's score and
  finished state; a member sees only their own row.
- Room attempts give no XP, activity day or badge progress.
- There is no room capacity limit, closing control or instructor allowlist.

Quiz scores show recall of authored questions, not validated knowledge or
trading skill. Confidence answers feed the Calibrated badge and the research
export; no calibration statistic is shown to players.
