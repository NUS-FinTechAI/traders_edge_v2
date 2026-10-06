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

## Content mapping coverage

`learning-inventory.json` now annotates the existing `content` groups with `targetMappings` keyed by unchanged source record ID. Original IDs, source lines, titles, parameters already inventoried, answer indices, points and file dispositions remain intact. These are **audit proposals, not ported runtime content, a new canonical lesson format or curriculum approval**. `targetModules` follows the supervisor brief's order; target module numbers must not be confused with the five v1 modules. Frontend visual design remains with the frontend teammate.

| Source asset                          | Accounted / total | Adapted | Deferred | Rejected |
| ------------------------------------- | ----------------: | ------: | -------: | -------: |
| Levels: 27 adventure + 2 puzzle       |           29 / 29 |      25 |        4 |        0 |
| Quizzes: pre/post for five v1 modules |           10 / 10 |      10 |        0 |        0 |
| Question rows                         |           64 / 64 |      49 |       14 |        1 |
| Inserted mission rows                 |           89 / 89 |      51 |       16 |       22 |
| Frontend tutorial references          |           23 / 23 |       — |        — |        — |

Each mapped ID has a destination, objective, disposition and specific reason. None is approved unchanged (`retained` count is zero). Rejected means the old success condition or question premise is excluded; its source row remains, with a replacement learning task. Deferred means preserved optional material awaiting mastery prerequisites and review, not deleted content. All old grading predicates require replacement even where the learning concept is adapted. Tutorial references point to the frontend inventory's existing 23 IDs/122 steps; they do not duplicate those assets or claim step-level reauthoring is complete.

Quiz sizes are **4+4, 6+6, 8+8, 6+6, 8+8 = 64**. SQL verifies ten exact pre/post duplicate pairs: `m1-{pre,post}-1..4` and `m2-{pre,post}-1..6`. Thus 20 rows belong to ten pairs, with 44 other rows: **54 distinct full items**, not 64 independent assessment items. Both members are explicitly cross-linked. Reauthor pre/post/delayed checks as parallel forms with unfamiliar cases, balanced answer positions, plausible distractors and confidence estimates. Other related pre/post topics are not falsely counted as exact duplicates. Redistribution of source questions is not a claim that all ten target modules already have adequate checks.

The 89 missions are 27 PnL, five excess-return, 17 order-type, four trade-action, seven maximum-order-count, 11 drawdown and 18 other portfolio predicates. These totals are mutually exclusive and sum to 89. Wealth-based points are a separate level/engine mechanism, **not additional mission rows**. Two legacy deletion keys are not added to inserted-mission coverage. `module-1.1`, `module-1.2` and both puzzles have no seeded mission rows; author new observable missions rather than infer coverage from their level presence.

## Proposed sequence and material movement

