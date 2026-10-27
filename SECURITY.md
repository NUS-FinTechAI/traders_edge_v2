# Security

Security fixes are developed against `master`. There is no published support
schedule for older revisions. The project is still preparing for public
contributions; see the [release readiness plan](docs/open-source/release-readiness.md)
for unresolved release requirements.

## Report a vulnerability

Use GitHub's
[private vulnerability report](https://github.com/NUS-FinTechAI/traders_edge_v2/security/advisories/new)
if the repository offers it. If that option is unavailable, open an issue
asking a maintainer for a private reporting contact, without vulnerability
details. A private reporting route has not yet been verified for this
repository. Do not publish an exploit, credentials, account identifiers or
participant data in an issue or pull request.

In the private report, include the affected commit, component, prerequisites,
expected and observed behaviour, impact, and the smallest reproduction using
disposable local accounts and data. Include a proposed fix if you have one.
Avoid testing against other people's accounts or the hosted service without
permission.

Maintainers will assess the report and coordinate a fix and disclosure with
the reporter. No response or remediation deadline is promised. Routine setup
questions and non-sensitive bugs belong in
[issues](https://github.com/NUS-FinTechAI/traders_edge_v2/issues).

## Deployment boundaries

Local guest sessions and SQLite are intended for development. Keep research
enrollment disabled until the study and consent policy have the required
approvals. Production gameplay remains blocked until independent content
review is approved. Account deletion and retention rules are pending.

Keep Firebase Admin credentials and other secrets in the host environment,
outside the repository and client build. Follow the
[deployment guide](docs/operations/deployment.md) and
[server configuration](server/README.md#configuration) when hosting a copy.
