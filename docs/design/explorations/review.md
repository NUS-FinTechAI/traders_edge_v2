# Direction review

Status: ready for the owner's visual direction choice. No direction is approved. These are static explorations, not product implementation; the remaining technical/curriculum design and separate implementation approval still apply.

Open `index.html` through a local static server, or open any direction's `dashboard.html`, `map.html` and `quiz.html`. From the repository root: `python3 -m http.server 5180 --directory docs/design/explorations`, then visit `http://localhost:5180`. No dependencies or remote fonts are needed.

## Recommendation

Choose **Fieldbook** as the starting direction. Its compact next task appears early, and the foundations shore, boundary, connected checkpoints and knowledge cache explain the required map metaphor. Forest ink and ruled paper give it an identity without trading-screen pressure. Refine duplicated route text and the compact masthead in the eventual specification.

**Editorial** has the strongest journal character and a direct lesson start. The longer atlas plus written route asks for more scrolling; enlarged text sometimes breaks long labels across lines. **Workbench** has practical wording and restrained square controls, but more orientation labels and an extra route step stand between the dashboard and practice. Either remains a viable owner choice.

All use local fonts; the exact face depends on the device. Font licensing, distribution and device testing belong in the approved specification. The candidate lesson counts differ deliberately; these are visual examples, not competing curriculum definitions.

## Scores

Each review scores 1–5 for identity, hierarchy, beginner comprehension, map meaning, accessibility and safety. These are expert judgments, not measured user outcomes. Three designers produced their first drafts independently, then took separate critique roles across all three directions. Each also reviewed their own work; the design lead reconciled findings. No participant study is claimed.

| Review               | Direction | Identity | Hierarchy | Beginner | Map | Accessibility | Safety |
| -------------------- | --------- | -------- | --------- | -------- | --- | ------------- | ------ |
| Visual critique      | Editorial | 4        | 4         | 4        | 4   | 4             | 5      |
| Visual critique      | Fieldbook | 4        | 5         | 4        | 4   | 4             | 5      |
| Visual critique      | Workbench | 4        | 4         | 5        | 4   | 4             | 5      |
| Accessibility        | Editorial | 4        | 4         | 4        | 4   | 4             | 5      |
| Accessibility        | Fieldbook | 5        | 4         | 4        | 5   | 4             | 5      |
| Accessibility        | Workbench | 4        | 4         | 4        | 4   | 4             | 5      |
| Beginner walkthrough | Editorial | 5        | 4         | 4        | 4   | 4             | 5      |
| Beginner walkthrough | Fieldbook | 5        | 4         | 5        | 5   | 4             | 5      |
| Beginner walkthrough | Workbench | 4        | 3         | 4        | 4   | 4             | 5      |

Totals: Fieldbook 81/90, Editorial 76/90, Workbench 75/90. Totals summarize the table; they do not override a blocker. There are no unresolved blockers in this static review scope. The disagreement is useful: Workbench's plain copy scored best with the visual review, while the beginner walkthrough preferred Fieldbook's shorter next-step path. The recommendation prioritizes that path given the reported v1 usability problem.

## Corrections made

The first maps were blocked as renamed vertical checklists. All three now have spatial connected routes, optional branches and a destination, with written navigation alongside them. No block was overridden. Fieldbook's first dashboard was too close to Editorial; the compact field-note composition distinguishes it. Its empty and success views now use coherent counts, activity and next-lesson explanations.

Workbench's small Today target was increased to 44px. Its fixed map canvas and Editorial's unbreakable map labels failed doubled-text checks; flowing layouts and wrapping resolved the collision/overflow. Activity graphics now provide full weekday descriptions. Generic headings were replaced by concrete learning purposes. Confidence stays optional; it does not imply measured calibration scoring in these examples.

## Evidence and limits

Each direction contains `qa-summary.json` with browser version, source byte counts and hashes, viewport matrix and interaction results. Each has 72 final captures: three screens, default plus empty/loading/error/locked/success, at 360/390/430/768px. Phone viewport height is 844px; tablet is 1024px. Final captures have HTTP200, no page errors, external resource requests or horizontal overflow, and no under-44px visible targets in the recorded scan. PNG files are full-page captures.

The target scan covers visible links, buttons, inputs, selects, textareas and disclosure summaries; radio targets use associated labels. It excludes hidden controls and the offscreen skip link until focused. Separate keyboard inspection confirmed each first-focus skip link has a visible 3px outline. Missing answers, both wrong choices, retry reset/refocus, correct feedback and return-to-route journeys passed in each quiz. Reduced-motion emulation showed no running animation. This is not a complete keyboard or assistive-technology audit.

Nine additional `*-text-200-390.png` captures double computed text sizes and numeric line heights at390px. All fit390px and were visually inspected for collisions. This is a text-size stress procedure, not native browser zoom. The initial390px screenshots are preserved as `initial-<screen>-390.png`; compare them with `<screen>-default-390.png` for before/after evidence.

Measured candidate foreground/background contrast pairs exceed4.5:1 for normal text: Editorial's secondary text6.14:1; Fieldbook's muted text5.78:1; Workbench's muted text5.90:1. Other palette pairs and rationale are recorded per direction. These checks do not certify WCAG conformance. Browser/screen-reader combinations and intended beginners still need testing.

The prototypes make no server calls and save no progress. A quiz answer is not a mastery implementation. Loading/error/locked states are explicit diagnostic examples; no live request is being simulated. Static byte counts and no external requests do not prove production performance. The proposed product budgets and participant tasks are in [performance and beginner usability](../../performance-and-usability.md).

Staff/source and safety review found no blocker to publishing the explorations. No profit, trade-count or volume reward, trading urgency, execution shortcut or real learner statistics are included. Repository lint, types, build and API tests pass; each exploration PR must also pass hosted CI before merge.

## Next gate

The owner selects Editorial, Fieldbook or Workbench, or requests changes. Only then write the final design specification and tokens. Complete the remaining Phase2 architecture, curriculum, assessment, content contracts and safety/staff review before requesting the separate implementation go-ahead.
