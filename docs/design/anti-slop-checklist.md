# Design review criteria

Reject a concept or UI change if it fails any blocking criterion. Scores help compare viable directions; a high average does not cancel a safety or accessibility failure.

| Area          | Blocking evidence                                                                                                       | Positive evidence                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Identity      | Generic gradient hero, universal glass cards, neon glow, copied sample styling, repetitive rounded-card layout          | A recognizable composition and restrained palette with documented roles                   |
| Typography    | Default or unmodified Inter-only treatment; arbitrary weights/sizes; all-caps everywhere                                | One or two deliberate named typefaces and a readable hierarchy                            |
| Purpose       | Decorative charts, emoji icons, mixed icon styles, blobs/particles, filler stats                                        | Decoration explains route, status or action; icons share geometry                         |
| Copy          | Hype, urgency, undefined jargon, generic encouragement, profitability claims                                            | Plain explanations of the next action, outcome and uncertainty                            |
| Safety        | Profit/volume/trade-count rewards, trading pressure, order celebration, default leverage, copy-trading                  | Learning/process rewards, optional non-trade decisions and explicit prerequisites         |
| Interaction   | Unclear next step, misleading resume, dead controls, hidden locks, full-screen unexplained loading                      | One primary action, progressive disclosure, honest recovery and useful state explanations |
| Accessibility | Contrast below AA, target below 44px, invisible focus, color-only meaning, inaccessible modal, motion without reduction | Measured contrast, keyboard journey, labelled inputs, text state, 200% text zoom          |
| Performance   | Unneeded dependencies, network/font blockers, chart-heavy learning entry, unbounded work                                | Local lean prototypes; later product profiling against declared budgets                   |
| Consistency   | Unexplained one-off spacing/radii/colors or bypassed approved components                                                | Candidate rules within a concept; approved tokens/components after selection              |
| Evidence      | Invented users/results, screenshots without viewport/state identity, claims unsupported by inspection                   | Labelled example data, reproducible captures, limitations and resolved findings           |

Map-meaning test: hide the geography names and check whether the entry check, connected levels, optional bonus branch and exit check still explain the learning sequence. Opening a node must expose its task and prerequisites. A renamed checklist is insufficient; scenery and animation are unnecessary.

Learning-loop test: complete the prototype from the dashboard through a briefing, answer/task, wrong-answer recovery, success and updated map. Reject disconnected screen mockups, a task labelled as simulation that only collects prose, generic mandatory essay fields on routine quizzes, bonus rewards without criteria, or a completion state without a next action. Product UI must demonstrate the same flow against the existing persisted learning runs, including server rejection and recovery; prototype storage is not backend evidence. API journey tests do not replace the frontend's 390px interaction and accessibility review.

For each direction score identity, hierarchy, beginner comprehension, map meaning, accessibility and safety from 1 (poor) to 5 (strong). List specific observed evidence, remaining weaknesses and any blocker. Reviewers must disagree where evidence warrants it; the design lead records the resolution. An override requires a written reason and cannot waive the product safety rules.
