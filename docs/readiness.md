# Live-app readiness

Assessment date: 20 October 2026. Scope: the connected app and its final
four-path practice integration at source checkpoint `39c3934` (backend PR #78,
client PR #80 and completion guidance PR #79). The canonical curriculum is edition
`2026-10-20.1`; earlier saved runs retain their pinned tasks and receipts.
This is a current implementation assessment; the preserved
[v1 audits](v1-audit/summary.md) retain their historical commit boundaries.

The backend and browser now support a substantial playable game loop. Full v1
mechanics parity and the complete intended curriculum experience remain
unfinished. Passing tests does not establish independent content approval,
learning efficacy or a particular presentation grade.

## What can be demonstrated

| Flow                 | Implemented behavior                                                                                                                                                                                                                                                                                   | Evidence and limits                                                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learning journey     | Introductory assessment, sequential required tasks, optional bonuses, stars, chapter checks, delayed reviews and resumable saved answers. Home/map and completion results recommend a saved learning activity or the next chapter boss.                                                                | [Playable learning](qa/playable-learning/) and [completion guidance](qa/completion-guidance/). Thirty levels have 98 required steps: 33 instruction, 36 choice, 27 classification and two bound simulation steps.                                                                |
| Lesson trading       | `m05-l01` binds a saved limit-order session; `m09-l03` executes four sequential synthetic paths covering rising, falling, sideways and volatile generators. Learners plan orders, observe actual fills/costs, reconcile records and compare a gross benchmark. A supported no-order decision can pass. | [Single-case walkthrough](qa/playable-learning/), [four-path walkthrough](qa/module-nine-practice/) and [server contract](../server/README.md). Two lessons bind the engine. Module 9 checks observed facts and fictional constraints; it does not grade free-text plan quality. |
| AI and chapter games | Daily/practice challenges and chapter entry/exit bosses share a synthetic market with opponents. Ten chapter profiles vary allocation, decisions and checkpoints. Net portfolio profit determines the game result.                                                                                     | [Challenge walkthrough](qa/playable-challenges/). Boss access and game rewards do not establish module mastery or validated concept application.                                                                                                                                 |
| Player record        | Separate learning/game XP, player levels, login rewards, finite currency shop, eligible claims, equipment and due reviews. Costs require confirmation; uncertain actions recover their original key and choice.                                                                                        | [Player walkthrough](qa/player-record/). Purchase/refresh QA used an explicitly labelled disposable balance fixture; it does not prove that balance was earned through play.                                                                                                     |
| Human competition    | Private code lobbies, public paired matches, shared observation barriers, planned orders, reload/recovery, frozen results, public Elo and versioned game rewards.                                                                                                                                      | [Two-browser walkthrough](qa/playable-multiplayer/). Private requires foundation checks; public requires all nine core checks. Private games grant no public rewards/rating.                                                                                                     |
| Quizzes/classrooms   | Standalone forms, saved first answers, whole-form feedback, once-only passing XP, server-authorized instructor rooms and private class reports. Active student answers stay withheld.                                                                                                                  | [Quiz walkthrough](qa/playable-quizzes/). Private rooms grant no XP; quiz success does not complete adventure levels.                                                                                                                                                            |
| Persistence          | Owned/version-pinned learning and simulation state, exact command replay, ordered migrations and transactional shared-match/reward settlement.                                                                                                                                                         | Backend tests and the guarded live PostgreSQL suite cover persistence/concurrency and populated upgrades. This is distinct from real Firebase sign-in and hosted deployment.                                                                                                     |

At this source baseline, local checks passed 261 client tests and 23 catalog
tests, type checking, lint/formatting, the production build and the generated API
check. The reviewed backend passed 382 tests including 71 live PostgreSQL cases.
The linked walkthroughs disclose their fixtures and separate browser observations
from automated contract checks; they do not represent a participant study.

## V1 comparison and next work

V2 improves on audited v1 behavior in durable resume, deterministic private future
state, ownership, realistic friction, mastery rules, rewards and shared human
matches. V1's endless card, archive/global-rank concept and unimplemented
achievement awarding are not evidence of working features that v2 lost.

The material remaining gameplay work is:

1. Extend Module 9 beyond the four-path record reconciliation with independently
   reviewed reasoning rubrics, unfamiliar exit scenarios and delayed applications.
   The four executed paths complement the supplied-record cards; their generator
   labels are revealed only after each path closes. They are synthetic education,
   not historical market evidence or a validated assessment of suitability.
2. Add further lesson-specific simulation bindings, observed news/evidence
   interactions and progressive instructional tools. Preserve prior plans,
   private future state, cost/exposure reconciliation and legitimate abstention.
3. Review chapter balance across varied seeds and policies, and replace familiar
   review items with independently reviewed unfamiliar applications. Current
   structured checks verify supplied facts; they do not grade free-text reasoning
   quality or validate learning outcomes.
4. Specify optional advanced execution separately. V1's shorting, stop-limit,
   indicator and macro interactions are not implemented by the current long-only
   engine. Core completion does not require speculative products.

The game design document remains authoritative: competitions rank profit, while
learning evidence remains separate. An individual order, trade count or trading
volume earns no XP. A sound losing decision or supported decision to wait must
remain compatible with learning success.

## Live demonstration preparation

Run the normal two-terminal setup in the [root README](../README.md). Use a fresh
guest to show the first-time learning path and a separate, previously practised
demo account for gated modes. Complete the required checks through the app;
synthetic QA balances or altered due dates must be disclosed if shown.

Use two separate browser contexts/accounts for a human match. Public matching
needs two eligible players; the interface must show its waiting state when only
one has queued. Instructor controls require the server allowlist described in
[quizzes](quizzes.md), rather than a browser role switch. Preserve saved actions
and use explicit confirmation after a lost response.

Production builds default to same-origin API routes behind a reverse proxy; set
`VITE_BACKEND_URL` when hosting the API separately. Development uses the frontend
hostname on port 8000. Configure allowed origins and identity using
[deployment](deployment.md). These defaults do not deploy the app.

## Publication and evaluation boundary

Production still refuses the unapproved catalog. Independent financial and
pedagogical content/rubric approval, verified hosted Firebase/HTTPS operation,
participant retention/deletion procedures and approved study operation remain
release dependencies. Existing owner-scoped exports and default-off consent
contracts do not establish researcher access or an approved evaluation. Do not
claim that game profit proves learning or that the app makes learners profitable.

A production-dependency audit on 20 October reported four high-severity entries
through Firebase's unused Firestore/Node gRPC dependency chain. This client imports
Firebase App/Auth, and no gRPC server or Firestore use was found in its source.
That inspection does not clear the dependency findings or establish a full
security assessment. Changing the transitive transport outside Firestore's
declared range needs a separate compatibility check; no forced dependency
downgrade or unverified override was applied here.
