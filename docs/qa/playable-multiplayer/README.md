# Playable multiplayer browser evidence

This records local browser checks on `feat/playable-multiplayer`, based on `0b93f684e27015f301a2b82653968d1ae41cb8cb`, on 19–20 October 2026. The checked client included the multiplayer response schemas and browser flow in this change. The local API used the existing multiplayer wire contract; this slice adds response declarations without changing saved receipts or game policy. This is local integration evidence, not deployment or participant evaluation.

## Goal and acceptance criteria

Two eligible guests can create/join a private lobby or pair publicly, inspect only their own trading record, submit a prior written plan, cancel an open remainder and confirm one shared observation at a time. Reloads preserve uncertain actions with their exact key and observed tick. Stale decisions cannot silently confirm a later observation. Both players can reach frozen final standings and save their reflections; private play has no game rewards or rating, and public settlement remains once-only. Abandonment requires confirmation. The hub refreshes current chapter access, and optional rating/list failures do not block eligible mode entry.

## Setup and harness

- Client: `http://localhost:5176`; API: `http://localhost:8000`, using the same hostname for authenticated cookies.
- Browser: Chromium `155.0.8059.80`, two isolated browser contexts, 390 × 844 CSS pixels for the main flow. Additional final-result checks used widths 360, 430 and 768.
- Fixtures: fresh disposable guest sessions. Canonical learning answers prepared the required chapters through the API: chapters 1–4 for private play and 1–9 for public play. The bound simulation audit used its current observation token. These prepared profiles are test fixtures, not evidence of learner performance. No private participant data or guest session files are retained here.
- Existing installed Playwright CLI, invoked from the repository root:

```sh
node /Users/maahirgarg/.npm/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js -s=mp-one snapshot
node /Users/maahirgarg/.npm/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js -s=mp-one run-code --filename=/private/tmp/multiplayer-public-qa.js
```

Temporary interaction scripts and full local captures are under `/private/tmp` and the ignored `output/playwright/multiplayer/` directory. The compact local `qa-manifest.json` records the observed result objects. Scripts and logs containing fixture answers or session state are not committed. This does not add a permanent development-only test suite.

## Observed behavior

Private play rejected empty written-plan submission in the browser, accepted a fully planned limit order, cancelled its open remainder, and executed a later planned market order with recorded fills and fees. Readiness survived reload and paused decisions until the peer confirmed. Both contexts advanced through observation 29 and saved reflections; game XP was unchanged. The peer's rendered page did not contain the other player's plan.

Public play paired the same two eligible guests. A deliberately dropped readiness response after server commit retained the exact pending action through reload; explicit confirmation recovered it without readying the next observation. A stale observation returned 409 and required a new decision. Both players finished and reflected. The observed losing player received exactly 10 game XP, 5 premium currency and one additional rated match. Reloading and reflecting left the frozen result unchanged.

Separate abandonment checks dismissed a confirmation, then forfeited explicitly. The forfeited player had no order/readiness controls. Both forfeiting cancelled the match without a rated result. A forced leaderboard 503 left eligible mode entry available; manual refresh recovered the optional read.

After the accessibility corrections, another real private match verified focus on the final result, focus on the saved reflection and focus again after direct reload. ArrowRight scrolled the labelled final leaderboard region. Checks of the completed public screen found no document overflow or enabled targets below 44 × 44 at the four tested widths. Sampled text contrast was at least 5.72:1. Keyboard navigation showed a visible 3px focus outline. Reduced-motion emulation and 200% root text-size stress preserved the 390px document width; this was text-size stress, not native browser zoom.

No unexpected page exceptions occurred in the completed private/public and final-focus flows. Deliberately aborted, stale and unavailable requests produced expected network-console errors; an existing React development warning was also present. Screen-reader behavior, real Firebase login, hosted deployment, network performance and beginner usability were not evaluated.

## Selected captures

There was no multiplayer browser route at the baseline, so there is no historical multiplayer screen to label as a before image. The first two images show the same new private-match flow before and after the market starts at 390px. The result capture includes the reviewed keyboard-scroll affordance. All images show live local API states with disposable fixtures.

| Capture                                               | State                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Private lobby before start](private-waiting-390.png) | One host; start disabled until a second player joins                                 |
| [Private match after start](private-active-390.png)   | Observation 1, a fill, paid fee, holdings and readiness                              |
| [Public action recovery](public-pending-390.png)      | Committed readiness response was lost; exact saved-action confirmation               |
| [Public final result](public-result-390.png)          | Frozen net-profit standings, horizontally scrollable Elo and settled personal reward |

## Checks and limits

- `npm test`: 176 passed, including 23 multiplayer service/controller tests. Regressions cover exact recovery, stale readiness, profile refresh/owner mismatch and two same-owner tabs contending over a lost-response command.
- `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`: passed. Build retained the existing `configService` mixed static/dynamic-import warning.
- Backend focused command below: 35 discovered, 20 passed, 15 existing PostgreSQL tests skipped because this worker had no live PostgreSQL test URL. This worker did not claim the live PostgreSQL suite passed.

```sh
PYTHONPATH="$PWD/server:$PWD/server/tests" /Users/maahirgarg/Downloads/traders_edge_v2/server/.venv/bin/python -m unittest test_multiplayer test_api_contract
```

The checked interpreter loaded this worktree explicitly without changing the shared environment. API generation used `app.export_openapi` from that interpreter and the existing `buildArtifacts`/`writeArtifacts` pipeline: 89 operations, no stale artifacts. Integration must regenerate the combined API contract after other branches merge. The shared trading workspace was copied unchanged from the separately reviewed challenge-client slice; final integration must preserve that common source and add the intended navigation. This branch's local `/multiplayer` routes are functional, but home/adventure entry links remain the integration owner's work. Hosted CI and final integration checks remain required before merge.

## Integration checkpoint

Merge `3851a76` integrates master `56b57b0`, including the reviewed Player and AI challenge pages. The route conflict retained Player, all challenge routes, both multiplayer routes and the existing learning routes. The shared trading workspace is identical to master. Regenerating the combined API produced no changes or stale artifacts.

At this checkpoint, all 204 client tests, type checks, lint and production build passed. Full backend discovery ran 334 tests: 283 passed and 51 live PostgreSQL tests skipped because this worker had no live test URL. The separate 22 catalog tests and catalog validator passed. The combined build additionally reports a chunk above 500 kB; it retains the earlier mixed-import warning. Hosted CI, live PostgreSQL verification and the remaining home/adventure multiplayer entry links are still integration checks.
