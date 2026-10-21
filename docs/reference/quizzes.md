# Quizzes and classroom rooms

Quiz mode is implemented in `server/app/quiz/` from
`server/app/content/quiz_bank.json` (version `2026-10-20.1`, 160 questions,
20 per chapter). Quiz questions are separate from lesson check questions; the
content validator rejects a quiz prompt that repeats a check prompt.

## Topics

`GET /api/quizzes` lists the topics with question counts, best score and
pass state, plus the player's rooms.

| Topic         | Id             | Questions                                                                         | Pass         | XP                              |
| ------------- | -------------- | --------------------------------------------------------------------------------- | ------------ | ------------------------------- |
| Chapter quiz  | `chapter-<N>`  | 10, sampled from that chapter                                                     | ≥ 80 %       | 20 on the first pass of a topic |
| Daily Review  | `daily-review` | 5 from unlocked chapters, weighted toward concepts missed in earlier quiz answers | no pass mark | 10 once per UTC day             |
| Mixed Mastery | `mixed`        | 20, interleaved across unlocked chapters                                          | ≥ 80 %       | 50 on the first pass            |

A chapter quiz is locked until its chapter is unlocked in the campaign.

## Attempts

- `POST /api/quizzes/attempts {topic_id}` starts an attempt. Questions and
  option order are shuffled and stored on the attempt.
- `POST /api/quizzes/attempts/{id}/answers {question_id, option_id,
confidence?}` grades one answer and returns the attempt with feedback for
  answered questions: correct or not, the correct option and the explanation.
  `confidence` is optional: `sure`, `think` or `guess`.
- The first answer to a question is final. Resending the same option returns
  the attempt; a different option returns 409.
- The attempt completes when every question is answered. XP is awarded on
  completion as in the table, and the activity day and badges are updated.

Feedback is immediate for every quiz. The Calibrated badge uses "sure"
answers; Quiz Master counts perfect standalone quizzes.

## Classroom rooms

- Any signed-in player can create a room: `POST /api/quizzes/rooms {topic_id,
title}` returns a six-character join code (no `0`, `O`, `1` or `I`).
- A student joins by starting an attempt with `room_code`. Joining adds them
  as a member. Each member gets one attempt per room; starting again returns
  the same attempt.
- Room attempts draw from every chapter, whatever the student has unlocked.
- `GET /api/quizzes/rooms/{id}` shows the topic, member count and results. The
  host sees every member's score and finished state; a member sees only their
  own row. The host polls this view every 5 s in the client.
- Room attempts give no XP, no activity day and no badge progress.

There is no room capacity limit, closing control or instructor allowlist in the
current code.

## Limits

Quiz scores show recall of authored questions. They are not a validated
measure of knowledge or trading skill, and the bank has not been independently
reviewed for financial accuracy. Confidence answers are stored for the
Calibrated badge and for research export; no calibration statistic is
reported to players.
