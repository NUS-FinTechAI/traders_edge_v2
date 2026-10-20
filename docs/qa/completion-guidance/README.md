# Learning completion guidance

20 October 2026. Baseline: `67e8284` (merged PR #77). Scope: completion
guidance and numbered whole-check feedback, preserving the existing visual
design and server-owned progression.

## Acceptance and observed behavior

A completed introductory assessment or required mission should offer the next
saved activity without requiring the player to find another map stop. The result
now reads the existing authenticated workflow through `NextJourney`; it uses the
run owner's identity and does not create another activity automatically. Multiple
feedback items have question numbers in their saved form order. This change does
not add question prompts or submitted-answer text to the backend response.

The isolated browser session used a fresh guest created through the normal UI on
`http://127.0.0.1:5173`, backed by the disposable local development database.
No mastery, wallet or answer records were seeded. Choosing “Not sure yet” for all
three introductory items completed the diagnostic with 0% and no XP, unlocked the
first lesson and showed its direct “Start required missions” link. Reload retained
the saved result, all three numbered explanations and the same next mission.

The matched 390 × 844 captures show the same completed run. The before capture
temporarily served the two unchanged baseline result/feedback components; the
after capture restored this change. Both used the real saved API response.

- [Before](before-390.png): result followed directly by unnumbered explanations.
- [After](after-390.png): next required lesson and an explicit start link.
- [Feedback](feedback-390.png): numbered explanations after completion.

## Verification

The existing cached Playwright CLI drove session `finish-journey`; artifacts were
first saved in `output/playwright/completion-guidance/`. No horizontal page
overflow was observed at 360, 390, 430 or 768px, or with a 200% root-font text-size
stress at 390px. From the focused activity heading, Tab reached the next-mission
link with a visible solid outline. Its measured target was 198.84 × 46.78px.
Reduced-motion rendering retained the same actionable result. The only browser
error was the expected unauthenticated profile 401 before creating the guest.

Client tests: 233 passed, none skipped. Type checking, lint/formatting and the
production build passed. This small UI change reuses the tested workflow read;
it does not change grading, migrations or reward policies. Independent review
and hosted checks are required before merge. These observations do not establish
screen-reader conformance, learner comprehension or learning outcomes.
