# Fieldbook direction

Status: independent static concept candidate. No final design specification or product interface is approved. These pages are an exploration, not a production implementation.

## Idea and composition

A learning fieldbook makes progress a sequence of considered notes. The dashboard opens with a compact field-note heading and one ruled learning entry beside a readable, navigable chart; on phones the entry comes first. The map connects spatially offset checkpoints across a shaded foundations shore and a boundary into uncertainty. A solid required route leads to the knowledge cache; a dashed branch leads to optional reflection. Numbered notes below explain each stop and its prerequisites. The quiz is a reading page with reasoned choices and a quiet explanatory margin. Lines, alignment and whitespace divide content instead of repeated cards.

The treasure metaphor has a job: the shore groups goals and essential needs, the boundary marks the transition into uncertainty, and the route connects ordered checkpoints, visible prerequisites, an optional reflection branch and a knowledge cache at the end. The cache represents gathered explanations, not financial gain. Required and bonus stars have text equivalents. A completed answer is explicitly insufficient to establish mastery.

## Candidate visual choices

- Palatino is the deliberate humanist reading face, with Palatino Linotype, Book Antiqua and Georgia fallbacks. It connects headings and checkpoint numerals to the fieldbook idea.
- Avenir Next, Avenir and Segoe UI form the readable system sans stack for controls, explanations and metadata. No font is downloaded.
- Warm paper `#f7f2e7` is the page, forest ink `#263e32` is primary text and action, muted olive `#56624e` is secondary text, terracotta `#93462e` marks notes and recovery, and `#e8ebda` supports selected/feedback states. Pale rules are structural, not the only state cue.
- Space follows a restrained 4/8px family with larger reading breaks. Primary controls are almost square. Rounded shapes are reserved for route markers.
- No animation or motion is needed. Reduced-motion preferences are explicitly supported. There are no images, libraries, network calls, charts or external fonts.

These are candidate choices, not final tokens. Font portability and licensing remain later design work.

## Interaction and state contract

Serve this directory with any local static server and open `dashboard.html`. The dominant action opens the current checkpoint on `map.html`; the checkpoint opens `quiz.html`. Choices include their reasoning. The incorrect path explains the specific misconception and offers retry. The correct path explains the spending need, labels the result as example practice and returns to the route.

Each page supports `?state=empty|loading|error|locked|success` and a default state. The footer exposes diagnostic links in a disclosure. State banners preserve the page context, explain what happened and offer a real local action. Loading is deliberately deterministic for review; it does not pretend to contact a service. No data persists. Future checkpoints explain prerequisites and explicitly identify their limited prototype scope.

Native form controls, links, landmarks and disclosures support keyboard access. The skip link, visible focus, text status labels and at least 44px controls are intentional. Feedback receives focus. All example progress is labelled. The final `qa-summary.json` and shared review record the 360, 390, 430 and 768px captures, contrast, text-size stress and interaction checks, with their scope limits.

## Learning content basis

Shared objective: distinguish money needed for essential near-term spending from money available for uncertain market outcomes. The situation and proposed copy are author-created examples, grounded in the supplied supervisor summary’s Money Before Markets sequence, financial goals, time horizon and risk capacity. They are neither quoted research nor a new runtime content schema.

The route and lesson titles are design proposals. Later content work must identify primary-source passages and review them before publication. The quiz makes no investment recommendation or promise of profitability and gives no reward for trading. It teaches why uncertain prices can conflict with a fixed essential bill.

## Tradeoffs and next evidence

This direction favors reading, orientation and obvious actions over a dense feature hub. The fieldbook can scale through a consistent margin hierarchy, but the long route needs usability testing with beginners. The restrained map may feel less game-like than the reference mechanics; that is a design tradeoff to discuss at selection.

Small local files support a fast exploration, but do not prove production performance. A future implementation still needs device/network budgets, persistent progress contracts, validated mastery, measured task tests and a separate implementation approval.

## Revision after adversarial critique

The initial map was rejected as a checklist with map vocabulary. The revised chart makes protected foundations and the transition into uncertainty visible in geography, connects the destination, and separates the optional branch. All six stations are links to an action or prerequisite explanation. A semantic navigation landmark and numbered written notes preserve a readable alternative to spatial interpretation. Chart labels are HTML text, with equal expanding grid rows rather than fixed-height text boxes.

The original dashboard's large serif hero resembled the editorial candidate. It was removed in favor of a compact, ruled field-note entry, explicit current task and readable cartographic overview. The previous miniature SVG labels were removed. Empty and success states now carry coherent counts, route markers, next actions and activity: zero progress/no days in empty; two recorded checkpoints and a reasoning review in success. These changes require fresh parent capture and zoom verification.
