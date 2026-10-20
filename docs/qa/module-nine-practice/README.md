# Four-path practice: client verification

Verified on 20 October 2026 using the existing Playwright CLI harness, Chromium 155.0.8059.85
and a disposable local SQLite database. The frontend source baseline is
`18c1c41534cb40600615f85d55efd9d67524a376`, with backend
`37bdb15545c20ecd93bd018f4e048b4d6e7789d1` and completion guidance
`28e476b6fff358ca5e80f6324ddeebc160de303e` integrated. The paired backend and
client must be released together: the new `m09-l03` simulation step requires the
four-path dispatcher. Historical pinned runs retain their prior tasks.

## Setup and scope

The new client/API ran at `http://localhost:5177` / `http://localhost:8011`.
A separate archive of merged baseline `67e8284748eaf5265231d7a8eaa7fe68efc1dcf4`
ran at ports 5178/8012 for the genuine before capture, using its own older
catalog and database. Both completed the same named `m09-l03` lesson at 390×844;
the old version completed after three decision steps, whereas the new version
requires a fourth step with four actual saved market paths.

The disposable profiles explicitly seeded mastery records for chapters 1–8 and
completion records for the first two Module 9 levels, anchored to a real local
diagnostic attempt. Diagnostics and the earlier decision exercises used their
actual API commands. These prerequisites are test fixtures, not evidence that a
learner mastered the curriculum. No study enrollment, real account, learning
outcome or hosted deployment was tested. Browser authentication state and command
keys remain outside the repository.

Harness entry point:

```sh
/Users/maahirgarg/.npm/_npx/31e32ef8478fbf80/node_modules/.bin/playwright-cli -s=module-nine-final open http://localhost:5177
```

The existing `resize`, `state-load`, `goto`, `snapshot`, `screenshot` and
`run-code --filename` commands drove visible controls. Temporary scenario scripts
were not added to the permanent test suite. Order and audit interactions used
current public observations; private seeds and future prices were never supplied
to the browser. Audit input fields were checked empty before being filled.

## Observed behavior

- Opening or reloading performs reads; starting each path requires its own
  explicit button. The next path does not silently start after an audit.
- The first complete run traversed volatile, rising, falling and sideways
  generator profiles, disclosed only after their audits passed. Two planned
  market units filled on a later observation, with 0.33 total fees. Another
  planned limit order was cancelled and another expired unfilled; the audit
  reconciled every recorded order and the actual two-unit holding.
- Empty order validation prevented an incomplete order. An intentionally lost
  committed advance response retained the original command. Reload, local
  Continue and Confirm saved action replayed its original key and step count;
  the market remained at observation 1 rather than advancing twice.
- At the final observation the fact fields started blank. An incorrect cash
  value produced specific feedback, kept the path open and permitted correction.
  The other three paths completed with no orders and the supplied no-thesis
  reason. A trade count, profit or filled order was never required for a star.
- All four audits were required for the normal star and 20 once-only lesson XP.
  A second full four-path run used the current owner verification and completed
  with zero additional XP. Both full runs intentionally dropped the fourth
  audit response after server commit: full reload displayed the completed result
  and an accessible pending-action panel; confirming replayed the identical
  original audit body and cleared its journal without another reward.
- A second browser-context action completed the current path while the original
  final audit remained open. Submitting that old form received a real server
  409; Reload saved paths displayed the new unstarted path. An uncommitted bind
  was then deliberately aborted before reaching the API. After a real new guest
  signed in through a separate tab, Confirm saved action preserved the original
  journal byte for byte and sent zero mutations as the new player.
- An independently injected profile-check 503 hid the owned activity and showed
  the separate unavailable-account state. Removing the fault and using its normal
  reload link restored the same fresh guest diagnostic question.
- A real separate-tab sign-out and new guest sign-in hid the whole prior owned
  activity, including its result, and offered a normal anchor to the current
  player's chapters. Fresh guest introductory assessment and full reload still
  showed the current owned question without an owner-guard loop.

The initial advance-reload probe checked for Continue before the reloaded page
had finished rendering; its timeout was corrected by waiting for the restored
exercise feedback, then confirming the saved action. Early final-receipt images
showed only the top of the result and were retaken with the pending panel in view.
An intended same-tick cancellation probe did not run because the final advance
had already expired the order. Same-tick token changes are covered by the service
and backend regressions; they are not claimed as that browser probe's result.

## Accessibility and review

Independent read-only UI checks found no document overflow at 360, 390, 430 or
768px, including 200% root text enlargement at 390px. Visible enabled lesson
controls met 44×44px. The quote table accepted keyboard focus and ArrowRight
scrolled it from 0 to 40px with a visible 3px outline. Reduced-motion rendering
remained stable; observed contrast ratios were 14.78 for body text, 5.73 for a
button and 13.77 for an input. These are scoped browser observations, not a
screen-reader evaluation or participant usability study.

The initial ownership review found a stale result above a correctly hidden path
panel. The final page-level owner gate removed the entire owned activity when
the verified player changed. A temporary profile-check failure instead uses a
separate unavailable state and reload link; it does not claim an account switch. Actual profile checks now precede mutations and
reads, follow reads, and precede release of a definitely rejected command;
ambiguous responses retain their original recovery record. Source, safety and
accessibility review found no other blocking finding in this finite slice.
In-progress editing briefly produced a Vite hot-reload error, resolved before
final retakes. Expected missing-session requests, deliberately aborted replies
and deliberate stale/rejected requests are not unexpected application errors.

## Captures

| File                             | Observed state                                                             |
| -------------------------------- | -------------------------------------------------------------------------- |
| `before-390.png`                 | Real old catalog/UI: three decision steps complete the lesson              |
| `after-390.png`                  | Current repeat: four required steps complete, zero duplicate XP            |
| `audit-empty-390.png`            | Final observed record with blank learner fact fields                       |
| `wrong-audit-390.png`            | Specific correction feedback while the same path stays open                |
| `advance-unconfirmed-390.png`    | Original committed advance awaiting confirmation                           |
| `fourth-receipt-focused-390.png` | Completed run still exposes the lost fourth-audit recovery                 |
| `reviewed-paths-390.png`         | Four closed path records and disclosed generator profiles                  |
| `stale-progress-390.png`         | Real 409 after another context completed the former current path           |
| `pending-owner-guard-390.png`    | Old pending bind retained after a real guest switch; no new-owner mutation |
| `text-200-390.png`               | Independent 200% text-size stress, not native zoom                         |
| `owner-recovery-390.png`         | Whole prior owned activity hidden after a real account switch              |
| `profile-unavailable-390.png`    | Temporary profile 503, distinct from an account switch                     |
| `fresh-diagnostic-390.png`       | New guest's owned introductory assessment after reload                     |

## Checks and limits

At the final source baseline: all 261 client tests passed, including 28 scenario
service cases; type checking, lint/format checks, production build, generated API
check (92 operations) and diff checks passed. The API coverage report still lists
26 success responses without schemas; this slice does not claim to remove that
existing coverage gap. Backend regression and live PostgreSQL results belong to
the separately reviewed backend PR; this UI slice adds no migration or backend
policy.

These exercises verify recorded facts, specified fictional constraints and exact
command recovery. Written text presence is not a reviewed reasoning rubric,
synthetic profit is not learning evidence, and passing tests does not establish
financial publication approval, effective pedagogy or full product parity.
