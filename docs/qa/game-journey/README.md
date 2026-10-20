# Integrated game navigation verification

Review scope: the Home next-action projection and entry links, lazy routes,
loading/status and route-error recovery, quiz navigation and owner guards. The
existing visual system was retained. All browser activity used a separate
`quiz-final-qa` context; the user's primary browser sessions were untouched.

## Checkpoints and setup

Captured on 20 October 2026 using Chrome 155.0.8059.80 and the existing cached
Playwright CLI. The current frontend ran at `http://localhost:5173` against the
local development API at `http://localhost:8000`. Initial checks covered the
navigation changes later committed in `836582e` and the origin defaults in
`11de915`; the integrated source was reloaded at `fb9d3a7` after the multiplayer
route merge. The only reported console cleanup, invalid SVG attribute names in
the existing error icon, was corrected separately in `a3a250b`.

The matching Home comparison used the same authorized disposable guest fixture
with four passed chapter checks and thirteen completed levels. The older
frontend at port 5175 ran checkout
`629ccab27faf8b5cba58ad63d19cdb4ad4235e73`; it had no next-action panel or
multiplayer/quiz Home links. Its source checkpoint is recorded rather than
described as current master. A separate fresh guest exercised the introductory
assessment and quiz. Canonical answers drove synthetic test attempts through
real HTTP routes; none of these fixtures are participant learning evidence.

- [Home before, 390px](before-390.png): the earlier chapter/challenge entries.
- [Home after, 390px](after-390.png): the fixture's boss retry and all mode entries.
- [Quiz question, 390px](quiz-question-390.png): current question, saved progress,
  high-contrast navigation and Home backlink.
- [Unconfirmed quiz answer, 390px](quiz-pending-390.png): an answer response lost
  after server commit retains the exact saved action.
- [Completed quiz feedback, 390px](quiz-feedback-390.png): the wrong first
  critical answer remains frozen and the completed result grants zero XP.
- [Owner-change guard, 390px](quiz-owner-change-390.png): a real account switch in
  another test tab hides the previous quiz view.
- [Route recovery, 390px](route-error-390.png): a controlled profile-service 503
  exposes reload and Home recovery.
- [Initial loading, 390px](initial-loading-390.png): a controlled held profile
  response exposes the named initial loading state.

The Home-after and owner-guard captures precede the small recovery-link and
Home-player-link corrections described below. They are observed intermediate
states, not visual verification of those final corrections.

## Observed checks

Every Home entry reached its corresponding Adventure, challenge, multiplayer,
quiz or Player screen, and full reload retained the route. Protected quiz entry
preserved its return destination through guest sign-in. A fresh guest followed
Home's introductory-assessment link, submitted a wrong first answer, reloaded
with one of three steps saved and resumed that exact run from Home. Feedback
remained hidden. The progressed fixture followed its boss retry to the Chapter 1
exit briefing; reload retained the correct chapter and explicit start control.
No new boss attempt was started by this check.

Controlled profile delays verified the initial loading fallback and the
in-application loading status. A controlled 503 verified both route-recovery
controls; removing it and reloading reached sign-in. Final quiz checks verified
the Home backlink, missing-choice validation, frozen answers after reload,
lost-after-commit answer recovery with no duplicate advance and whole-form
feedback only after completion.

Home and quiz checks at 360, 390, 430 and 768px found no document overflow. Both
retained their layout under 200% root text-size stress at 390px. Quiz keyboard
focus was visible and enabled quiz links, buttons, confidence inputs and radio
labels met 44px targets. The new Home next-action and mode buttons measured at
least 46px high; their sampled white-on-green contrast was 5.73:1. The existing
plain Player-record Home link was reported separately. Native browser zoom,
screen-reader conformance and complete application contrast were not certified.

Read-only checks passed: typecheck, client lint and 41 focused tests covering
auth guards, backend-origin defaults, journey ownership, HTTP behavior and quiz
recovery. Full integration and CI results belong to the integration PR's exact
head rather than these screenshots.

## Findings and remaining verification

The cross-tab test found that the quiz owner guard's client-side sign-in link
returned to the same guard because the old tab retained its signed-in context.
The previous quiz data stayed hidden. The integration owner replaced this with
a normal anchor to force fresh authentication, and applied equivalent recovery
to the Player and multiplayer guards. Source inspection confirms these anchors;
their final real cross-tab retest remains unavailable. A separate visual finding
reported the plain blue Player-record Home link. The integration owner applied
the existing Home button class and an explicit 44px minimum width; source
inspection confirms the correction. Its final measurement and recapture remain
pending.

Automatic approval review could not execute the next browser action because it
reached an account usage limit. That action did not run, and no alternative path
was used to bypass approval. Browser state and the earlier successful evidence
were preserved. The account-recovery retest and final recapture must not be
reported as passes from this evidence.

Browser work paused during the root route-conflict resolution and resumed after
the stable-checkpoint signal. The quiz recovery/completion command already in
flight had completed successfully. Temporary locator mismatches were corrected
and the affected entry/reload checks reran; they were not product failures or
counted as successful checks. Expected console failures came from initial 401s,
the controlled 503 and deliberately lost quiz response. The earlier SVG console
warnings preceded their source correction.

The exact installed harness was
`/Users/maahirgarg/.npm/_npx/31e32ef8478fbf80/node_modules/.bin/playwright-cli`,
with `PWTEST_DAEMON_SESSION_DIR=/private/tmp/traders-edge-final-qa-pw` and session
`quiz-final-qa`. Additional development captures remain ignored under
`output/playwright/final-navigation/`. Private authentication state is excluded
from tracked evidence. This review does not approve authored financial content,
establish learning outcomes or certify hosted deployment.
