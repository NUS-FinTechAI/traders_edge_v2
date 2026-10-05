---
name: add-badge-or-reward
description: Add or revise a learning badge, cosmetic unlock or XP rule without rewarding trading activity or unverified competence.
---

# Add Badge Or Reward

All repository paths below are relative to the repository root.

Read `docs/gamification-and-safety.md`, `server/app/progression.py` and the current reward routes/models if present. Existing XP uses unique learner/event keys. Follow the current reward schema; if the requested badge has no runtime contract, define and test that contract in the same scoped change before claiming the badge exists.

1. Name the observable learning event and its server evidence. Completion, correct critical-risk reasoning and a passed delayed check are eligible; profit, volume, order count and leverage are not.
2. State exactly what the reward means. A stored reflection or minimum text length cannot justify a badge claiming thoughtful reflection or mastery.
3. Award once through authoritative persisted state. Test request replay, repeated completion, concurrent submissions, failed checks and another learner’s record.
4. Keep optional bonus work optional. Cosmetic choices must not alter financial risk, grades or prerequisite gates. Do not add streak-loss threats or urgent prompts.
5. Update truthful learner copy and the reward documentation. Run the relevant API tests and obtain safety review. If the interface changes, include 390px evidence and check 44px targets, focus and non-color status.
