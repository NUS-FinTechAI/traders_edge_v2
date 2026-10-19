# Playable learning verification

Baseline: `9a95378`. The `feat/playable-lesson-simulation` changes let the browser finish the required `m05-l01` simulation and launch a chapter learning check. Assessment and delayed-review starts use their existing server routes and preserve interrupted start keys.

## Browser evidence

Captured on 19 October 2026 with the existing cached Playwright CLI, Chrome 155.0.8059.80, against the local development API and a separate temporary SQLite database. A fresh guest was created through the UI; scripted canonical answers prepared prerequisite progress through real HTTP routes. This is test setup, not participant learning evidence.

- [Before, 390px](before-390.png): the required simulation had no trading or completion controls.
- [After, 390px](after-390.png): saved quotes, holdings, orders, planned execution, bounded advancement and the observation audit.
- [Completed, 390px](success-390.png): the actual server response updates the lesson result and normal star.

The walkthrough verified a cancelled unfilled order, a five-unit fill with fees, full reload, wrong-audit corrections, stale-observation rejection, order and no-order completion, and recovery after deliberately losing a response after server commit. Repeat completion awarded no additional XP. The audit uses the latest server observation token; changing orders at the same tick also invalidates older answers.

Checks at 360, 390, 430 and 768px found no document overflow or visible enabled targets below 44px. Keyboard focus was visible; a 200% text-size stress check at 390px retained the layout. Sampled rendered text contrast was at least 5.72:1. Native browser zoom, complete chart contrast and screen-reader conformance were not certified. The full ignored evidence manifest remains in `output/playwright/lesson-simulation/qa-manifest.json` in the implementing checkout.

Independent code and screenshot review found no blocking simulation defect. The existing visual system was retained. This evidence does not approve authored financial content, validate learning outcomes, establish hosted deployment or cover other game screens.
