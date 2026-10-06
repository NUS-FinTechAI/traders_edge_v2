# Supplementary quizzes and private classroom rooms

Quiz policy `quiz-1` implements the supplied brief's supplementary terminology
and concepts checks. It reuses the retained authored question bank; it does not
create unseen retention forms or claim that a passing quiz measures transferable
trading skill. Trading challenge outcomes and recorded decisions remain separate
from quiz scores.

Standalone forms contain a module's retained lesson and assessment questions.
Each form permits three attempts under the same pinned questions. Passing
requires at least 80% correct and every critical risk question correct. A first
pass awards 20 player XP once for that exact form and catalog edition; retries
cannot award it again. Quiz XP is recorded with a `game:quiz:` key and does not
create learning activity days, mastery, lesson completion or review credit.
These limits, score threshold and reward are explicit initial policy defaults
where the brief leaves the quiz economics and controls open.

Each attempt pins its private questions, source edition and policy version.
Attempt limits and once-only rewards apply separately to each catalog edition,
including an edition whose question text happens to match its predecessor.
Answers must be submitted sequentially, one per question. The first answer,
confidence and server UTC timestamp are retained without overwriting. Correctness,
answer keys, explanations and the whole-form score are withheld until the form
ends. Completing another attempt preserves the earlier attempt number and first
answers. These records are operational evidence, not a validated research dataset.

An instructor selects one to twenty distinct question identifiers from the
current authored bank, names a private room, and chooses an attempt limit from
one to three; the default is one. The server supplies an eight-character join
code and room capacity is thirty students. Students join while the room waits.
Only its instructor host can start or close it, and at least one student must
join before starting. Closing prevents new attempts and new answers while
retaining partial and completed evidence. Saved commands remain replayable.
Private classroom quizzes grant no XP, currency or global rating changes.

Instructor status comes from server configuration, never a client role claim.
Firebase mode requires the authenticated profile's verified Firebase UID to be
in `Settings.instructor_firebase_uids`. Guest development may instead configure
exact profile IDs in `Settings.instructor_profile_ids`; those IDs cannot grant
instructor authority in production. Empty allowlists authorize nobody. The host
is a teacher for the room rather than a student participant.
The environment settings are comma-separated `INSTRUCTOR_FIREBASE_UIDS` and
development-only `INSTRUCTOR_PROFILE_IDS`; neither is supplied by an API request.

The host can see only the students who joined that host's room and their attempt
statuses. Completed results include first answers, confidence, feedback and
score; active results disclose no answers or keys. Other instructors cannot
inspect another host's room. Students can inspect only their own attempts and
cannot inspect peer or host reports. Standalone results are not exposed to
instructors. Public question bank previews contain prompts and option text
without private answer keys or author metadata.

## API and durability

- `GET /api/quizzes/forms` lists finite standalone module forms.
- `POST /api/quizzes/attempts` starts either a standalone `module_id` or a joined
  `room_id`.
- `GET /api/quizzes/attempts` and `GET /api/quizzes/attempts/{id}` list and resume
  owned attempts.
- `POST /api/quizzes/attempts/{id}/answers` submits the current answer.
- `GET /api/quizzes/question-bank` provides instructor selection previews.
- `POST /api/quizzes/rooms` creates an instructor room.
- `POST /api/quizzes/rooms/join` joins by code.
- `GET /api/quizzes/rooms` and `GET /api/quizzes/rooms/{id}` list accessible rooms.
- `POST /api/quizzes/rooms/{id}/start` and `/close` are host controls.
- `GET /api/quizzes/rooms/{id}/results` is the host's private report.

Each mutation requires an idempotency key. Owned committed responses replay
exactly before fresh version, room-status, attempt-limit or permission checks.
Reusing a key for another command returns 409. Fresh responses validate the
pinned version and ownership. Existing authenticated profile locks serialize a
student's attempts and XP grants across workers; room locks serialize joins,
capacity checks and host controls. SQLite uses the existing immediate mutation
transaction. Final answer, XP, result and receipt commit together or all roll back.
List endpoints are limited to fifty recent owned or accessible records.

Migration 8 adds `quiz_rooms`, `quiz_members`, `quiz_attempts` and `quiz_commands`
without changing prior migrations or learner rows. Fresh content selection uses
the existing independent publication gate in production. Rooms and attempts also
pin the server-derived publication approval. Production cannot resume or answer
a saved draft attempt or join a saved draft room, even if the current catalog is
later approved. Approved snapshots retain their pinned approval after a catalog
change. Historical committed command receipts still replay exactly. Fresh room
joins and detail reads reject retired room versions. Content approval,
participant recruitment, consent, record export/deletion and a research rubric
remain separate work; instructor quiz access does not establish those policies.

## Verification

The quiz suite covers ownership, server-only instructor authorization, sequential
feedback, frozen first answers, edition-specific limits, publication pinning,
retired-room rejection, exact replay after restart, rollback of a final answer and
reward, and competing workers starting the third attempt. With
`TRADERS_EDGE_TEST_POSTGRES_URL` configured, the same suite also runs against live
PostgreSQL. It accepts only a loopback disposable database whose name begins with
`traders_edge_qa`, without preconfigured connection options; each test owns a
random schema and removes only that schema. This is API and persistence evidence,
not learner-outcome or deployment proof.
