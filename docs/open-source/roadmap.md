# Roadmap

Trader's Edge gives beginners a place to connect trading lessons to decisions
in a fictional market. Instructors can use private matches and quizzes;
developers can extend authored content and the simulation. The immediate
goal is a release another team can reproduce, inspect and maintain.

This is an order of work, not a dated delivery promise. Propose a scoped
issue with acceptance evidence before implementing a milestone. Follow
[CONTRIBUTING.md](../../CONTRIBUTING.md) and the
[game design document](../game-design.md); changes to gameplay need their
normal product and safety review.

| Milestone                              | Work                                                                                                                                                                   | Acceptance evidence                                                                                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Reusable release                    | Complete provenance and required notices under the recorded MIT license scope; verify private security reporting and required checks; complete a fresh-clone demo      | Completed [rights inventory](release-readiness.md#license-and-provenance), required notices, a clean locked install and demo results tied to a revision                               |
| 2. Reviewed hosted pilot               | Independent content review, verified Firebase sign-in, consent/withdrawal, account deletion and retention, scoped researcher access, backup/restore and ingress limits | Review of the exact content edition, hosted smoke results with approved disposable accounts, documented data lifecycle and a tested restore; production's content gate stays enforced |
| 3. Reliability and accessibility       | Measure match polling and settlement on PostgreSQL under representative concurrent use; observe new-player tasks and keyboard/screen-reader use                        | Published environment, workload, errors and latency against [proposed budgets](../operations/performance.md); observed usability/accessibility findings and resolved defects          |
| 4. Contributor extension example       | Take one small scenario or lesson change through authoring, validation, balance checks and review; document the path from content to the client                        | A reviewed example PR, stable IDs/versioning, passing contract and balance checks, and instructions a contributor can repeat                                                          |
| 5. Learning evaluation and maintenance | Run the approved study; establish release ownership, supported versions and migration/deprecation policy                                                               | A defined assessment rubric and study limitations, real participant evidence, a tagged release and maintainers who accept ongoing responsibility                                      |

## Contribute now

Start with the [demo](../contributing/demo.md), a documentation correction,
an accessibility observation or a small proposal through the
[issue tracker](https://github.com/NUS-FinTechAI/traders_edge_v2/issues).
Check existing issues and assignees before taking work. For example,
[account-creation consent (#163)](https://github.com/NUS-FinTechAI/traders_edge_v2/issues/163)
already has a discussion; coordinate there rather than duplicating it.

The [authoring guide](../content/authoring.md) explains the content formats.
The [architecture](../../ARCHITECTURE.md) explains the game hooks and module
boundaries. A scenario contribution must keep balance checks intact; reward,
simulation and copy changes need safety review. There is no verified
production release or learning outcome to advertise yet.

## Maintenance

Maintainers review dependency updates through the same locked-install CI as
other changes. Major updates need an explicit compatibility review; do not
merge solely because an update tool opened the PR. Keep changes narrow and
document configuration or API changes alongside the code. Append migrations
and test preservation of existing player records.

Before a first tagged release, name a release owner and publish its support
scope. Until then, the repository's default branch is the development target;
there is no promised backport schedule. Use the
[security policy](../../SECURITY.md) for private vulnerability reports and
the [release gates](release-readiness.md#release-gates) to assess readiness.
