# Contributing

Read [AGENTS.md](AGENTS.md), the [source brief](docs/source/traders-edge-supervisor-summary.md) and the contract for the area being changed. Keep v1 read-only. Use a narrow task branch and the repository’s existing git identity.

Run `npm run lint`, `npm run typecheck`, `npm run build` and the relevant API/content tests before committing. Add behavioral coverage for changed grading, ownership, persistence or simulation invariants. Update the same contract documentation when behavior changes. Do not replace old migration definitions to fit new models.

Every PR needs correctness and scope review. Rewards, simulation and financial copy also need safety review; product UI needs design/accessibility review and 390px before/after evidence. Explain the concrete problem, resulting behavior, validation and material limits. Merge after findings are resolved and CI passes; do not force-push shared branches.

Repository workflows live in [.agents/skills/](.agents/skills/): adding lessons, scenarios and rewards; safety and design reviews; screenshot evidence; decision records; and PR review. They point to current contracts rather than duplicating schemas. Keep primary source documents verbatim and distinguish authored proposals from tested behavior.
