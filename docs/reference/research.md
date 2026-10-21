# Research

The [game design document](../game-design.md) §10 asks the app to record how
players with different prior knowledge decide, and to separate first attempts
from retries. `server/app/research.py` provides owner-scoped exports and a
default-off study enrollment. These are operational records: no approved
study, validated learning rubric or measured learning outcome exists.

## Recorded data

- **Game events** (`game_events`): every human command with what the player
  saw: tick, visible prices, cash, available cash, equity, holdings, open
  order count and the latest headline id. Kinds: `start`, `plan`, `clock`,
  `order`, `rejected`, `cancel`, `finish`, `reflection`. A solo `start` also
  stores the plan, the attempt number for that scenario, the mode, scenario
  id, version and difficulty, and the game context (for a daily: day, attempt
  and any Gem refresh key).
- **Campaign progress**: per level the first-try check score and stars, per
  boss kind the wins and attempts, and the first answer to every check
  question.
- **Quiz attempts**: questions, option order, each first answer, optional
  confidence, score and pass.

Each chapter's Preview Battle (before the lessons) and Chapter Boss (after)
use the same scenario with different seeds: a pre/post pair that has not been
validated as an assessment.

## Exports

`GET /api/me/research/export/{kind}` returns JSON (`format_version: 2`) for the
signed-in player only.

| Kind                | Records                                                                     | Paging                                                |
| ------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| `game-events`       | One per event, with the game's mode, scenario, chapter, level and boss kind | `limit` 1–100 (default 50); `cursor` = last record id |
| `campaign-progress` | Level, boss and check-answer records                                        | None                                                  |
| `quiz-attempts`     | One per attempt                                                             | As `game-events`                                      |

The daily shared seed is removed from exported context because it would
reveal other players' first-attempt market. A cursor that is not the caller's
own record returns 404. Exports need no enrollment and are not available to
instructors or researchers for other players.

## Study enrollment

Off unless `RESEARCH_ENABLED=true` with a nonblank `RESEARCH_POLICY_VERSION`
(1–80 characters, no surrounding spaces) and `RESEARCH_POLICY_TEXT`; startup
fails if enabled without them. Enable it only after ethics and privacy
approval; configuration does not grant that approval.

| Route                                                               | Effect                                                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /api/me/research`                                              | Policy, its SHA-256 `policy_digest` and the player's metadata                                       |
| `POST /api/me/research/metadata {idempotency_key, prior_knowledge}` | Self-reported level (`unknown`, `none`, `some`, `experienced`); the first report is kept separately |
| `POST /api/me/research/consents`                                    | Needs `accepted: true` and the current `policy_version` and `policy_digest`; stale returns 409      |
| `POST /api/me/research/withdrawals`                                 | Stops participation and keeps existing records                                                      |

Each command needs an 8–100 character `idempotency_key`; the same key and body
return the stored response, a different body returns 409.

Not implemented: cohort or researcher access, retention periods, account
deletion, removal of collected study data, a validated prior-knowledge measure
and any analysis pipeline.

## Evaluation plan

A proposed study. Before recruitment: obtain ethics review and informed
consent, define eligibility and withdrawal, and preregister outcomes, sample
size (from a justified power or precision analysis) and analysis. Use
simulated money and fictional companies only.

| Outcome                     | Proposed evidence                                                  | Current support and gap                                                                                        |
| --------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Financial understanding     | Parallel pre/post questions with reviewed answer keys              | Check first-try accuracy and quiz first answers; neither bank is validated or independently reviewed           |
| Applied decisions           | Pre/post performance in comparable unfamiliar markets              | Preview vs Chapter Boss: same scenario, two seeds, so not an unfamiliar transfer task; difficulty uncalibrated |
| Retention                   | Delayed unseen checks at a fixed follow-up                         | The daily review repeats bank items weighted toward misses; no scheduled delayed test                          |
| Risk behaviour              | Stop-loss use, position size and drawdown in unfamiliar markets    | Results record stop discipline, largest position, worst drawdown and fees; descriptive only                    |
| Plan adherence              | Frozen prior plan vs actual decisions                              | The loss limit is compared with worst drawdown; strategy adherence is not scored                               |
| Probability accuracy        | Confidence, first-attempt correctness and calibration              | Optional `sure`/`think`/`guess` on quiz answers; no calibration statistic                                      |
| Reflection                  | Independent ratings of evidence, uncertainty and justified changes | Optional post-match reflection, stored, not graded                                                             |
| Usability                   | Task success, errors, time to first useful action, interviews      | No participant testing yet; see [performance](../operations/performance.md#first-time-tasks)                   |
| Engagement without pressure | Return rate and a survey of pressure or loss-chasing intent        | Activity days and match counts are recorded; more play is not automatically good                               |

Design rules: use alternate forms and counterbalancing; randomise assignment
when comparing with another experience and keep exposure comparable; separate
first attempts from retries (the event log records attempt numbers and
Gem-enabled daily retries); report attrition, missing confidence, uncertainty
and null results. The decision score is an unvalidated heuristic, not an
outcome measure. Have independent reviewers check content accuracy and rubric
agreement first, and set a stopping process for misleading content, distress
or increased pressure to speculate. Do not infer real-market competence from a
simulated gain.
