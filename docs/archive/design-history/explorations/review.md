# Historical design reference

On 5 October 2026 the owner rejected the connected learning experience and reopened design selection. The reference below records the earlier choice; it does not authorize replacement UI. New concepts must demonstrate the module entry-check, interactive level, mission and exit-check loop before selection. Prototype checks below do not establish acceptance of the application.

In the earlier selection, the owner chose Fieldbook’s learning structure, then requested a contemporary treatment informed by Brilliant and Duolingo and a small thoughtful fox. The retained refinement uses white surfaces, cobalt actions, a compact next task and a connected learning route. The original parchment/forest palette and serif treatment were rejected. Implementation of that earlier direction was authorized before selection reopened. These static examples preserve that history; they do not authorize the reopened replacement UI or establish its accessibility.

| Screen       | Working reference                             | Retained 390px capture                                                   |
| ------------ | --------------------------------------------- | ------------------------------------------------------------------------ |
| Dashboard    | [Dashboard](fieldbook-refined/dashboard.html) | [Phone capture](fieldbook-refined/screenshots/dashboard-default-390.png) |
| Learning map | [Map](fieldbook-refined/map.html)             | [Phone capture](fieldbook-refined/screenshots/map-default-390.png)       |
| Quiz         | [Quiz](fieldbook-refined/quiz.html)           | [Phone capture](fieldbook-refined/screenshots/quiz-default-390.png)      |

For a local preview, run `python3 -m http.server 5180 --directory docs/design/explorations/fieldbook-refined` from the repository root and visit `http://localhost:5180/dashboard.html`. Progress in these pages is explicitly example data and is not saved.

The [rationale](fieldbook-refined/rationale.md) records the composition and its limits. The [competitor study](../competitor-study.md) distinguishes observed references from design inferences. The [QA summary](fieldbook-refined/qa-summary.json) retains browser version, source hashes, the 72-case screen/state/viewport matrix, three doubled-text checks and quiz interaction results. Captured checks reported no horizontal overflow, external requests, page errors or visible target-size failures. These are expert checks, not participant results, a complete assistive-technology audit or proof of production speed.

Early maps were blocked because they behaved like renamed checklists. Connected spatial checkpoints, an optional reflection branch and a learning-cache destination made the map’s meaning explicit. The refinement shortened the dashboard’s path to practice, explained wrong answers specifically and kept confidence optional. The fox offers a useful question without pressure; one correct answer is explicitly insufficient for mastery. Stars describe learning, never profit.

An earlier historical cleanup removed the Editorial, original Fieldbook and Workbench prototypes, comparison gallery and full capture matrices from the tracked tree; they remain recoverable from that Git history. It retained the refined examples and three selected phone captures. The current cleanup preserves those existing tracked examples and captures without deleting files. The [performance and usability requirements](../../performance-and-usability.md) apply to implementation separately.
