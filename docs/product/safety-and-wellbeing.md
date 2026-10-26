# Safety and wellbeing

Profit decides every match, as the [game design document](../game-design.md)
requires; the rules below keep that from turning into pressure to trade.
[ADR 0001](../decisions/0001-learning-authority-and-safety.md) and
[ADR 0004](../decisions/0004-playable-game-overhaul.md) record the decisions.
Reward amounts are in [progression](../reference/progression.md).

## Rules the code follows

| Rule                                  | Implementation                                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulated money, fictional companies  | One persistent line says so on the landing, login, profile, level, briefing and trading screens; every scenario uses invented companies                        |
| No pay for activity                   | XP, currencies and badges never depend on order count, trade count or volume; practice XP is capped at three matches a day                                     |
| Badges reward process                 | 16 earned-only badges based on stop-losses, low drawdown, waiting, right-first-time checks; none on profit size                                                |
| Profit decides matches, not learning  | Results say "Profit decides the match; your missions show what you learned"; the decision score is labelled unvalidated and never decides a win                |
| A plan for every match                | Strategy and maximum loss before trading; results compare the plan with the worst drawdown; no per-order essay                                                 |
| No pressure mechanics                 | No countdown timers ("Day N of M"), order confetti, urgent alerts, flashing prices or one-swipe execution; news in a calm feed; solo matches pause at any time |
| No leverage, shorting or copy-trading | The engine is long-only, cash only                                                                                                                             |
| Random clicking loses                 | Fees and the spread on every fill; the balance gauntlet keeps idle and random players losing bosses and dailies                                                |
| Gentle streaks                        | A missed login day restarts the streak with no penalty or warning; the daily cooldown is 2 hours and skippable only with earned Gems                           |
| No real-money purchases               | Gems are earned in ranked play and player level-up claims and never sold                                                                                       |
| Opt-in leaderboards                   | Players appear only after opting in                                                                                                                            |
| Accessible signals                    | See the [design system](design-system.md#accessibility)                                                                                                        |
| Content gate                          | Production refuses gameplay until `content/review.json` records an approved independent review                                                                 |

Do not add trade-count or volume rewards, profit-size badges, loss-chasing or
streak-loss prompts, or any claim that the app makes players profitable.

## Localization

The curriculum is jurisdiction-neutral. Chapter 1 names real exchanges and an
index (NYSE, Nasdaq, S&P) as examples, but the core adopts no local tax rules,
account benefits, deposit protection, settlement-day counts or margin
thresholds. `$` is a display unit for simulated cash. There is no
localization-pack loader.

Before adding a regional pack, define its versioned contract and selection
behaviour in the API. Each rule needs a jurisdiction, effective date, primary
source, review date and publication status. Unknown or expired rules stay
visibly unavailable; never fall back to another jurisdiction, and never infer
a jurisdiction from language, currency or location without a product
decision. Keep local account and settlement explanations apart from generic
order and risk principles; translation alone is not legal localization. Test
unknown regions, missing translations, outdated rules, withdrawn approval and
source links, and have a reviewer with jurisdictional knowledge approve the
pack.

## Not established

- Independent financial and pedagogical review of the chapters, scenarios and
  quiz bank. Until it is recorded, production refuses gameplay.
- Any measured effect on understanding or behaviour. Profit in a synthetic
  market does not show real-world skill.
