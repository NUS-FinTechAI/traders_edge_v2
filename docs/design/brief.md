# Design brief

Status: exploration brief. No direction, final tokens or product UI is approved.

## Audience and purpose

Complete beginners learning on a phone, usually in portrait orientation and short sessions. They may not know what an asset, broker, spread or drawdown is. The product teaches reasoning about money, uncertainty and risk before trading. It must feel calm, curious and trustworthy, with clear feedback and time to reconsider.

The owner describes v1 as slow, unfriendly and unintuitive. Changing colors will not resolve that. A learner should understand where they are, what to do next and why a feature is locked without learning the interface first. Reveal one decision at a time. Explain a new term in place. Preserve work across interruptions once that capability is implemented; never label a restart as resume.

## Shared exploration task

Each direction is a working static HTML/CSS prototype of three screens: dashboard, Module 1 treasure-map level selection and quiz. It must work from a local static server without package installation or external requests. Keep concept assets isolated under `docs/design/explorations/<direction>/`. Each direction includes its own short rationale, named typefaces, palette roles, layout principles and motion rules. These are candidate choices, not approved design tokens.

Use the same example learning objective across concepts: distinguish money needed for essential near-term spending from money available for uncertain market outcomes. Label every displayed progress state as an example. Do not invent testimonials, user counts, live prices, performance results or promised learning outcomes.

The dashboard has one dominant learning action, progress context, a restrained learning-streak/activity summary and clear secondary access to the learning path. The path must use the required treasure-map metaphor through meaningful geography, route and milestones rather than wallpaper. Standard and bonus stars require text equivalents. The quiz uses one question, a reasoned choice, explanatory feedback, optional confidence input and a clear next action. Reward reasoning or learning completion, never an order or its return.

Three independent briefs: an editorial reading experience; a paper-and-ink fieldbook journey; a calm utilitarian learning workspace. Designers must not inspect each other's concepts before critique. Each direction must differ in composition, hierarchy and navigation treatment, not just palette.

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

Render every concept and its states at the four target widths. Review all three independently for visual distinction, beginner comprehension, accessibility, safety and performance discipline. Record evidence, scores and disagreements; fix blockers before recommending a direction. Present screenshots and a recommendation to the owner, then stop for selection or feedback. Only after approval write `DESIGN.md`, final tokens, component inventory and full screen specifications. Implementation still needs a separate go-ahead.
