# Adventure and daily challenge contracts

Policy `adventure-1` connects the existing chapter curriculum to the shared AI challenge engine. Migration 7 appends shared private challenge definitions, chapter access and boss completions. Existing mastery, lesson attempts and learning rewards retain their meaning.

`GET /api/adventure` supplies chapter progress, early-entry availability, boss results and the beginner recommendation to learn sequentially. Maps, level briefings, curriculum and workflow also recognize earned chapter access. Normal and bonus stars remain verified learning completions.

## Adventure read contracts

`GET /api/adventure/catalog` is an unauthenticated, read-only preview from the canonical catalog. It returns ordered chapter IDs, titles, descriptions, introductory-assessment presence and level IDs, titles, objectives and required/bonus step counts. It creates no profile or session and excludes tasks, answer keys, assessments, personal progress and attempt IDs. The existing production publication-review gate applies.

Signed-out users can browse chapter cards, maps and level previews. Signing in returns them to the selected chapter or level; progression prerequisites still apply. Personal reads and all play mutations remain authenticated. Development guest sessions retain their existing authentication semantics. This browsing slice does not implement mission or boss gameplay in the client.

`GET /api/adventure`, `GET /api/modules/{module_id}/map` and `GET /api/levels/{level_id}` have explicit OpenAPI response schemas, used to generate the client API types. Maps and briefings preserve their existing fields, including nullable `content_version` for legacy content and `active_run_id` for required practice.

Each Adventure chapter retains its existing fields and adds:

- `normal_stars: {earned, total}`: one earned star per completed required level, including preserved legacy completions. `total` is the chapter's level count.
- `special_stars: {earned, total}`: one earned star per level with a verified completed bonus run, regardless of repeat completions. `total` counts levels with authored `bonus_tasks`; legacy reflection prompts do not count.
- `entry_boss` and `exit_boss`: `{available, reason, active_attempt_ids}`. Availability means a **fresh start** satisfies current chapter prerequisites and the shared three-active-challenge limit. `reason` is null when available; otherwise it is `introductory_diagnostic`, `chapter_locked`, `required_levels_incomplete`, `diagnostic_incomplete` or `active_challenge_limit`. Chapter prerequisites take precedence over the active limit. Existing `early_entry_available` identifies chapters supporting entry bosses; use `entry_boss.available` for whether a new attempt can start now.
- `active_learning_runs`: owned active diagnostic, practice, bonus and assessment references, each with `run_id`, `purpose` and nullable `level_id`. Completed runs and delayed reviews are excluded. Use the owned learning-run detail endpoint to resume pinned content.

Boss resume IDs include all owned active attempts for that chapter and purpose, ordered by creation time then ID. Daily/practice attempts count toward the shared limit but are not boss resume IDs. A blocked fresh start does not prevent resuming an existing attempt. Learning references retain creation order. Resume endpoints still enforce pinned-version and publication checks; these lists do not certify that saved content remains accessible. Refresh the overview after mutations; command endpoints remain authoritative if state changes between reading and acting.

Star counts use the same saved progress and run summaries as the map. Boss wins do not create stars or learning mastery. The overview exposes no answer keys, scenario seeds, future observations or opponent portfolios. Production publication checks remain in force. These additions require no migration and do not change saved command responses or progression rules.

## Game journey guidance

`GET /api/me/workflow` retains its learning `next_action` and `resume` fields and
adds the typed `game_next_action`. The game recommendation first resumes an owned
active diagnostic, required practice or structured assessment run. Otherwise it
follows accessible chapters in order: introductory diagnostic, required levels,
structured module check, then the chapter's exit boss before recommending the
next chapter. Each learning action identifies its module and, when applicable,
level or run. A learning resume uses `kind: resume_learning` and includes the run's
purpose. Existing learning progression and mode access gates are unchanged;
guidance does not make an exit boss a prerequisite for an already available
learning action.

A `kind: chapter_exit_boss` action identifies the module and recommends `start`,
`resume` or `retry`. `attempt_id` identifies an owned active attempt for resumption;
`previous_attempt_id` identifies the latest ended attempt when retrying. A failed
or abandoned boss stays in the journey. A recorded exit victory advances the
recommendation after the chapter's structured learning requirements are also
complete. When the three-active-challenge limit blocks a fresh start, `available`
is false, `reason` is `active_challenge_limit`, and `blocking_attempt_ids` lists the
owned active challenges. The cap never prevents recommending an existing boss's
resumption. Daily and practice attempts count toward this cap.

Optional bonus and delayed-review runs remain available through the existing
learning workflow and review APIs; they do not replace the game's required
chapter recommendation. In particular, `resume` may identify a bonus or review
while `game_next_action` recommends the next required chapter activity. Due
reviews also remain reflected in `profile.due_review_count`. A null game action
means no unfinished accessible chapter activity was found in the current catalog,
not that optional stars, reviews or all game modes have been completed. Retired
catalog chapters are not recommended. Resume and mutation routes remain
authoritative for saved-content compatibility and publication approval.

The workflow and curriculum `practice_eligibility` retain `multiplayer` as the
existing modules 1–9 eligibility flag. New `private_multiplayer` and `public_ranked`
flags distinguish the actual private modules 1–4 and public modules 1–9 structured
check gates. Each has `*_prerequisite_module_ids` and `*_missing_module_ids` lists.
An incomplete catalog cannot unlock either mode. Boss-earned chapter access does
not satisfy these checks. This read guidance supplies no additional XP, stars,
currency, rating or mastery and requires no database migration.

## Boss and daily policies

Start a boss with `POST /api/challenges`, `mode: chapter_entry` or `chapter_exit`, and `module_id`. Chapter 1 uses its existing introductory diagnostic instead of an entry boss. An entry victory unlocks that chapter without marking earlier modules mastered. Required lessons remain sequential and canonical diagnostics remain mandatory. An exit boss requires chapter access, its diagnostic and every required level. Victory unlocks the next chapter; the separate structured exit check still determines learning mastery. Completion, unlocks, rewards and the replay receipt commit together.

Boss parameters are persisted once per catalog edition, chapter and purpose. Opponents increase from one to three across the ten chapters; market families cycle through sideways, volatile, rising and falling. All use the existing foundation engine, written order plans, friction, a 25% concentration cap and 30 observations. Entry and exit forms have the same market family and opponent count, with separately pinned seeds. They are game assessments: their title and chapter association do not establish concept-specific grading, calibrated difficulty, equivalent pre/post forms or advanced-product execution. Those remain content and evaluation work. A no-order decision can win when it outperforms the opponents; profit does not establish learning.

`mode: daily` selects one server-owned form for the UTC date, shared across profiles with one opponent. Clients cannot choose its seed, market family, chapter or opponent count. A profile may have only one active daily attempt, including an unfinished older date. Resume or abandon it before starting another. Loss or abandonment invokes the economy cooldown; a paid refresh is consumed only by a successfully committed fresh start and is linked to that attempt's private research record. Exact replay does not consume a second refresh. A previous date's form cannot earn today's victory Stocks.

Earned chapter access also permits that chapter's existing constrained lesson-bound simulation after its earlier learning steps. It does not unlock general guided or endless simulation.

Daily and boss completions use the versioned [economy policy](economy.md). Game XP contributes to player level while learning XP, learning activity and learning mastery remain distinct. Hidden scenario parameters, future prices and unfinished opponent portfolios stay private. Production continues requiring independently approved content; committed commands retain their original response.
