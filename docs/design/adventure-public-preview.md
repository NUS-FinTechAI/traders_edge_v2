# Public Adventure previews

The owner authorized public chapter and level browsing while keeping play authenticated. This change extends the Adventure browsing increment on `feat/adventure-2`; creating a separate branch was not approved.

Acceptance criteria:

- Signed-out users can browse the horizontal chapter cards and chapter maps, including level objectives and mission counts.
- Public previews show no fabricated completion or earned-star state.
- Sign-in links preserve the selected chapter and stop. Unsupported return destinations fall back to home.
- Anonymous requests cannot start levels or bosses, submit answers or read personal progress. Signing in does not bypass progression prerequisites.
- Public content respects production publication approval and does not create accounts or expose private tasks or answer keys.

`GET /api/adventure/catalog` projects an explicit response schema from the existing catalog. No database migration or new content store is needed. The existing authenticated reads remain unchanged. Development guest sessions continue to count as authenticated profiles; production retains its Firebase requirement.

The public page and briefing have their own components and stylesheets. Chapter cards, route nodes and native dialogs are reused. Gameplay remains a later frontend increment and is identified as unavailable in the briefings.

Verification: 9 new backend tests and 92 frontend tests pass, as do typecheck, build and Oxlint. The broader existing backend regression run was not approved. The in-app browser connection failed; the existing headless Chromium harness checked mocked catalog/progress responses, responsive layouts, selected-level reload, sign-in return, retained chapter locks, retry and empty/missing content. The ignored `output/playwright/public-adventure/` directory contains captures at 390px and the harness. Browser checks are fixture evidence, not live Firebase or backend browser integration. Independent design/accessibility review and hosted CI remain pending.
