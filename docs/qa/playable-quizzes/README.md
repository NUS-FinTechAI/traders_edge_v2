# Playable quiz verification

Baseline: `0b93f68`; implementation branch: `feat/playable-quiz-mode`. The new
authenticated screens connect `/quizzes`, `/quizzes/attempts/{id}` and
`/quizzes/rooms/{id}` to the existing standalone and private classroom contracts.
The baseline had no quiz screens, so no before screenshot of this flow exists.

## Browser evidence

Captured on 20 October 2026 with Chrome 155.0.8059.80 using the existing cached
Playwright CLI. The frontend ran at `http://localhost:5177` and the isolated
development API at `http://localhost:8011`, with a disposable SQLite database.
Two fresh guests were created through the UI in separate browser sessions. One
guest was authorized as an instructor only through the temporary server
configuration. Canonical answers drove test attempts through real HTTP routes;
these are test fixtures, not participant assessment evidence.

- [Unconfirmed standalone answer, 390px](pending-answer-390.png): losing the
  response after server commit keeps the original answer and key. Reload and
  confirmation resumed the saved question without a second advance.
- [Completed standalone feedback, 390px](standalone-feedback-390.png): a frozen
  incorrect critical answer fails the form despite a 91% score and awards zero
  XP. A separate all-correct attempt awarded 20 player XP; another pass awarded
  zero.
- [Active classroom report, 390px](classroom-active-report-390.png): the host sees
  an attempt's status while first answers and feedback remain withheld.
- [Completed private attempt, 390px](classroom-passed-student-390.png): whole-form
  feedback appears after the second answer, with zero private XP.
- [Closed partial attempt, 390px](classroom-closed-partial-390.png): one saved
  answer remains recorded, further choices are disabled and the API rejects a
  fresh answer with 409.
- [200% text stress, 390px](text-200-top-390.png): enlarged text and visible
  keyboard focus in a bounded viewport capture.

The walkthrough also verified native missing-answer validation, optional
confidence, question reload, invalid-code retry, waiting-room locks, host start,
student refresh, a host report containing completed first answers, and student
report rejection with 403. Closure preserved a completed attempt and a separate
partial attempt. No standalone or private quiz completed adventure progress.

Checks at 360, 390, 430 and 768px found no document overflow. Keyboard focus was
visible, controls retained 44px targets and a 200% root text-size stress check
retained a single-column layout. State and result text do not rely on color. The
quiz stylesheet introduces no animation. Native browser zoom and screen-reader
conformance were not certified. Console inspection found the existing router
hydration warning and expected request failures exercised by the walkthrough.

The screenshots precede the final owner-switch guards and small copy corrections;
the guards have no intended effect on an unchanged signed-in account. The first
two captures also precede the correction of native blue quiz links to the
existing high-contrast text color. A final recapture could not run because
automatic approval review reached an account usage limit. These captures are
retained as observed intermediate states; they do not verify the final owner
switch behavior visually. Focused automated tests cover switching before/during
reads and mutations, withholding another account's result, retaining the original
pending key after a rejected response and blocking retry as another account.

## Reproduction

Use the repository's normal frontend/API setup with development guest sessions,
a separate temporary database and `INSTRUCTOR_PROFILE_IDS` configured only on the
development server for the chosen guest. Use the same hostname for both origins.
The exact installed harness used for these captures was:

```sh
PWTEST_DAEMON_SESSION_DIR=/private/tmp/traders-edge-quiz-pw \
  /Users/maahirgarg/.npm/_npx/31e32ef8478fbf80/node_modules/.bin/playwright-cli \
  -s=quiz-qa open http://localhost:5177/quizzes
```

A second session named `quiz-student` supplied the separate student identity.
Snapshots preceded interactions; captures used a 390px viewport. No instructor
permission was supplied by browser storage or an API request.

This evidence covers the quiz slice on the named baseline. It does not establish
independent financial or pedagogical approval, participant learning outcomes,
hosted deployment, actual Firebase sign-in, native zoom or full accessibility
conformance. Independent review and current-master integration remain separate
merge requirements.
