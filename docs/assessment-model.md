# Assessment model

The current implementation checks understanding of authored questions. It does not establish real-world investment suitability, trading competence or profitability.

## Implemented learning rules

Lessons unlock sequentially within a module. All required lessons must pass before its five-question check; earlier module checks gate later modules. A lesson or delayed review requires every question correct. A module check requires at least four of five correct and every critical risk item correct. Critical errors cannot be averaged away by unrelated answers. These thresholds are product rules awaiting evaluation.

The server grades submissions and persists attempts, selected answers, feedback and reflection. Confidence is optional, recorded as an integer from 0 to 100, and does not change pass/fail. Reflection is required by the submission contract but is recorded rather than semantically assessed; a length check does not demonstrate a thoughtful reflection. Retries are allowed, with specific explanations after submission. Rewards occur once per learning event, not once per request or attempt.

A passed lesson schedules a check after 24 hours. This release reuses its two practice questions. A failed delayed review is due again after another 24 hours. That is retrieval practice with a familiar question bank, not an independent retention or transfer test. The separate delayed-review prompt in the catalog is teaching copy, not a second scored question bank. Module checks are distinct from practice questions but overlap in concepts and some familiar arithmetic patterns; passing after feedback may include memorization.

The API’s `mastered` field means the current module-check rule was met. Product copy should say **module check passed** and show the rule; avoid interpreting this storage label as an independently validated mastery certification. Delayed review and unfamiliar application are additional evidence, and currently do not determine module unlocking.

## Proposed evaluation components

A later competence assessment should retain separate evidence for risk recognition, exposure and order reasoning, plan quality, adherence, reflection and transfer. An unsuitable trade avoided with a reason must count as a valid decision. Do not collapse all of these into a virtual-profit score. Human-reviewed rubrics and unseen scenario variants are not implemented by this content release.

Optional confidence can support probability-accuracy analysis. For an answer submitted at probability `p = confidence / 100`, define `y = 1` when correct and `0` otherwise; mean `(p − y)²` is the binary Brier score, ranging from 0 to 1, with lower better. For example, confidence 0.8 gives 0.04 when correct and 0.64 when wrong. This score reflects more than calibration alone; reliability, resolution and outcome uncertainty contribute. See [Siegert’s methods paper, equations 1–3](https://arxiv.org/html/1303.6182v2).

The current grading endpoint reports a descriptive mean Brier score and confidence sample count for that attempt only. It does not aggregate a long-term calibration estimate. Evaluation should use comparable first-attempt questions and disclose sample counts, missing confidence and difficulty differences. Do not mix retry answers whose solutions have already been shown with unseen responses. Confidence about a quiz answer is not a market forecast. Small samples cannot support a stable calibration claim, and confidence never substitutes for correct critical-risk reasoning.
