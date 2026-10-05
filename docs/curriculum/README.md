# Curriculum content and module teaching contract

## Current implementation and target

The runtime source is [`catalog.json`](../../server/app/content/catalog.json), loaded by `app.content.catalog.load_catalog()`. It contains all ten modules in the [research brief](../source/traders-edge-supervisor-summary.md)'s order: **30 lessons, 60 practice questions, 50 module-check questions and 26 archive definitions**. Each lesson has an objective, source IDs, prerequisites, a solved example and all nine learning-cycle prompts. Module 10 is optional and follows the first nine modules.

Status: **authored, awaiting independent financial-accuracy review**. Source reading and contract tests do not constitute that independent review. No entry is approved for production publication. Numbers in exercises are fictional and currency-neutral, not personal allocation or trading recommendations. Source scope and jurisdiction exclusions remain those in the [source register](sources.md).

The merged backend implements edition `2026-10-04.4`, schema 1: **30 entry choices, 97 required steps (including one simulation), 30 optional bonus tasks and 50 preserved exit items**. Each module has three sequential levels. Canonical `entry_tasks`, lesson `tasks` and `bonus_tasks` use the [learning-run API](../../server/README.md#interactive-learning-runs), without generic essays. Instructions, choices and classifications do not execute trades. Only `m05-l01` adds a final graded simulation audit after knowledge cards, using the existing engine and pinned binding in `simulation/bindings.py`; see the [bound contract](../../server/README.md#bound-m05-l01-simulation). Every actual order still needs a written plan, but no order is required in this no-thesis educational case. Neither plan text nor reflection length is semantically graded. The 60 legacy practice questions also supply canonical stepwise delayed-review runs: first answers freeze, feedback is withheld until completion, passing requires all correct and failure reschedules by the pinned interval. These familiar questions are not unseen transfer forms. The richer tasks below remain proposals, not a complete v1 scenario/tutorial port.

A generic simulation backend **already exists** in `server/app/simulation/engine.py` and `api.py`: seeded synthetic paths, quotes, market/limit/stop orders, fills, friction, persisted sessions and a written plan with each order. Guided access requires the first four module checks; endless access requires the first nine. Module 9's missing piece is **lesson-to-scenario/mission binding and verified assessment**, not the absence of a simulator. Generic engine support does not establish the proposed per-lesson tool unlocks, scenario provenance review, settlement realism, advanced products or pedagogical effectiveness.

**Delivery priority:** complete the v1 migration dispositions and their curriculum, behavior, scenario and assessment contracts before more UI polish. Use the approved session handoff with the frontend designer as a teammate: agree the action, evidence and unlock requirements here before refining presentation. This document specifies learning behavior, not a new visual direction or permission to bypass implementation/safety gates. It does not claim migration is complete.

## Shared target contract — design proposal

The full target contract and ten module sections, including additional tasks, worked examples, sample items, bonus criteria and gates, are **design proposals**, pending authoring, independent financial review and implementation beyond the decision-practice subset above. Existing `mNN-lNN` IDs identify concepts to adapt; the current subset must not be mistaken for every task specified here. Source IDs refer to the register, not proof that these game designs have been validated.

- **Entry/pre-quiz:** record the first response and optional confidence before showing module instruction, worked examples or practice feedback. Complete the diagnostic before releasing its feedback. Wrong answers never block entry to teaching; use them to select support. An explicit “not sure” response is preferable to forced guessing. Earlier module prerequisites still apply.
- **Teach through action:** short instruction → solved example → prediction → guided action → immediate explanatory feedback → retry. Fade hints on a fresh task. Reflection can be a selected error cause, an evidence comparison or a changed decision, not a compulsory essay after every question. The nine-step research cycle also includes delayed review and an exit/mastery check.
- **First four modules:** readiness sorting, role/quote reading, product comparison and allocation challenges are playable without placing orders. No buy button is needed to prove learning. Later modules progressively introduce bounded scenarios and orders after the first four checks, with tool-specific safety instruction before use.
- **Plan boundary:** every actual simulated order, including an exit or replacement order, requires a pre-written plan before submission. Capture reason/evidence, size and exposure, risk including planned loss versus stress loss, order constraint and reconsideration/exit condition. A reasoned no-trade decision is valid; it must identify a relevant constraint, not merely idle through a scenario. Routine sorting and quizzes do not require this order plan.
- **Required completion:** verify every named required task below, then require an exit score of at least 80% and all critical risk items correct. This is the current quiz rule extended as a proposed interactive gate, **not a validated mastery threshold**. A critical safety failure cannot be offset by profit or optional tasks. Required mechanical demonstrations can use a recorded ticket/fill trace; never force an unsuitable order to earn a pass.
- **Assessment isolation:** withhold hints, correctness, explanations and future paths until the diagnostic or exit form is complete. Practice feedback is immediate and retries are unlimited without reward farming. Preserve first attempts separately from attempts after hints/feedback. Parallel exit forms and delayed unseen variants are still pending authoring/review; changing numbers alone does not establish equivalent difficulty or transfer.
- **Optional completion:** a bonus is a verified additional task, with its own evidence, never note length, order count, P&L, XP or a cosmetic star. Optional tasks never block the next module. Stars/XP can report completion but do not prove learning. The older module-level bonus reflection prompts remain content-only. All 30 levels' separate `bonus_tasks` now have server-verified completion; the additional bonuses specified below are still proposals.
- **Remediation/review:** explain the specific misconception after a complete check, reopen the relevant practice task, allow a supported retry, then offer a fresh exit form. Schedule delayed review at the current 24-hour interval as a provisional product rule. A delayed failure queues targeted practice and another review, not a punishment or deletion of earlier evidence. New high-risk modes need separate readiness gates; current delayed reviews do not determine unlocks.

The [assessment model](../assessment-model.md) defines evidence separation, proposed scoring and implementation gaps. Samples below are author-facing specifications, not a complete or hidden runtime question bank; the intended answer is supplied for review.

## 1. Money Before Markets — design proposal

**Prerequisites and outcomes:** no market knowledge required. Distinguish saving, investing, trading and speculation; connect goals, essential spending, emergency needs, debt commitments and horizon to capacity for loss. Separate willingness from ability and recognize when waiting is appropriate. Adapt `m01-l01`–`m01-l03`.

**Pre-quiz:** diagnose purpose/horizon classification, willingness versus capacity, and beliefs about guaranteed recovery. Sample: “A confident learner needs all 700 units for a bill next month. Does confidence make those funds available for market risk?” Intended answer: no; the essential commitment constrains capacity. Record the baseline before showing the budget board.

**Required playable levels:**

1. **Give Money a Job** (`m01-l01`): instruct “match money to purpose and due date”; show 600 bill units separated from 100 unassigned units. Sort fictional bill, emergency, flexible-goal and speculation cards into appropriate buckets and predict a shortfall. Feedback identifies any essential money exposed; retry with different dates. Do not prescribe a universal emergency-fund amount.
2. **Willing Is Not Able** (`m01-l02`): explain willingness versus loss consequences; show a calm learner unable to fund a repair after losing 200. Match willingness and capacity labels to two characters, then change the repair deadline. Feedback points to the binding constraint rather than personality.
3. **The Waiting Decision** (`m01-l03`): teach that missing information can justify waiting; show an unknown bill and debt cost needing clarification. Select missing facts and choose proceed-to-research or wait, with a reason card. Feedback accepts justified waiting; no order is available.

**Post-quiz/exit:** assess transfer to a changed budget, quantify a shortfall, distinguish saving/investment/speculation by purpose, and reject a recovery guarantee. Sample: “A 900-unit fee allocation falls 10% before payment. What is missing and does a possible recovery solve today's bill?” Intended answer: 90 units; no. Protecting essential needs and rejecting guarantees are critical. Required: correct constraint-based sorting and no-trade reasoning plus the shared exit gate.

**Bonus, retries and unlock:** optional **Deadline Detective** verifies both changed allocations when two deadlines move; the system checks destinations and selected constraints, not prose length. Remediate capacity errors with the repair comparison; delayed review uses an unseen irregular-income/essential-bill case. Passing unlocks Module 2, not orders; bonus failure has no gate effect.

**Adaptation basis:** `sec-start`, `sec-horizon`, `finra-risk`. No v1 level or quiz has Module 1 as its primary migration target; readiness, debt/emergency sorting and capacity tasks need new content. V1 `module-1.1`, tutorial `trader-edge-basics` and ownership items `m1-pre-1`/`m1-post-1` belong primarily to Module 3. Only their gentle interface-orientation pattern may be reused here, without importing trading actions or presenting those ownership questions as readiness diagnostics. See evidence key below: S `8–91,4799–4844`; T `524–603`.

## 2. How Markets Work — design proposal

**Prerequisites and outcomes:** Module 1 check passed. Distinguish asset, issuer, broker and venue; interpret quote sides, spread, quantity, timestamps and candle summaries without treating price displays as execution promises. Adapt `m02-l01`–`m02-l03`; no orders.

**Pre-quiz:** diagnose role confusion, bid/ask direction and liquidity assumptions. Sample: “Bid 19.80, ask 20.00: which side is the displayed offer to a buyer?” Intended answer: ask; it is not a guarantee for arbitrary size or time.

**Required playable levels:**

1. **Follow the Roles** (`m02-l01`): explain issuer/asset versus intermediary/venue; show a share issued by a company and an instruction routed through a broker. Arrange role cards along that path. Feedback distinguishes routing from ownership and protection from investment guarantees.
2. **Read Both Sides** (`m02-l02`): teach ask minus bid; work 20.00 − 19.80 = 0.20. Mark the two quote sides, compute spread and inspect timestamp/quantity. A small candle inspection contrasts interval high/low with current bid/ask. Feedback corrects the precise field, not just a red total.
3. **The Thin Shelf** (`m02-l03`): explain finite displayed depth; show five units at 12 and five at 12.50. Allocate a hypothetical ten-unit request across quote rows without sending an order and predict the cost. Feedback shows 122.50 total and why “all at 12” was unsupported; retry with changed depth.

**Post-quiz/exit:** apply role distinctions to a different route, calculate a spread from a fresh quote, and detect stale/insufficient depth. Sample: “Ask 8.10 has three units; a card asks for eight. Can all eight be assumed available at 8.10?” Intended answer: no. Quote-size/time guarantees are critical errors. Required: route, quote and depth tasks plus exit gate.

**Bonus, retries and unlock:** **Quote Audit** verifies identification of both stale timestamp and insufficient size in an extra snapshot. Remediate side inversion with labeled buyer/seller cards; delayed review compares unseen liquid/thin books. Passing unlocks Module 3; quote inspection does not unlock execution.

**Adaptation basis:** `finra-stocks`, `sec-execution`, `sec-spread`, `finra-risk`. Primary v1 level targets here are `module-1.2` and `module-3.1`, with tutorials `candlestick-chart-basics` and `bid-ask-spread-basics`. Adapt `MOD1_PRE/POST` candle items `m1-pre-2`/`m1-post-2` and `MOD3_PRE/POST` spread items `m3-pre-1`/`m3-post-1`. Role/routing teaching needs new content; `module-1.1` remains primarily in Module 3, not a second migrated level here. Remove click-through-as-understanding. S `8–556,4821–4844,4881–4907`; T `605–641,741–773`.

## 3. Investment Products — design proposal

**Prerequisites and outcomes:** Modules 1–2 passed. Compare stocks, bonds, mutual funds and ETFs by return source, obligations, holdings, costs and risks; avoid treating a product label or dividend as a guarantee. Adapt `m03-l01`–`m03-l03`; comparison cards, not orders.

**Pre-quiz:** diagnose ownership versus lending, guaranteed-income beliefs and fund-label diversification. Sample: “A share pays a dividend: can its total return still be negative?” Intended answer: yes, price loss and costs can outweigh it.

**Required playable levels:**

1. **Where Returns Come From** (`m03-l01`): explain price change plus distributions; work a share from 40 to 38 with a dividend of 1, a −1 change before costs/tax. Assemble the return components and identify uncertain ones. Feedback separates distributions from profit guarantees.
2. **A Promise With Risks** (`m03-l02`): distinguish promised payment from ability to pay and resale price; show a bond promising 100 but quoted at 94 before maturity. Match default, rate and inflation event cards to the affected risk. Feedback explains why “bond” does not mean “cannot lose.”
3. **Look Inside the Wrapper** (`m03-l03`): teach pooled holdings and ongoing versus transaction costs; work 0.50% of an unchanged 1,000 as about 5 for a year. Inspect two overlapping funds and an ETF quote, label holdings/fee/spread, then select what more is needed for comparison. Feedback reveals hidden overlap and structure differences, not a preferred product.

**Post-quiz/exit:** combine price/distribution arithmetic, distinguish bond resale/default risk, and compare unfamiliar fund costs/holdings. Sample: “Two funds both hold mostly the same sector. Does buying both establish broad diversification?” Intended answer: no; inspect combined exposures. Guarantee rejection and risk identification are critical. Required: return assembly, risk matching and wrapper comparison plus exit gate.

**Bonus, retries and unlock:** **Cost Detective** verifies two separate cost categories and overlapping holdings in a third fact sheet. Remediate with a component-by-component return or risk replay; delayed review uses a different issuer and fund structure. Passing unlocks Module 4, not product execution.

**Adaptation basis:** `finra-stocks`, `finra-bonds`, `finra-funds`, `sec-fees`, `sec-etf`. Primary v1 target `module-1.1`, tutorials `trader-edge-basics`/`gen_tut`, and quiz items `m1-pre-1`/`m1-post-1` supply ownership and uncertain-return concepts; keep only suitable orientation steps, not trading-first actions. `module-1.4` and `m1-pre-4`/`m1-post-4` belong primarily to Module 6; `module-5.2`/`fundamentals-basics` belong primarily to Module 7. The return-component and product-fact-sheet tasks here are newly authored proposals, not additional primary ports of those assets. Bonds, funds and ETF comparisons require new content. S `8–556,4821–4844`; T `77–146,524–603`.

## 4. Building a Portfolio — design proposal

**Prerequisites and outcomes:** Modules 1–3 passed. Link allocation to a goal, total direct and indirect exposures, distinguish diversification from ticker count, recognize drift and choose an appropriate benchmark. Adapt `m04-l01`–`m04-l03`; allocations are hypothetical, not executable tickets.

**Pre-quiz:** diagnose percentage arithmetic, concentration and benchmark beliefs. Sample: “Five tickers share one sector. Is ticker count alone evidence of diversification?” Intended answer: no, shared exposures matter.

**Required playable levels:**

1. **Allocate Around a Purpose** (`m04-l01`): teach weights sum to the whole; show fictional 500/300/200 in a 1,000 total as 50/30/20, not advice. Allocate tokens against a supplied goal and essential-cash constraint. Feedback checks arithmetic and constraints while allowing multiple defensible mixes.
2. **Count Exposures, Not Labels** (`m04-l02`): explain look-through holdings; show 200 direct plus 100 indirect in company A as 30% of 1,000. Uncover fund cards and combine company/sector weights. Feedback flags overlap and co-movement risk; no claim that low past correlation guarantees protection.
3. **Drift and a Fair Comparison** (`m04-l03`): show 50/50 becoming 600/400, or 60/40. Move allocation tokens to a supplied target, account for a stated cost, and select a comparable passive benchmark. Feedback contrasts restoring a constraint with chasing a winner; staying put can be valid within the stated band.

**Post-quiz/exit:** assess a new goal-constrained allocation, look-through concentration, drift response and fair comparison. Sample: “In an 800 total, 160 direct and 80 indirect belong to one issuer. What is its weight?” Intended answer: 30%, not 20%. Ignoring essential needs or hidden concentration is critical. Required: constraint-satisfying allocation, exposure calculation and benchmark/drift tasks plus exit gate; no universal recommended mix.

**Bonus, retries and unlock:** **Overlap Stress Test** verifies recognition of a shared risk in an extra fund and a revised allocation satisfying the supplied constraints. Remediate using expanded holding tiles; delayed review changes portfolio total and overlap. Passing completes foundations and permits Module 5's guided execution instruction; optional bonus is not needed for that unlock.

**Adaptation basis:** `finra-allocation`, `sec-horizon`, `finra-concentration`, `finra-sentiment`, `sec-fees`. Primary v1 targets here are `module-5.1`, `module-5.3`, `module-5.5`, `module-5.6`, `module-5.7`; tutorials `portfolio-allocation-basics`, `sector-exposure-basics`, `correlation-basics`, `rebalancing-basics`, `benchmark-basics`. Adapt `MOD5_PRE` items `m5-pre-1`, `m5-pre-2`, `m5-pre-3`, `m5-pre-6`, `m5-pre-7`, `m5-pre-8` and `MOD5_POST` items `m5-post-1`, `m5-post-2`, `m5-post-3`, `m5-post-7`, `m5-post-8` for concentration, correlation, policy-based rebalancing and benchmark reasoning; remove timing/outperformance requirements. **Reject `m5-post-4`**, whose tick-42/eight-tick deadline is engine trivia. Its replacement objective is newly authored in **Drift and a Fair Comparison**: judge drift against a precommitted policy and transaction costs, then justify rebalance or hold; do not port the old item or its grading. `module-5.5` likewise loses urgent rotation deadlines. Later Module 9 reuse does not change these primary targets. S `8–556,831–941,4965–5013`; T `238–274,309–390`.

## 5. Safe Execution — design proposal

Implemented exception: `m05-l01` now ends with the [bound simulation audit](../../server/README.md#bound-m05-l01-simulation). It restricts optional NORTH buy limits, verifies observed facts and supports a verified no-order reason; it does not implement all ticket/stop/settlement activities proposed below. Other lesson bindings remain pending.

**Prerequisites and outcomes:** first four modules passed. Choose market versus limit constraints, distinguish stop trigger from guaranteed price, read partial/unfilled states, calculate friction and distinguish fills from settlement. Adapt `m05-l01`–`m05-l03`. Introduce tools one at a time, not all order types merely because generic guided simulation is accessible.

**Pre-quiz:** diagnose price/execution certainty, stop-loss guarantees and fee awareness. Sample: “A buy limit of 25 faces an ask of 25.50. Must it fill?” Intended answer: no; the limit constrains price, not execution.

**Required playable levels:**

1. **Constraint Before Ticket** (`m05-l01`): explain market price uncertainty versus a limit's non-fill risk; work a maximum purchase price of 25. Select the matching ticket, predict its state, write a plan and optionally submit within a bounded scenario. Compare the returned open/partial/filled state with the prediction. Feedback treats a justified unfilled order or no-trade choice as valid, not failure.
2. **A Trigger Is Not a Floor** (`m05-l02`): explain stop-market activation and stop-limit non-fill risk; show a 48 stop with the next available market at 44. Step through a recorded gap, mark trigger/fill separately and select the remaining risk. Feedback exposes the intended-versus-realized loss gap. Stop-limit comparison is a proposed lesson task, not a claim that the current engine supports that order type.
3. **The Full Receipt** (`m05-l03`): teach spread, slippage, fee and settlement distinctions; work ten units at 20.10 plus 2 fee = 203 cash cost versus a 20 reference. Reconcile a partial-fill receipt and mark unsettled versus withdrawable funds under explicitly supplied rules. Feedback separates reference-price slippage from additional fees, avoiding double counting. Current engine settlement is simplified educational accounting; realistic settlement needs a new contract.

**Post-quiz/exit:** apply a new price constraint, interpret gap/non-fill/partial-fill risk, and reconcile an unfamiliar receipt. Sample: “A stop at 18 triggers into bids near 15. Is loss capped by 18?” Intended answer: no. Guaranteed-fill/stop-floor claims and an order without a prior plan are critical. Required: ticket choice, gap trace and receipt reconciliation plus exit gate, not a minimum trade count.

**Bonus, retries and unlock:** **Non-Fill Is a Result** verifies preserving a price constraint and selecting the correct reconsideration condition on an extra thin-book trace. Remediate using side-by-side trigger/fill timelines; delayed review uses an unseen gap and fee schedule. Passing unlocks Module 6's exposure scenarios; submitting orders alone earns no bonus.

**Adaptation basis:** `sec-orders`, `sec-execution`, `sec-fees`, `sec-settlement`. Adapt v1 `module-1.3`, `module-3.2`, `module-3.3`, `module-3.4`; tutorials `market-order-basics`, `limit-order-basics`, `stop-loss-basics`, `stop-limit-basics`; `MOD1_PRE/POST` item 3 and `MOD3_PRE/POST` items 2–4. Rewrite “immediate at displayed price,” stop guarantees and use-order-type missions. S `8–556,946–2353,4827–4841,4884–4916`; T `643–739,776–1132`.

## 6. Managing Risk — design proposal

**Prerequisites and outcomes:** Modules 1–5 passed. Calculate cash exposure and planned versus stress loss, interpret peak-to-trough drawdown/recovery, and reject payoff ratios without probability and costs. Adapt `m06-l01`–`m06-l03`; bounded sizing and adverse-path scenarios, no leverage.

**Pre-quiz:** diagnose exposure arithmetic, stop-based loss certainty and equal-loss/equal-recovery beliefs. Sample: “A portfolio falls from 100 to 80. Does a 20% gain restore it?” Intended answer: no; it reaches 96.

**Required playable levels:**

1. **Size Before Surprise** (`m06-l01`): teach quantity × price and separate stress assumptions; work ten at 20 = 200 exposed, an intended exit at 18 loses 20 before costs but a gap to 15 loses 50. Set quantity against a supplied stress budget or choose no trade. Feedback compares the learner's arithmetic with the scenario assumptions; any actual order needs its own plan.
2. **The Drawdown Trail** (`m06-l02`): explain peak-to-trough measurement; work 100 → 80 as 20% down, requiring 25% recovery. Mark peaks/troughs on a replay and choose a response when a plan's risk boundary is threatened. Feedback retains the worst decline even after recovery, rather than scoring final wealth.
3. **The Ratio Trap** (`m06-l03`): explain payoff ratios need probabilities and costs; show a hypothetical 30 gain/10 loss with unknown likelihood cannot establish an attractive decision. Compare supplied outcome cards, include fees and identify missing probabilities. Feedback rewards identifying uncertainty rather than choosing the largest headline payoff.

**Post-quiz/exit:** size under changed stress/cost assumptions, calculate drawdown/recovery and critique a payoff-only claim. Sample: “Twelve units entered at 25 gap to 20, with 3 total fees. Is a 40-unit stress budget satisfied?” Intended answer: no; loss is 63. Treating the stop as guaranteed or knowingly violating the stated risk budget is critical. Required: stress-sizing, path and probability tasks plus exit gate.

**Bonus, retries and unlock:** **Stress Budget Check** verifies a smaller feasible size under a second gap/fee case, or correctly identifies that no positive size meets supplied constraints. Remediate units-versus-percent errors with an exposure grid; delayed review uses a new sequence with recovery then a lower trough. Passing unlocks Module 7's evidence scenarios, not leverage.

**Adaptation basis:** `finra-risk`, `sec-orders`, `sec-fees`, `drawdown-paper`. Primary v1 level targets here are `module-1.4` and `module-5.4`, with tutorials `drawdown-basics` and `beta-volatility-basics`. Adapt cost-adjusted arithmetic items `m1-pre-4`/`m1-post-4`, risk items `m4-pre-3`, `m4-pre-4`, `m4-post-3`, and beta/volatility items `m5-pre-4`, `m5-pre-5`, `m5-post-5`. Replace buy-low/sell-high and profit thresholds with stress-budget reasoning. Stop-gap concepts from `module-3.3` may be reused after Module 5, their primary target; `module-4.5` remains an integrated scenario primarily in Module 9. Neither is a second primary level migration here. Beta is context for reviewed teaching, not a substitute for stress loss. S `8–556,946–2353,4830–4844,4929–5013`; T `212–235,328–345`.

## 7. Making Decisions — design proposal

**Prerequisites and outcomes:** Modules 1–6 passed. Separate observations, assumptions and falsifiable theses; evaluate provenance, dates and incentives; use analytical tools probabilistically and interpret confidence. Adapt `m07-l01`–`m07-l03`.

**Pre-quiz:** diagnose evidence/source distinctions, confirmation bias and certainty language. Sample: “A popular post says an earnings beat guarantees a rise. What is missing?” Intended answer: verifiable evidence, expectations/context and uncertainty; popularity supplies none of these.

**Required playable levels:**

1. **Build a Testable View** (`m07-l01`): teach observation versus inference; show a reported revenue change as an observation and future growth as a claim. Sort statement cards, connect a thesis to a disconfirming condition and predict more than one plausible response. Feedback rejects hindsight certainty without dictating a trade direction.
2. **The Evidence Desk** (`m07-l02`): teach date, primary source and incentive checks; compare a dated issuer disclosure with a stale sponsored repost. Select the stronger evidence, flag what remains unknown, then update or withhold a scenario decision. Feedback reveals provenance after the practice choice and contrasts plausible interpretations of the same evidence. MA/EMA overlays and technical-strategy tasks remain deferred to optional Module 10; they are not tools introduced by this evidence lesson.
3. **Confidence Under Uncertainty** (`m07-l03`): explain that 70% is not certainty; work seven successes in a fictional ten-case illustration without promising the next outcome. Assign probabilities to supplied binary outcomes, inspect the completed record and revise a confidence category. Feedback separates one lucky result from repeated evidence; a small sample cannot certify calibration.

**Post-quiz/exit:** choose evidence in a new conflicting-source case, supply a falsifier via structured selection, and interpret uncertainty without a guaranteed signal. Sample: “A fresh filing contradicts a promotional claim. Which should change: the documented assumption, or the filing's facts to fit the claim?” Intended answer: reconsider the assumption/thesis. Reliance on guaranteed signals or unverified promotional certainty is critical. Required: sorting, evidence and probability tasks plus exit gate.

**Bonus, retries and unlock:** **Find the Counterexample** verifies selection of two genuinely disconfirming evidence cards, not a longer thesis. Remediate source confusion with provenance chains; delayed review uses a new claim, source and price outcome. Passing unlocks Module 8's protection scenarios. Optional simulated action is allowed only with an order plan; reasoned abstention is equally valid.

**Adaptation basis:** `sec-research`, `finra-sentiment`, `sec-fraud`, `finra-risk`, `brier-paper`. Primary v1 targets here are `module-2.1`–`module-2.3`, `module-4.1`, `module-4.2`, `module-5.2`; tutorials `news-feed-basics`, `interest-rate-basics`, `inflation-basics`, `fundamentals-basics`. Adapt `MOD2_PRE/POST` items 1–3, `m4-pre-1`, `m4-pre-2`, `m4-post-1`, and `m5-post-6` for news, expectations and testing rather than trusting defensive labels. Rewrite directional certainty, unsupported outperformance claims and duplicated items. `module-4.3`/`module-4.4` are primarily Module 9 integrated applications, not primary ports here. `module-2.4`/`module-2.5`, their MA/EMA tutorials and `MOD2_PRE/POST` items 4–6 remain deferred to Module 10; evidence/uncertainty teaching here does not unlock technical overlays. S `8–556,2875–4771,4845–4853,4863–4871,4929–4949,5004–5006`; T `148–210,276–306`. Probability activities require new banks, not imported forecasting claims.

## 8. Psychology and Protection — design proposal

**Prerequisites and outcomes:** Modules 1–7 passed. Identify outcome/confirmation bias and loss chasing; recognize incentives, impersonation, manipulation and fraud warnings; choose independent verification or refusal. Adapt `m08-l01`–`m08-l03`.

**Pre-quiz:** diagnose “profit proves good reasoning,” authority/social-proof trust and urgency responses. Sample: “A paid promoter has a large following. Does that verify a guaranteed-return offer?” Intended answer: no; incentive and guarantee warnings remain.

**Required playable levels:**

1. **Judge the Decision, Not the Prize** (`m08-l01`): explain outcome bias; show an unplanned oversized decision winning while a risk-limited decision loses. Match process judgments to the original records with outcomes initially hidden, then compare after reveal. Feedback highlights changed judgments caused solely by results.
2. **Who Benefits?** (`m08-l02`): explain promotional incentives; show a sponsored post with compensation disclosure. Tag claim, incentive and missing evidence, then choose verify/wait/refuse. Feedback distinguishes a disclosed conflict from proof of fraud, and popularity from verification.
3. **The Verification Route** (`m08-l03`): teach independent official-channel checking; show an impersonator offering “no risk” through a supplied link. Route the case through pause, independently located official source and appropriate local reporting help. Feedback shows why the message's own link is not independent. No real personal or account data is requested.

**Post-quiz/exit:** judge an unfamiliar decision without outcome bias, identify a conflict, and triage a different scam pattern. Sample: “An urgent message claiming to be a regulator asks for a transfer to release profits. Use its link or independently locate official contact information?” Intended answer: do not transfer; verify independently. Unsafe credential/payment routing and guaranteed-return acceptance are critical. Required: process comparison, conflict tagging and verification path plus exit gate.

**Bonus, retries and unlock:** **Impersonation Variant** verifies two warning signs and the independent verification route in a new channel. Remediate by contrasting source identity with message appearance; delayed review uses a less obvious impersonation without familiar wording. Passing unlocks integrated Module 9. No promotional-link visit, real payment or trade is required to complete protection missions.

**Adaptation basis:** `finra-sentiment`, `finra-risk`, `cnmv-bias`, `sec-fraud`. No whole v1 level has Module 8 as its primary target. The adapted question `m4-pre-6` in `MOD4_PRE` supplies alternating-headline/whipsaw context for recognizing chasing pressure (S `4944–4946`), not sufficient fraud education. Conflicting-news context from `module-4.3`/`module-4.4` and the `news-feed-basics` interaction pattern may be reused for new bias tasks; the levels remain primarily in Module 9. `m2-pre-6`/`m2-post-6` ask about EMA turning behavior, not whipsaw protection, and remain deferred with `module-2.5` to Module 10. Bias/scam diagnostics and verification missions require new content. Do not import multiplayer fake-news injection as a rewarded learner behavior. S `8–556,2875–4771,4860–4862,4878–4880,4944–4946`; T `148–158`.

## 9. Integrated Simulation — design proposal

**Prerequisites and outcomes:** Modules 1–8 passed. Integrate suitability-to-the-fictional-brief, exposure, evidence, execution, plan adherence and review across rising, falling, sideways and volatile conditions. Adapt `m09-l01`–`m09-l03`. Bind lessons to the existing generic backend; do not represent generic sessions as verified module completion.

**Pre-quiz:** diagnose plan completeness, order-versus-fill reasoning, hindsight and process/outcome separation. Sample: “A limit ticket was submitted but remains open. May the review count it as a filled holding?” Intended answer: no; review actual fills and remaining exposure.

**Required playable levels:**

1. **Plan Before the Reveal** (`m09-l01`): explain immutable pre-decision evidence; work a plan with thesis, falsifier, size, stress loss and price constraint alongside a justified no-trade example. Commit a structured written plan before each actual order, or record the constraint behind no trade. Feedback checks completeness and constraint consistency; text length alone cannot validate reasoning.
2. **Reconcile the Tape** (`m09-l02`): teach submitted/partial/filled/cancelled distinctions; show ten requested units with four filled and six still open. Match fills, cash changes, costs and remaining orders to the original plan. Feedback identifies discrepancies, including a limit preserved at the cost of non-fill. Replay or a provided trace supports a learner who appropriately chose no trade.
3. **One Process, Different Paths** (`m09-l03`): explain why a sound decision can lose; work two equal plans with different synthetic outcomes. Complete a scenario set spanning all four regimes, compare each path with the same-period appropriate passive benchmark, then classify adherence, execution surprise and one corrective action. Feedback shows pathwise exposure and plan deviations, not a profit grade; the learner need not trade on every path.

**Post-quiz/exit:** use a held-out scenario to assess plan/risk consistency, reconciliation, adherence and evidence-based correction. Sample: “Your plan forbids exceeding 20% exposure; a winning action reached 35%. Does profit remove the breach?” Intended answer: no. An order without its prior plan, knowingly violating risk constraints or falsifying fill history is critical. Required: plan/no-trade record, reconciliation and four-regime process review plus exit gate. Open-text plan quality requires a reviewed rubric or explicit structured checks; do not claim semantic grading exists.

**Bonus, retries and unlock:** **Adverse-Path Audit** verifies a missed risk and a valid corrected action on an extra scenario trace, independent of return. Remediate the specific planning, fill or adherence error with a worked trace before a fresh scenario retry. Delayed review must use an unseen seed/path after the provisional interval. Passing opens optional Module 10 and eligibility for separately gated endless/multiplayer practice; those modes do not certify competence. Current mode gates use module checks, not this proposed scenario rubric.

**Adaptation basis:** `finra-risk`, `sec-orders`, `sec-fees`, `sec-execution`, `finra-sentiment`. Primary v1 targets here are `module-4.3`–`module-4.5`, `puzzle-1.1`, `puzzle-1.2`, and question items `m4-pre-5`, `m4-post-2`, `m4-post-4`, `m4-post-5`, `m4-post-6`. Rework the associated `interest-rate-basics`, `news-feed-basics`, `drawdown-basics` and `gen_tut` steps for integrated application, not click-through completion. **Later integrated reuse only:** `module-4.1`/`module-4.2` retain Module 7 as their primary target; `module-5.5`–`module-5.7` and portfolio question objectives retain Module 4. Reuse their already-taught policy, cost and benchmark reasoning, with `rebalancing-basics`/`benchmark-basics`, without counting another primary migration. The rejected `m5-post-4` deadline item is not reused; only its newly authored policy-based replacement objective can transfer here. Crisis names are not historical provenance: source/version/license the data or label the path synthetic. Drop final-wealth, excess-return and order-count rewards. S `8–689,831–2353,2875–4771,4929–5013`; T `77–184,212–235,347–390`.

## 10. Optional Advanced Paths — design proposal

**Prerequisites and outcomes:** all nine core modules passed. A fresh retained-critical-risk check before advanced execution is proposed, but its form, rubric and lapse policy remain open; it is not an implemented gate or an additional requirement to open this module's teaching. Choosing not to continue is a successful core outcome. Distinguish leveraged obligations, short-stock risk, futures obligations and option buyer/writer asymmetry; treat active-trading tools as uncertain, not a profitability path. Adapt `m10-l01`–`m10-l03`.

**Pre-quiz:** diagnose leverage amplification, short lifecycle and rights versus obligations. Sample: “Does depositing 100 into a leveraged contract necessarily cap loss at 100?” Intended answer: no. Wrong answers open supported teaching, not immediate access to leveraged execution; no entry-score gate to the lesson itself.

**Required playable levels, only if taking this optional module:**

1. **The Borrowed Exposure Test** (`m10-l01`): teach debt remains when assets fall; show 200 assets funded by 100 equity and 100 debt, falling to 150 leaves 50 equity before costs. Manipulate the adverse-move card, calculate remaining equity and identify possible forced liquidation. Feedback separates collateral/deposit from maximum loss.
2. **Borrow, Sell, Replace** (`m10-l02`): teach short-stock obligations and potentially unlimited loss; work ten sold at 20 and replaced at 30 as a 100 loss before costs. Arrange borrow/sell/cover/return cards, calculate loss and reject the claim that rising prices are capped. Feedback explains borrow costs/recall and why an exit order cannot guarantee a loss ceiling.
3. **Rights or Obligations?** (`m10-l03`): teach futures obligations versus option rights/writer obligations; show an unexercised bought option losing its 5 premium at expiry, explicitly not a general writer-loss limit. Sort contracts, match adverse payoff diagrams and select unsuitable cases to refuse. Feedback reveals contract-specific conditions; no default leverage or automatic derivative execution.

**Post-quiz/exit:** compare loss exposure under an unfamiliar leveraged decline, complete a short close-out trace and distinguish bought-option risk from writer/futures obligations. Sample: “An unexercised bought option can expire with only its premium lost. Does that describe every option writer's maximum loss?” Intended answer: no. Deposit-as-loss-cap, capped short-stock loss and buyer/writer equivalence are critical. Required within this optional path: all three task records plus exit gate; no product trading requirement.

**Bonus, retries and unlock:** **Refuse the Mismatch** verifies the obligation and risk-capacity reason for rejecting two advanced products in new fictional briefs. Remediate with cash/debt or obligation diagrams; delayed review changes contract, quantity and adverse direction. Passing records this optional check only. Product-specific simulation remains locked until its contract, loss model, costs, localization and safety review exist; the current long-only generic engine does not implement these products. No bonus or advanced badge is required for core completion.

**Adaptation basis:** `finra-margin`, `finra-risk`, `sec-fees`, `sec-short`, `finra-futures`, `finra-options`; `finra-sentiment` supports caution about tool-based certainty, not validation of technical signals. Primary v1 targets here are the four **deferred** levels `module-2.4`, `module-2.5`, `module-3.5`, `module-3.6`; tutorials `moving-average-basics`, `exponential-moving-average-basics`, `short-selling-basics`, `short-selling-confirmation-basics`; and 14 deferred question rows: `MOD2_PRE/POST` items 4–6 plus `MOD3_PRE/POST` items 5–8. Reauthor them only after core prerequisites and review; specify periods/paths instead of claiming EMA always turns first, and replace indicator “confirmation” with counterexamples and explicit obligation/risk checks. Correct `m3-post-6`: neither buy-stop nor buy-stop-limit guarantees a squeeze-loss cap. Leverage, futures and options need new sourced content, not invented v1 equivalence. S `144–177,246–279,1530–1551,4854–4862,4872–4880,4893–4928`; T `392–522`.

**Deferred technical branch — design proposal:** **Signal Counterexamples** is an additional optional mission, not one of the 30 implemented lessons or a prerequisite for core completion. Instruct that smoothing summarizes past observations, then work three closes of 10, 12 and 14 into an MA of 12. With supplied equal-period MA/EMA calculations, the learner compares lag and false alarms across two hidden-next-step branches and chooses whether evidence warrants action or no trade. Practice feedback identifies the unsupported forecast, not the faster or more profitable indicator; retry on a new branch and later test an unseen path. Verify the calculation, counterexample and uncertainty choice, never a profitable signal or trade count. Indicator definitions, initialization, source basis and scoring still need authoring and independent review before this deferred branch unlocks.

## V1 evidence key and migration acceptance

V1 remains read-only discovery material at `/Users/maahirgarg/Downloads/traders_edge`; audited source commit `2bf6b5930858fdbb61bc388d4554d4657d9ce377`. Section citations use:

- **S:** `backend/config/database/init/02-initial_state.sql`. Level definitions `8–556`; ticker configurations `561–689`; reference portfolios `831–941`; missions `946–2353`; tools/unlocks `2358–2870`; macro/news `2875–4771`; quizzes/questions `4799–5013`.
- **T:** `frontend/src/features/tutorials/registry/tradingTutorialRegistry.ts`. The named IDs identify tutorial definitions, not proof that clicking their target teaches the concept.
- Quiz runtime: `backend/services/game_service/service/quiz_service.py:7–37,119–189`. V1 has zero passing thresholds, one allowed attempt and repeated pre/post items in Modules 1–2; all Module 3 answers use option zero. Preserve the diagnostic/follow-up idea, not those grading rules or positional cues.

Primary destinations and adapted/deferred/rejected dispositions follow the reviewed `content[].targetMappings` in the [learning inventory](../v1-audit/learning-inventory.json) and the [migration inventory's content crosswalk](../v1-audit/migration-inventory.md#content-mapping-coverage). Integrate that reviewed mapping edition alongside this contract; an older inventory without those annotations is not the primary-target authority. Whole source quizzes are split by question-level mappings, not assigned wholesale to a target module. Tutorial references can be shared interaction patterns, but do not move their owning level or authorize early technical-tool access. Rejected source items require newly authored replacement evidence, not a relabeled port.

All 27 v1 adventure level IDs and both puzzle IDs have one primary destination above. Reusing already-taught concepts in later integrated tasks does not change that destination or add another source asset. Module 1 has no adequate v1 foundation; Module 8 has partial question/context support, not a whole-level primary port. This is coverage of teaching dispositions, **not completion of all v1 migration**. The [learning audit](../v1-audit/learning-simulation.md), [learning inventory](../v1-audit/learning-inventory.json), [frontend inventory](../v1-audit/frontend-inventory.json) and [full migration inventory](../v1-audit/migration-inventory.md) remain the asset-level evidence for all 253 source files, including 89 mission keys, 64 questions, 23 tutorial definitions, scenario inputs, tools, rewards and platform behavior. Do not silently discard unmapped steps or copy unsafe behavior to make an inventory look complete.

Before further UI polish, reconcile every retained/reworked inventory item with a target contract and acceptance evidence; record dropped profit/activity incentives as intentional dispositions. Cover existing platform/session behavior as well as lessons. A copied v1 news story, static issuer ratio, seed or crisis title is not a verified financial source or licensed historical dataset. Generic tutorials such as `gen_tut` must be reduced to accessible interaction orientation, not a separate curriculum or an execution-first bypass.

## Authoring contract and verification

The current runtime contract remains unchanged by these design proposals:

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

Before publication, independently review every explanation and answer, check arithmetic and ambiguity, review source scope, and record approval against the content version. Only then can the catalog and every module and lesson change to `approved`. The service's production review gate must continue rejecting pending content. Updating content must also consider stored attempts: historical results should retain their original answer and feedback, and an ID's meaning must not silently change.

**Remaining contract work:** author independently reviewed parallel exit forms and delayed unseen tasks; extend evidence/rubrics and tool gates beyond the current choice/classification tasks and single bound audit; bind other lessons to approved scenarios with provenance, version, seed, friction and private future state; verify frontend keyboard/non-drag alternatives and feedback timing. Baseline entry banks, required/bonus task verification and interactive runs without routine mandatory essays already exist; every actual order still requires a written plan. Do not invent a second runtime schema in prose or mark these designs implemented. Independent financial approval, safety review and learning-effectiveness evaluation remain outstanding.
