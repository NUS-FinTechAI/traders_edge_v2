# Design brief

Status: design selection reopened on 5 October 2026 after owner rejection of the connected application. The earlier Fieldbook reference is historical. A teammate now owns frontend visual design. Three independent concept branches are unmerged exploration material, not a selected application design. Backend/content work must support the complete workflow without imposing one candidate's appearance.

## Audience and purpose

Complete beginners learning on a phone, usually in portrait orientation and short sessions. They may not know what an asset, broker, spread or drawdown is. The product teaches reasoning about money, uncertainty and risk before trading. It must feel calm, curious and trustworthy, with clear feedback and time to reconsider.

The owner rejected the connected experience inspected on 5 October because routine lessons were long forms rather than interactive levels, and module entry quizzes, missions and rewards were missing from that learner journey. The backend now provides sequential tasks, diagnostics, required/bonus completion and finite rewards; frontend integration and the reopened visual selection remain pending. This is an interaction and progression problem, not a request to recolor Fieldbook. Preserve v1's useful learning loop without copying its desktop layout, early speculative content or financial-outcome scoring.

The route to demonstrate is module selection → diagnostic entry check → level briefing → interactive task → required and optional missions → feedback and learning reward → next level → module exit check. Wrong entry-check answers must not punish beginners. Exit criteria, remediation and retries need their own contract. A level must ask the learner to do something observable: choose between cases, sort needs, inspect a quote, compare allocations or use a guided simulator. A paragraph called a simulation does not qualify.

Present one task at a time. Do not require generic prediction, decision and reflection text boxes for every lesson, quiz and delayed review. Written plans remain mandatory before simulated orders; free text elsewhere needs a specific learning purpose. Connect interruption/recovery flows to the existing persisted learning runs and simulation sessions; never label a restart as resume.

## Shared exploration task

Each direction is a working static HTML/CSS prototype of three screens: dashboard, Module 1 treasure-map level selection and quiz. It must work from a local static server without package installation or external requests. Keep concept assets isolated under `docs/design/explorations/<direction>/`. Each direction includes its own short rationale, named typefaces, palette roles, layout principles and motion rules. These are candidate choices, not approved design tokens.

Use the same example learning objective across concepts: distinguish money needed for essential near-term spending from money available for uncertain market outcomes. Label every displayed progress state as an example. Do not invent testimonials, user counts, live prices, performance results or promised learning outcomes.

The dashboard shows the current module, a concrete next level or entry/exit check, earned learning progress, and a learning activity summary. The map includes an entry checkpoint, distinct playable levels, an optional bonus branch and an exit checkpoint. Standard and bonus stars have different explained criteria and text equivalents. A level opens a briefing that identifies the objective, task and required/bonus missions before entry. Locked nodes name their prerequisite.

Each prototype must support a connected click-through, not three unrelated screenshots: dashboard → map → entry check or level briefing → task/quiz → feedback → updated example map. Use one question at a time, a clear answer action, explanatory feedback, retry and an explicit next step. Completion updates labelled example progress without implying production persistence. Routine answer selection must not require an essay. Show a documented reset control for reviewers. Every visible control works or states the actual prerequisite; omit nonfunctional mode and reward buttons.

Assign three independent composition briefs after the learning-loop audit is reconciled. Do not simply regenerate the earlier Editorial, Fieldbook and Workbench layouts. Each direction needs a distinct visual identity, spatial route, task presentation and reward treatment, not only a different palette. Designers must not inspect each other's concepts before critique.

## Screen inventory beyond the prototypes

The approved product will need dashboard, module selection, lesson outcome popup, per-module treasure map, streak/activity heatmap, leaderboard/rank, profile/reward inventory, quiz feedback and archive/dictionary. They follow the research sequence. Multiplayer and endless practice show prerequisites until mastery; no profit ranking is allowed. Exploration does not claim these screens are implemented.

## Usability and accessibility constraints

At 390px, make the next learning action and its purpose visible without hunting through a grid of modes. Keep important controls at least 44px in both dimensions. Use visible keyboard focus, semantic headings/forms/navigation, accessible dialog behavior where relevant, and names for all controls. Meet WCAG AA contrast; convey completion, locks and correctness with text or shape as well as color. Support 200% text zoom, 360/390/430px phones and a 768px tablet. Respect reduced motion; no animation is necessary to understand the interface.

Error, loading, empty, locked and success states must retain orientation and explain the next action. Loading should not replace the whole interface with an unexplained spinner. A locked activity should name the prerequisite, not punish the learner. No countdowns, urgency cues or streak-loss threats.

For repeatable prototype QA, use `dashboard.html`, `map.html`, `quiz.html` and `?state=empty|loading|error|locked|success`. Default renders example progress; the query renders the requested explicit state. State controls are prototype diagnostics, not product navigation. Each state should be meaningful to that screen (for example, quiz success includes explanation; a locked map names prerequisite evidence).

## Performance expectations

Concepts use semantic HTML, local CSS and only the JavaScript required for interactions. Avoid external fonts/network calls and heavy chart, animation or component packages. Named installed typefaces with intentional fallbacks are acceptable for exploration; production font licensing and portability remain a later decision. Do not load candlestick charts on learning screens or mount every future feature in the dashboard.

Phase 2 technical design must set measurable budgets for loading, interaction and scenario start under specified mobile/network conditions. Phase 3 must capture those measurements and test first-time tasks. A small prototype is not evidence that the future application meets those budgets.

## Visual exclusions

Do not resemble a brokerage terminal, casino, fantasy game menu or generic software dashboard. No dark navy/neon palette, glowing hexagons, glass gradients, stock fantasy maps, decorative price charts, stock blobs, particle effects or confetti. Do not reproduce the reference image's style.

Use restrained colors with assigned roles, deliberate typography and consistent icon geometry. Avoid repeated rounded cards as the only layout tool, all-caps labels everywhere, generic motivational headlines and filler statistics. Plain copy should explain a choice or state rather than cheerlead.

## Selection gate

Frontend design ownership is with the teammate. Supply the content/assessment and server-state contracts plus the isolated concept evidence; do not merge a candidate or write final design tokens on their behalf. The owner must select the direction before final specifications or product UI. UI implementation requires a separate go-ahead after technical and safety review, plus mobile interaction and accessibility evidence. Backend implementation can proceed under the owner's delegated authority after contract review, without waiting for a cosmetic decision or asking for each routine change. Automated checks are not participant research.
