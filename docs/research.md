# Research evidence and study metadata

The game design document (§10) asks the app to record how players with
different prior knowledge make decisions, and to tell first attempts from
retries. `server/app/research.py` provides owner-scoped exports of those
records and a separately configured, default-off study enrollment. These are
operational records; they are not an approved study, a validated learning
rubric or evidence of learning.

## What is recorded

- **Game events** (`game_events`): every human command in a match with the
  context the player saw: tick, prices, cash, available cash, equity,
  holdings, the number of open orders and the latest headline id. Kinds:
  `start`, `plan`, `clock`, `order`, `rejected`, `cancel`, `finish`,
  `reflection`. The solo `start` event also records the plan, the attempt
  number for that scenario, the mode, scenario id, version and difficulty, and
  the game context (for a daily: the day, the attempt that day and the Gem
  refresh key when a refresh enabled it).
- **Campaign progress**: per level the first-try check score and stars, per
  boss kind the wins and attempts, and the first answer to every check
  question.
- **Quiz attempts**: questions, option order, each first answer, optional
  confidence, score and pass.

The Preview Battle (before the lessons) and the Chapter Boss (after them) use
the same scenario with different seeds, which gives a pre/post pair per
chapter. That pairing has not been validated as an assessment.

## Owned exports

`GET /api/me/research/export/{kind}` returns JSON (`format_version: 2`) for
the signed-in player only, with a download filename.

| Kind                | Records                                                                                 | Paging                                                |
| ------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `game-events`       | One record per game event, with the game's mode, scenario, chapter, level and boss kind | `limit` 1–100 (default 50), `cursor` = last record id |
| `campaign-progress` | Level, boss and check-answer records                                                    | Not paged; all records in one response                |
| `quiz-attempts`     | One record per attempt                                                                  | `limit` and `cursor` as above                         |

The daily shared seed is removed from exported event context, because it would
reveal other players' first-attempt market. A cursor that is not the caller's
own record returns 404. Exports do not need study enrollment and are not
available to instructors or researchers for other players.

## Study participation

Enrollment is off unless `RESEARCH_ENABLED=true` with a nonblank
`RESEARCH_POLICY_VERSION` (1–80 characters, no surrounding spaces) and
`RESEARCH_POLICY_TEXT`; startup fails if enabled without them. Enabling it
does not establish ethics or privacy approval; obtain that first.

- `GET /api/me/research` returns the policy, its SHA-256 `policy_digest` and
  the player's metadata.
- `POST /api/me/research/metadata {idempotency_key, prior_knowledge}` stores a
  self-reported level (`unknown`, `none`, `some`, `experienced`). The first
  report is kept separately and never changes.
- `POST /api/me/research/consents` needs `accepted: true` and the current
  `policy_version` and `policy_digest`; a stale version or digest returns 409.
- `POST /api/me/research/withdrawals` stops participation and keeps existing
  records.

Each command needs an 8–100 character `idempotency_key`. The same key and body
return the stored response; the same key with a different body returns 409.

## Not implemented

Cohort or researcher access, retention periods, account deletion, removal of
collected study data, a validated prior-knowledge measure and any analysis
pipeline.
