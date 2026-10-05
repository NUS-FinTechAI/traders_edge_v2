# Curriculum content

The runtime source is [`catalog.json`](../../server/app/content/catalog.json), loaded by `app.content.catalog.load_catalog()`. It contains all ten modules in the source brief’s order: 30 lessons, 60 practice questions, 50 module-check questions and 26 archive definitions. Each lesson has an objective, source IDs, prerequisites, a solved example and all nine learning-cycle prompts. Module 10 is optional and follows the first nine modules.

Status: **authored, awaiting independent financial-accuracy review**. Source reading and contract tests do not constitute that independent review. No entry is approved for production publication. Every number in an exercise is fictional and currency-neutral; examples are not personal allocation or trading recommendations.

The lesson activities are guided written decisions. Modules 1–4 use readiness, quote interpretation, product comparison and allocation; they do not execute orders. Modules 5–10 teach order and risk reasoning, including a written plan before any simulated trade. Module 9 contains planning and review exercises, not an implemented market simulator. A simulator needs its own validated scenario contract, provenance, seed, friction and private future path.

## Authoring contract

- `schema_version: 1` defines the shape; `content_version` identifies an authored edition. Keep stable IDs when wording changes. Do not reuse an ID for a different learning objective.
- Module IDs start `m01-` through `m10-`. Lessons use `m01-l01`; questions use `m01-l01-q01` or `m01-check-q01`. IDs are globally unique.
- `source_basis` is an array of catalog source IDs. Each source includes its title, HTTPS URL, reading date and scope limit. The [source register](sources.md) explains what was adopted.
- The nine `learning_cycle` values are plain strings: `question`, `explanation`, `worked_example`, `prediction`, `guided_decision`, `feedback`, `reflection`, `delayed_review`, `mastery_check`. These strings are public teaching material. Never put answer-key objects, future scenario data or private state inside them.
- Each question has three `{id, text}` options, one `correct_option_id`, an explanation and a private `critical` flag. Public question responses must omit the answer key, scoring flag and explanation until submission. Solved lesson examples remain visible teaching material.
- Each required lesson follows the previous lesson. A module follows the preceding module. The API must enforce prerequisites; the JSON does not unlock anything by itself.
- Practice requires every answer correct. Module checks require at least 80% and all critical risk items correct. A delayed check is due after 24 hours and uses the practice questions in this release. This interval is a product rule, not a demonstrated optimal learning schedule.
- Bonus reflections are optional authored prompts with `implementation_status: content_only`. They do not currently award bonus stars or block progression.

Run from the repository root:

```sh
PYTHONPATH=server python -m app.content.validate
PYTHONPATH=server python -m unittest app.content.test_catalog -v
```

The validator checks source references, answer options, unique IDs, ordering, prerequisites, nine string fields, risk flags and policy consistency. Tests exercise malformed catalogs and mutation isolation. Neither can establish financial accuracy, pedagogical effectiveness or accessible presentation.

Before publication, independently review every explanation and answer, check arithmetic and ambiguity, review source scope, and record approval against the content version. Only then can the catalog and every module and lesson change to `approved`. The service’s production review gate must continue rejecting pending content. Updating content must also consider stored attempts: historical results should retain their original answer and feedback, and an ID’s meaning must not silently change.
