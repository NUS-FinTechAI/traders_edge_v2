# Selected design reference

The owner selected Fieldbook’s learning structure, then requested a contemporary treatment informed by Brilliant and Duolingo and a small thoughtful fox. The retained refinement uses white surfaces, cobalt actions, a compact next task and an accessible connected learning route. The original parchment/forest palette and serif treatment were rejected. Product implementation has since been authorized; these static examples are historical design references, not the current application.

| Screen       | Working reference                             | Retained 390px capture                                                   |
| ------------ | --------------------------------------------- | ------------------------------------------------------------------------ |
| Dashboard    | [Dashboard](fieldbook-refined/dashboard.html) | [Phone capture](fieldbook-refined/screenshots/dashboard-default-390.png) |
| Learning map | [Map](fieldbook-refined/map.html)             | [Phone capture](fieldbook-refined/screenshots/map-default-390.png)       |
| Quiz         | [Quiz](fieldbook-refined/quiz.html)           | [Phone capture](fieldbook-refined/screenshots/quiz-default-390.png)      |

For a local preview, run `python3 -m http.server 5180 --directory docs/design/explorations/fieldbook-refined` from the repository root and visit `http://localhost:5180/dashboard.html`. Progress in these pages is explicitly example data and is not saved.

The [rationale](fieldbook-refined/rationale.md) records the composition and its limits. The [competitor study](../competitor-study.md) distinguishes observed references from design inferences. The [QA summary](fieldbook-refined/qa-summary.json) retains browser version, source hashes, the 72-case screen/state/viewport matrix, three doubled-text checks and quiz interaction results. Captured checks reported no horizontal overflow, external requests, page errors or visible target-size failures. These are expert checks, not participant results, a complete assistive-technology audit or proof of production speed.

Early maps were blocked because they behaved like renamed checklists. Connected spatial checkpoints, an optional reflection branch and a learning-cache destination made the map’s meaning explicit. The refinement shortened the dashboard’s path to practice, explained wrong answers specifically and kept confidence optional. The fox offers a useful question without pressure; one correct answer is explicitly insufficient for mastery. Stars describe learning, never profit.

The discarded Editorial, original Fieldbook and Workbench prototypes, comparison gallery and full capture matrices remain recoverable from Git history before this cleanup. Only the three selected phone captures are retained in the working tree to keep review evidence useful and compact. The [performance and usability requirements](../../performance-and-usability.md) apply to implementation separately.
