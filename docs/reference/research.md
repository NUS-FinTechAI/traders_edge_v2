# Research

The [game design document](../game-design.md) §10 asks the app to record how
players with different prior knowledge decide, and to separate first attempts
from retries. `server/app/research.py` provides owner-scoped exports and a
default-off study enrollment; `server/app/study/` adds a prior-knowledge
instrument for consenting participants and a researcher dashboard. These are
operational records: no approved study, validated learning rubric or measured
learning outcome exists.

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
(1–80 characters, no surrounding spaces), `RESEARCH_POLICY_TEXT` and
`RESEARCH_PSEUDONYM_SECRET` (at least 32 characters outside development);
startup fails if enabled without them. Enable it only after ethics and privacy
approval; configuration does not grant that approval.

| Route                                                               | Effect                                                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /api/me/research`                                              | Policy, its SHA-256 `policy_digest` and the player's metadata                                       |
| `POST /api/me/research/metadata {idempotency_key, prior_knowledge}` | Self-reported level (`unknown`, `none`, `some`, `experienced`); the first report is kept separately |
| `POST /api/me/research/consents`                                    | Needs `accepted: true` and the current `policy_version` and `policy_digest`; stale returns 409      |
| `POST /api/me/research/withdrawals`                                 | Stops participation and keeps existing records                                                      |

Each command needs an 8–100 character `idempotency_key`; the same key and body
return the stored response, a different body returns 409. Players join or
leave from the Research study panel on their profile, which appears only while
a policy is configured.

Not implemented: cohort assignment, retention periods, account deletion,
removal of collected study data, a validated prior-knowledge measure and any
inferential analysis.

## Prior-knowledge instrument

GDD §10.4 asks how prior knowledge is measured. The instrument is
`server/app/content/research/prior_knowledge.json` (versioned; validated by
`python -m app.content.validate`, which also rejects any item that repeats a
lesson check or quiz bank question):

- four self-report items: trading experience (`none`, `some`, `regular`),
  ever held a brokerage account (yes/no), how often the player follows markets
  (`never`, `monthly`, `weekly`, `daily`) and confidence about investing (1–5);
  each may be left as "Prefer not to say";
- a ten-item concept pre-quiz on chapters 1–4 in the quiz item format, with
  "Not sure" on every item.

**Who sees it.** Only a participant with active consent under the current
policy who has neither completed nor skipped it. Players without consent, and
everyone while research is disabled (the default), see nothing and the server
refuses submissions with 403. The client sends a due participant from the
Adventure page to `/onboarding` once; "Skip" is always available and is
recorded. Answers are never marked right or wrong, earn no XP and change
nothing in the game.

**Storage.** One `prior_knowledge_responses` row per player (migration 13):
instrument and consent versions, status (`completed` or `skipped`), the
self-report answers, each concept answer with whether it matched the key, the
score, the group, the client-measured `elapsed_seconds` and `recorded_at`.

**Grouping rule** (unvalidated cut-offs): concept score 0–4 is `novice`, 5–7
`intermediate`, 8–10 `experienced`; "Not sure" counts as not correct; a skip
is `unknown`. The group uses the score alone so that it rests on one
observable measure; the self-report items are stored as covariates.

**Which field is authoritative.** For analysis, `prior_knowledge_responses`
(its group) is authoritative. `research_participants.prior_knowledge` stays
the latest self-reported experience: the metadata command or the instrument's
experience item writes it (`none`, `some`, `regular` → `experienced`), and
`first_prior_knowledge` keeps the first report.

## Researcher dashboard

`/research` in the client (linked only when `GET /api/research/access`
returns `allowed`) and `/api/research/*` on the server.

**Who.** Accounts whose Firebase uid is in `RESEARCHER_FIREBASE_UIDS`; outside
production also profile ids in `RESEARCHER_PROFILE_IDS` (for local testing;
production ignores it). Everyone else gets 403; while enrollment is off,
researchers get 409.

**Data scope.**

- Only participants with active consent under the current policy version and
  text. Withdrawal removes a participant from every view and export at once.
- Only records made from the time of that consent: matches created from
  `consented_at`, events of those matches, first check answers timed from then
  (answers recorded before migration 13 have no time and stay out) and quiz
  attempts started from then. Prior-knowledge responses are only ever
  collected under consent.
- Attempt numbers count the participant's whole history for the same level,
  boss kind, daily day, practice market or multiplayer mode, so a first
  attempt made before consent leaves only retries in scope.
- Participant, match and quiz attempt ids are HMAC-SHA-256 pseudonyms keyed by
  `RESEARCH_PSEUDONYM_SECRET` (`p_`, `m_`, `q_` plus 20 hex characters):
  stable while the secret is unchanged, not reversible or linkable without it.
  Keep the secret out of exports and rotate it only between studies.
- No display names, emails, Firebase uids, profile ids, lobby ids, daily seeds
  or reflection text (events only say whether a reflection was written).

**Aggregates.** Every learning metric is labelled `unvalidated`.

| Endpoint          | Content                                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `summary`         | Participants, onboarding counts, groups, finished matches by mode, per-chapter funnel (Preview played, each level's check, Chapter Boss attempted, won)                                       |
| `pre-post`        | Per chapter and cohort (all and each group): Preview Battle and Chapter Boss for first attempts and all attempts, and the paired change for participants with both first attempts unforfeited |
| `decision-trends` | Mean decision score by attempt (5 and later pooled) per match kind                                                                                                                            |
| `checks`          | First-try check accuracy per level                                                                                                                                                            |
| `quizzes`         | Chapter quiz score and pass rate for first and all attempts; accuracy of first answers to each chapter's bank questions in any quiz                                                           |

Each summary reports finished matches, participants and forfeits; profit,
decision score, the share of each decision component's points, mission
completion and win rate exclude forfeits.

**CSV exports** (`GET /api/research/exports/{kind}`, streamed, one header row):

| Kind              | One row per                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `participants`    | Participant: consent version and time, onboarding status, group, self-reported prior knowledge                                                                                                                      |
| `matches`         | Started match: mode, kind, chapter, level, scenario and version, attempt number, `first_attempt`, `gem_refresh_retry`, daily attempt, result, decision score and components, missions, plan, stats, `metric_status` |
| `game-events`     | Event of an in-scope match: sequence, tick, kind, time and the payload with its observed context (seed, lobby id and reflection text removed)                                                                       |
| `check-answers`   | First answer to a lesson check question                                                                                                                                                                             |
| `quiz-answers`    | Quiz item: attempt, topic, classroom flag, attempt number, option order, answer, correctness and confidence                                                                                                         |
| `prior-knowledge` | Completed or skipped instrument with answers, score and group                                                                                                                                                       |

Gem-refresh retries are dailies started after paying Gems to skip a loss
cooldown (`gem_refresh_retry`). Text cells that begin with a formula character
are prefixed with `'`.

## Evaluation plan

A proposed study. Before recruitment: obtain ethics review and informed
consent, define eligibility and withdrawal, and preregister outcomes, sample
size (from a justified power or precision analysis) and analysis. Use
simulated money and fictional companies only.

| Outcome                     | Proposed evidence                                                  | Current support and gap                                                                                                        |
| --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Financial understanding     | Parallel pre/post questions with reviewed answer keys              | Check first-try accuracy, quiz first answers and the onboarding pre-quiz; none is validated or reviewed; no parallel post-quiz |
| Applied decisions           | Pre/post performance in comparable unfamiliar markets              | Preview vs Chapter Boss: same scenario, two seeds, so not an unfamiliar transfer task; difficulty uncalibrated                 |
| Retention                   | Delayed unseen checks at a fixed follow-up                         | The daily review repeats bank items weighted toward misses; no scheduled delayed test                                          |
| Risk behaviour              | Stop-loss use, position size and drawdown in unfamiliar markets    | Results record stop discipline, largest position, worst drawdown and fees; descriptive only                                    |
| Plan adherence              | Frozen prior plan vs actual decisions                              | The loss limit is compared with worst drawdown; strategy adherence is not scored                                               |
| Probability accuracy        | Confidence, first-attempt correctness and calibration              | Optional `sure`/`think`/`guess` on quiz answers; no calibration statistic                                                      |
| Reflection                  | Independent ratings of evidence, uncertainty and justified changes | Optional post-match reflection, stored, not graded                                                                             |
| Usability                   | Task success, errors, time to first useful action, interviews      | No participant testing yet; see [performance](../operations/performance.md#first-time-tasks)                                   |
| Engagement without pressure | Return rate and a survey of pressure or loss-chasing intent        | Activity days and match counts are recorded; more play is not automatically good                                               |

Design rules: use alternate forms and counterbalancing; randomise assignment
when comparing with another experience and keep exposure comparable; separate
first attempts from retries (the event log records attempt numbers and
Gem-enabled daily retries); report attrition, missing confidence, uncertainty
and null results. The decision score is an unvalidated heuristic, not an
outcome measure. Have independent reviewers check content accuracy and rubric
agreement first, and set a stopping process for misleading content, distress
or increased pressure to speculate. Do not infer real-market competence from a
simulated gain.
