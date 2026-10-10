# Learning client

The React client connects to the learning API through a same-origin `/api/` path. Run the backend on `127.0.0.1:8000` and `npm run dev`; Vite proxies only `/api/` requests. Production hosting must forward that prefix to the API. The client has no routing or chart dependency.

## Connected journeys

The local guest entry creates an HTTP-only session cookie. Returning browsers read their own saved profile and curriculum. Clearing the cookie loses access to a guest profile; this is stated before entry and in preferences. Firebase sign-in and account recovery are not implemented by this client slice. No bearer credentials or answer keys are stored in browser storage.

The dashboard identifies the next eligible lesson or assessment using server progress. The ten-module path and connected per-module map show completion and prerequisites. Lessons include their objective, source links, explanation, worked example, written prediction and decision, question choices, optional confidence and reflection. Written inputs are recorded together with the submitted reflection; the interface does not claim their quality was automatically assessed. Incorrect answers receive server explanations. Optional calibration feedback describes only the submitted answers and warns against generalizing from a small sample.

The server grades checks, records XP once, schedules delayed reviews and authorizes unlocks. The client submits every question and preserves a request key for an unchanged retry. Reviews use the server's due state. The journal stores private notes; the archive searches sourced glossary definitions. Preferences save a pseudonym and optional analytics/leaderboard consent. The leaderboard ranks verified learning XP rather than financial returns.

The simulation view consumes the separate simulation API. It creates or resumes saved scenarios, displays observed prices and exact numeric history, and requires a written plan before each simulated order. Advancement, cancellation and debrief use idempotent commands. A planned loss boundary is explicitly not a guarantee or automatic stop. There are no profit rewards, timed observations or leverage controls. Shared multiplayer rooms and cosmetic equipment are outside this slice.

## Accessibility and behavior

Native links, radios, selects, disclosures and labelled text areas support keyboard input. Answer labels are full-row targets. Navigation moves focus to the main content; submitted feedback receives focus. Completion, locks and corrections use text as well as colour. Layouts accommodate narrow screens and enlarged text, and reduced motion is explicit. Loading and errors retain context with a real retry. Form values remain on the current page after a failed request; unfinished drafts are not saved across navigation or reload.

The fox is a local decorative WebP beside meaningful text, with reserved dimensions. Its 453,592-byte source remains larger than needed for the rendered slot. A small bundle and local development response times do not establish production performance.

## Verification and limits

The client builds and type-checks with Vite/TypeScript and passes frontend lint. Browser verification against an isolated local API database covers guest creation, incorrect feedback without XP, corrected lesson completion, sequential unlock after reload, profile consent/pseudonym persistence and saved journal notes. Responsive captures use 360, 390, 430 and 768px; enlarged-text captures use 390px. Local artifacts are under ignored `output/playwright/`.

At this checkpoint, the simulator UI is implemented against its API contract but its complete browser journey awaits the integrated simulation service. Delayed reviews are not forced due in the browser test, and mastery assessments beyond the first completed lesson have not been browser-verified. Independent curriculum approval, production authentication, load measurement and real beginner testing remain separate validation work. The static exploration's previous QA is not claimed as evidence for this client.