| Target module, in brief order | v1 basis and proposed game objective                                                                             | Missing or changed material                                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Money Before Markets       | New budget/suitability mission: allocate scarce money, match goals/horizon and reject an unsuitable trade.       | Emergency savings, debt, risk capacity, saving/investing/trading/speculation distinctions are missing foundations.                                                       |
| 2. How Markets Work           | `1.2`, `3.1`: reconstruct candles and explore bid/ask/liquidity in a paused book.                                | Add brokers/exchanges and price formation; no forced orders or timer pressure.                                                                                           |
| 3. Investment Products        | `1.1`: stock ownership and uncertain returns through product choices.                                            | Add bonds, funds, ETFs, fees and return sources; v1 is stock-heavy.                                                                                                      |
| 4. Building a Portfolio       | `5.1`, `5.3`, `5.5`–`5.7`: allocate, detect crowding/drift and interpret a passive benchmark.                    | Move portfolio earlier in an allocation sandbox, before execution. Add asset classes and cost-aware policy bands; remove rotation deadlines and beating-benchmark goals. |
| 5. Safe Execution             | `1.3`, `3.2`–`3.4`: predict fills, trigger behavior, partial fills, slippage and non-fill.                       | Add fees/settlement and plan-before-trade evidence; stops do not guarantee a loss cap.                                                                                   |
| 6. Managing Risk              | `1.4`, `5.4` and redistributed risk questions: stress position size, loss budget, beta/volatility and drawdown.  | Replace buy-low/sell-high success with adverse-path reasoning. Add gap loss and recovery arithmetic.                                                                     |
| 7. Making Decisions           | `2.1`–`2.3`, `4.1`–`4.2`, `5.2`: investigate news, expectations and fundamentals before a calibrated prediction. | Source verification, counterevidence and base rates; static company metadata is not current investment advice.                                                           |
| 8. Psychology and Protection  | Partial headline/whipsaw context and `m4-pre-6`; investigate social pressure and conflicts.                      | Author bias, scams, impersonation, guaranteed-return offers, refusal and reporting missions. Existing material is not sufficient fraud education.                        |
| 9. Integrated Simulation      | `4.3`–`4.5`, both puzzles: apply a written plan under conflicting signals and unfamiliar shocks.                 | Gate on modules 1–8 mastery, add delayed transfer and varied paths. Do not carry forward early puzzle unlocking.                                                         |
| 10. Optional Advanced Paths   | `2.4`–`2.5`, `3.5`–`3.6`: critique MA/EMA signals and short liability on counterexample paths.                   | Defer all four levels, 16 missions and 14 questions until core mastery; add borrow, margin and squeeze risks. Leverage/futures/options need new reviewed content.        |

Level shorthand above denotes source `module-*` IDs, not target IDs. All five source modules remain accounted for despite redistribution. Reuse foundation material in later integrated missions without counting it again as a new source asset. Multiplayer remains future mastery-gated practice. The existing endless API is a bounded synthetic session gated on nine module checks; neither mode establishes a completed curriculum.

## Gameplay and assessment transformations

Keep the learning loop **question → brief explanation/example → prediction → guided mission → feedback/reflection → delayed review → mastery check**. Learners investigate news, manipulate allocations, inspect order books, test contingencies and compare hidden branches. Plans and reflection support these actions; filling text fields or repeating orders must not earn mastery. Every simulated trade requires a prewritten plan. A justified hold/no-trade choice is valid, but inactivity alone is not completion.

| Source example                               | Replacement learning evidence                                                                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `module-1.4:profit_500` / `profit_1000`      | Size exposure to a stated loss budget, validate the calculation, then transfer the plan to an unfamiliar losing path. No profit threshold or wealth multiplier.                              |
| `module-2.1:react_to_news_once`              | Inspect headline source and timing; freeze a forecast before reveal; choose act/hold and compare calibration with the observed branch. Not “trade on news.”                                  |
| `module-3.3:limit_loss_400`                  | Reconstruct peak-to-trough drawdown separately from final PnL after gap/slippage. SQL calls this “drawdown” but actually grades final PnL ≥ -400.                                            |
| `module-3.6:confirm_short_entry`             | After advanced prerequisites, inspect counterevidence and squeeze exposure before accepting/rejecting an entry. The old evaluator only counts `sell_short`; it does not verify confirmation. |
| `module-4.5:max_four_orders`                 | Audit whether decisions followed visible evidence and the risk plan. No reward for either high activity or arbitrary low order count.                                                        |
| `module-5.5:rebalance_after_rotation_signal` | Compare drift with precommitted policy bands, simulate costs and justify rebalance or hold. Remove tick-42/eight-tick urgency and mandatory allocation shift.                                |
| `module-5.7:deliver_alpha_vs_benchmark`      | Select a suitable passive comparison, calculate cost-adjusted excess return and distinguish luck from skill; benchmark losses may still accompany sound decisions.                           |
| `m3-post-6`, `m5-post-4`, `m5-post-8`        | Correct “cap squeeze losses,” replace tick-deadline trivia, and remove “outperforms benchmark” from the definition of portfolio skill. Preserve the source answer indices only as evidence.  |

