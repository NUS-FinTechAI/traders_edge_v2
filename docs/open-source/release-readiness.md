# Release readiness

Original project work is available under the [MIT license](../../LICENSE).
A packaged release still needs the remaining provenance and attribution
review. This page separates that work from running a local demo and operating
a service for real players.

## License and provenance

The [MIT license](../../LICENSE) covers original software, documentation and
authored teaching and research content. The [license scope](../../LICENSE_SCOPE.md)
keeps supplied owner inputs, artwork and third-party material under their
separate terms. Record the team's authority and any applicable university or
collaborator requirements as part of the provenance review; the license does
not establish ownership of incorporated material.

Record the rights holder, original source, applicable license or written
permission, required attribution and release scope for each group below.
The entries are an inventory for review, not assertions of ownership.

| Material                                | Location                                                                  | Evidence still needed                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Application and tooling                 | `client/`, `server/`, `scripts/`, repository configuration                | Rights-holder record and required third-party notices; original work uses MIT                |
| Authored teaching and research material | `server/app/content/`, `docs/content/`                                    | Authors, source traceability, permission to redistribute and license scope                   |
| Supplied design and supervisor inputs   | `docs/source/`, `docs/game-design.md`                                     | Permission from their rights holders; these owner inputs must remain unedited                |
| Branding and icons                      | `client/public/`, `client/ui/Logo.tsx`                                    | Original sources/authors, permission and any trademark restrictions                          |
| Theme reference images                  | `docs/product/themes/`                                                    | Image authors, source material and redistribution permission                                 |
| Dependencies and container images       | Both npm lockfiles, `server/uv.lock`, `server/Dockerfile`, `compose.yaml` | License/notice review for the actual versions distributed, including transitive dependencies |

Keep required third-party notices with the release. The
[source register](../content/sources.md) belongs to the previous catalog;
it does not establish review or licensing of the current campaign. Do not
copy material from the earlier repository on the assumption that its
presence grants permission ([source material policy](../source/README.md)).

## Release gates

| Gate                             | Current evidence                                                                 | Before calling it complete                                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Open-source licensing            | MIT license and scope recorded; provenance review remains incomplete             | Complete rights and attribution evidence for incorporated material, exclusions and distributed dependencies                                                  |
| Reproducible local demo          | Guest/SQLite path, automated suites and a [walkthrough](../contributing/demo.md) | Repeat on a fresh clone using locked installs; record revision, environment and results                                                                      |
| Content publication              | Validator passes; `review.json` remains `authored_requires_independent_review`   | Independent financial and pedagogical review of the exact content edition; production must keep refusing gameplay until approved                             |
| Hosted identity and data         | Firebase and research authorization are implemented and tested locally           | Verify hosted sign-in, consent and withdrawal, researcher scope, account deletion, retention and backups with approved test accounts                         |
| Public service protection        | Application checks exist; ingress protection and capacity are unverified         | Configure request-size/rate limits and measure representative match polling on the hosted stack ([deployment limits](../operations/deployment.md))           |
| Repository security              | Reporting policy and CI are versioned                                            | Verify the private reporting route, required branch checks, secret scanning and dependency alerts; review the full Git history before distributing a release |
| Usability and educational claims | Theme references, test coverage and an unvalidated decision score                | Record observed accessibility/usability results; approve the study before collecting participant data; measure learning before claiming an effect            |

The [roadmap](roadmap.md) defines acceptance evidence for the remaining work.
These gates do not substitute for a content review, an ethics decision or
permission from the rights holders of separately scoped material.

## Evidence to keep with a release

Record the commit or tag and versions of Node.js, Python, uv and the database.
Run the [README checks](../../README.md#checks), including the live
PostgreSQL job. Record skipped checks explicitly. A green client suite alone
does not cover the backend or content.

Follow the local walkthrough from a new browser profile, then capture a short
screen recording of a completed match and lesson. Use fictional data and
disposable accounts. For a hosted release, retain the authenticated smoke
results described in the [hosting guide](../operations/hosting.md#6-check-the-deployment).
An HTTP health response proves liveness only.

When presenting the project, distinguish the implemented design from evidence
of impact: reproducible scenarios, rule-based opponents, classroom activities
and decision-context exports are demonstrable. Adoption, novelty relative to
other projects and learning gains need separate evidence. Do not present
test counts, profit or the decision score as learning outcomes.
