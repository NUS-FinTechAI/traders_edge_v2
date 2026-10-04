# Migration inventory

Source commit: `2bf6b5930858fdbb61bc388d4554d4657d9ce377` in v1.

The three JSON inventories partition all 253 tracked source files without gaps, duplicates or unknown paths. Each entry names its source path, disposition and reason. Counts are source assets, not migrated files:

| Inventory                                      | Files | Keep | Rewrite | Drop |
| ---------------------------------------------- | ----: | ---: | ------: | ---: |
| [Frontend](frontend-inventory.json)            |   150 |    1 |     136 |   13 |
| [Platform](platform-inventory.json)            |    67 |   10 |      45 |   12 |
| [Learning/simulation](learning-inventory.json) |    36 |    0 |      35 |    1 |
| Total                                          |   253 |   11 |     216 |   26 |

Keep identifies useful source or regression-behavior candidates; it is not approval to copy them unchanged. Rewrite preserves the named responsibility or learning concept under the new contracts. Drop excludes the asset from v2 without changing v1. Tests can be retained as behavioral evidence while their fixtures and import boundaries change.

The learning inventory also enumerates SQL content by stable IDs or explicit natural keys with source line numbers. It separates literal inserts from generated rows and deletion targets; counts of source rows must not be added together as if they were the final database state. It includes 29 levels, 58 ticker configurations, 89 inserted missions, 64 questions, ten quizzes, 22 tool definitions, 21 unlock records, 44 news events and seven achievement definitions. These items require curriculum and provenance review before use. The frontend inventory also lists all 23 tutorial IDs and their 122 individual steps by count.

Tracked `.DS_Store` is classified for removal from the rebuild. Untracked v1 orientation/research notes and the pre-existing modified binary are not migration assets and were left untouched. The separately supplied research brief and screen image are preserved in `docs/source/`.

No live user records or historical candle dataset was exported. Live-at-play data retrieval is a dependency to replace, not an owned dataset whose redistribution rights have been established.