Backend evidence is `single_player_engine.py:1231–1257` (mission plus final-net-worth points) and `1431–1690` (count, PnL, drawdown and portfolio predicates). Quiz evidence is `quiz_service.py:120–180`: one attempt, count-correct score and zero passing thresholds from SQL `4799–4809`; these are not valid mastery gates. Source SQL `8–556`, `946–2353` and `4812–5013` was checked for levels, missions and complete question prompts/options/answers/explanations, not just old orientation documents.

## Remaining full-port checklist

The backend already has canonical entry/practice/bonus/exit/review runs, deterministic friction and private future snapshots, replay, written plans before orders and mastery gates. Only `m05-l01` currently has a lesson-bound audit. The checklist below describes extensions and independently reviewed ports beyond these safeguards.

- [ ] **Curriculum:** review each mapped objective, author missing readiness/product/protection foundations, localize region-specific rules separately, and define remediation, delayed retrieval and per-objective mastery criteria. Rewrite all duplicate pairs as parallel forms; correct the specific question defects above and review every source explanation.
- [ ] **Mission authoring:** create new tasks for the four levels without seeded missions; turn proposed objectives into worked examples, branching scenarios, accessible evidence interactions and reviewer-checkable rubrics. Optional branches must not become beginner prerequisites. No points for text completion, profit, wealth, trading frequency/volume or speed.
- [ ] **Backend/contracts:** extend the existing plan-before-order, observed-state, confidence and command-evidence contracts to forecasts, allocations and richer order/fill/hold assessment. Verify calculations and compare actions to frozen plans, rather than trust self-reported rationale. Review realism and extend existing fees, spread, slippage, partial/non-fill and adverse-path behavior where each port requires it; preserve deterministic replay and private future state.
- [ ] **Scoring/gates:** replace all v1 mission predicates and cash multipliers; retain outcome metrics only as feedback. Test sound losing plans, reckless winners, justified abstention, empty/inactive sessions, missing evidence and defensive actions exceeding old order caps. Replace zero-score/one-attempt quiz completion; retain existing execution/advanced/endless mastery gates and define equivalent gates for puzzles and future multiplayer.
- [ ] **Provenance/licensing:** verify source claims and information timestamps; obtain dataset/redistribution rights and version approved fixtures with seed, friction and hidden future. Yahoo-backed configurations are not an owned frozen dataset. The two crisis puzzles and orderbook levels are synthetic narratives, not approved real history. Audit static fundamentals, macro/news effects and reference portfolios before use.
- [ ] **Integration/review:** map content into the existing canonical content and simulation contracts; independently review future extensions; do not introduce another runtime format. Curriculum/safety review and backend tests remain required. Coordinate tutorial adaptation with the frontend owner without choosing visual design here.

### Historical checks performed for this mapping

- Confirmed source v1 HEAD equals `2bf6b5930858fdbb61bc388d4554d4657d9ce377`. The mapping authoring branch was `docs/v1-content-mapping`; the current read-only v1 checkout is on `main`.
- Parsed the audit JSON from the Git diff; asserted exact source-ID/target-mapping set equality for all four groups, allowed dispositions, target module range, reciprocal duplicate links and preservation of every original content record and file classification.
- Independently parsed the committed SQL to verify 27 adventure/2 puzzle levels, 89 unique mission keys, ten quizzes, per-quiz question counts and ten exact full-item duplicate pairs (54 distinct items).
- Checked all 23 tutorial references against the existing frontend inventory; no tutorial rows/steps are newly counted. `git diff --check` passes. The JSON parses successfully. The targeted Prettier check could not run because Prettier 3.9.9 is not installed (`npm exec --no` refused installation); formatting remains a handoff check, with no dependencies installed here. Runtime tests/build are not evidence of content approval and were not run for this audit-only mapping.

### Publication verification

Rechecked source-ID/mapping set equality, disposition totals, original record/file preservation, ten exact duplicate pairs and all 23 tutorial references against the read-only source. Scoped formatting and repository checks pass; the historical formatting limitation above no longer applies to this publication. The mapping remains an audit proposal. Independent financial/pedagogical publication approval, frontend adaptation and learning-outcome evidence remain outstanding.
