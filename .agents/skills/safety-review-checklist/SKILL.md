---
name: safety-review-checklist
description: Review Trader’s Edge financial copy, rewards, learning gates or simulated actions for product safety and misleading claims.
---

# Safety Review Checklist

All repository paths below are relative to the repository root.

Read the changed behavior and `docs/source/traders-edge-supervisor-summary.md`; use `docs/gamification-and-safety.md` and `docs/assessment-model.md` for implemented limits.

Trace one successful and one rejected path through the server, not just the interface. Check that each simulated order requires a prior plan, later modes enforce prerequisites, future observations stay private and another learner’s data is inaccessible. Distinguish a planned loss from a guaranteed maximum.

Inspect reward inputs: no profit, trade-count or volume awards, default leverage, loss-chasing prompts, urgency, order celebrations or copy-trading. Treat reasoned abstention as valid. Check that single answers, XP, stored reflections and tiny confidence samples are not presented as validated competence.

For changed factual claims, read primary sources, check arithmetic and scope, and identify local legal rules requiring localization. Record a concrete finding with trigger, consequence and affected location; block material failures until fixed and retested. Separate observed defects from future suggestions. Do not label an entire product safe because a narrow diff passed.
