# Adventure browsing — increment 2

Implemented on `feat/adventure-2`, based on `34964435c2f66533c93822bac97d35689abb7b14`. The owner requested implementation with the sample UI's Adventure entry card, horizontal chapter cards and a map of levels within each chapter. This records the browsing slice, not completion of the learning or boss-fight workflow.

## Screens and behavior

- Home adds an Adventure Mode card linking to `/adventure`.
- `/adventure` shows server-provided chapter progress, separate normal/special star totals, horizontal scrolling and keyboard-accessible chapter links. Locked chapters remain inspectable.
- `/adventure/chapters/:moduleId` shows the diagnostic, connected numbered levels and chapter boss. Available or earned bonuses branch from their level. The separate learning check does not imply a prerequisite for the boss. Earlier-check links and the entry-boss briefing explain chapter locks.
- Selecting a stop opens a native dialog. Level briefings load the existing level endpoint and show objectives, required/bonus criteria and lock reasons. Escape and the close controls return focus to the opener. The `stop` query parameter supports direct briefing links.
- Authentication, HTTP failures, empty chapters and loading states are explicit. Requests are cancelled on unmount; profile and chapter identity key the screens to prevent another profile's progress remaining visible. Expired-session recovery rechecks shared authentication.

The implementation preserves the existing header and forest-green/cream palette. The sample supplies content and layout, not its navy, glow or hexagon styling. A wrapping chapter grid was rejected in favor of the requested horizontal row. Level nodes use a winding route rather than a stack of lesson cards. At enlarged text sizes the route reflows into full-width stops. Icons are local SVG; no image, font or UI dependency was added.

These screens only read existing API contracts. There are no new grading, unlock, reward or persistence rules. The briefings explicitly identify activities that are not playable here yet; no start/resume controls pretend to launch those activities. Mission play, structured checks, the bound simulation and boss play remain later increments.

## Local verification and limits

Frontend service tests cover chapter/map loading, missing chapters, encoded level IDs, cancellation, retry, prerequisites and boss resume status. Typecheck, build and Oxlint pass. Existing repository formatting problems outside the owned files remain unchanged.

The in-app browser could not initialize. An existing Playwright 1.33 installation and Chromium 113 were used for headless checks against an isolated Vite preview. Browser API responses were **fixtures** using canonical catalog text and synthetic progress; the isolated backend restart was not approved. This is frontend interaction evidence, not live API integration or learner-outcome evidence.

The local ignored directory `output/playwright/adventure-2/` contains the verification script, `qa.json` manifest and captures. The 390px home-before capture restores the baseline HomePage source through a temporary Vite transform. After captures cover home, chapters, new/locked/completed maps, locked/completed briefings, loading, empty, error and signed-out states. Map overflow checks cover 360, 390, 430, 768 and 1280px. A 390px check doubles the root text size; it is not native browser zoom. Interaction checks cover horizontal scroll, chapter navigation, dialog Escape/focus return, focus containment, bonus branches, fixture progress after reload, retry and expired-session recovery. Chapter-page links and buttons meet the checked 44px target minimum. Reduced-motion mode was enabled; the new interface uses no animation. No uncaught page errors or external requests were observed.

Live API browser verification, independent design/accessibility and safety review, and hosted CI remain outstanding. Screenshots and this author's checks do not establish screen-reader conformance, beginner comprehension or production readiness.
