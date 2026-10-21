# Rewards and safety

The game ranks every match by profit, as the
[game design document](../game-design.md) requires, and pays XP, Doubloons and
Gems under the rules in the [economy](../economy.md) page. This page lists the
safety rules those rewards and screens follow. [ADR 0004](../decisions/0004-playable-game-overhaul.md)
records the decisions behind them.

## Implemented rules

- **Simulated money, fictional companies.** One persistent line says so on the
  landing, login and profile screens. Every scenario uses invented companies
  and tickers.
- **No pay for activity.** XP, currencies and badges never depend on the
  number of orders, trade count or volume. Practice XP is capped at three
  matches a day.
- **Badges reward process.** The 16 badges are earned only (never sold) and
  are based on actions such as setting stop-losses, keeping drawdown low,
  waiting before trading or right-first-time checks, not on profit size.
- **Profit decides matches, not learning.** Results say "Profit decides the
  match; your missions show what you learned". The decision score is labelled
  unvalidated in the API and never decides a win.
- **A plan for every match.** The briefing asks for a strategy and a maximum
  loss before trading. The results compare the plan with the worst drawdown.
  The ticket shows the risk if a stop-loss is hit. There is no per-order
  essay.
- **No pressure mechanics.** No countdown timers (the counter reads "Day N of
  M"), no order confetti, no urgent alerts, no flashing prices, no
  one-swipe execution. News appears in a calm feed. Solo matches can be paused
  at any time.
- **No leverage, shorting or copy-trading.** The engine is long-only with cash
  only.
- **Random clicking loses.** Fees and the spread apply to every fill, and the
  balance gauntlet checks that idle and random players lose shipped bosses and
  dailies.
- **Gentle streaks.** A missed login day restarts the streak at day 1 with no
  penalty and no warning. The daily cooldown after a loss is 2 hours and can be
  skipped with earned Gems only; Gems are never sold for real money.
- **Opt-in leaderboards.** Players appear on the XP and ranked leaderboards
  only after opting in.
- **Accessible signals.** Gains and losses carry `+`/`−` signs and ▲/▼ glyphs
  as well as colour; touch targets are at least 44px; animation is disabled
  under `prefers-reduced-motion`.

## Not established

- The content (chapters, scenarios, quiz bank) has not been independently
  reviewed for financial accuracy or teaching quality, and there is no
  production approval gate for it.
- No study has measured whether the game improves understanding or behaviour.
  Profit in a synthetic market does not show real-world skill, and the app
  must not claim to make players profitable.
- The core is jurisdiction-neutral; tax, account and settlement rules are not
  modelled (see [localization](../localization-packs.md)).
- The free accessibility palettes and paid candle themes are sold or granted
  but not yet applied by the client.
