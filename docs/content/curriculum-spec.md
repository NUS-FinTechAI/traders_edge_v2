# Curriculum and gameplay spec

Design source for the campaign content. Where it differs from the [reference docs](../README.md#reference), the reference docs record what was built. Notable differences: matches run on a real-time clock rather than turn by turn, and each level ends in a full trading mission rather than a Sim Drill; market orders fill at the current close, not the next open; fees are 0.1 % (minimum $1), not a $5 commission; there are no partial fills, stop-limit, bracket or trailing orders; there is no streak shield, weekly frame or banner; ranks are Deckhand to Admiral, not the names in B6; and badge conditions follow [progression](../reference/progression.md#badges).

## B0. Design pillars

1. **Every challenge has one obvious lesson.** The briefing names it, the market script is built around it, and the debrief points to it.
2. **Use the concept and you win; ignore it and you lose.** "Do nothing", "buy everything on day 1" and "click randomly" must all lose to the top AI in almost every scenario. This is checked automatically before a scenario ships.
3. **One clear path.** Chapter map → levels → boss → next chapter. Skipping ahead is a single, clearly signposted option.
4. **Short.** A level takes 3–4 minutes, a challenge 4–8.
5. **Safe without walls of text.** One line of framing; no leverage, no shorting, no "get rich" messages.

## B1. Core loop

**Learn → Practice → Challenge → Debrief.**

- **Learn:** 4–5 lesson cards per level (about 90 seconds), each with a tap or drag element.
- **Practice:** 4–5 mission questions plus, in some levels, a short "Sim Drill" on a 5–15-day chart with one checkable task. Feedback is immediate. A wrong answer shows the explanation and the question comes back at the end of the set (Duolingo-style). First-try accuracy is logged.
- **Challenge:** chapter bosses, the daily challenge, multiplayer. A real simulation against named AI personalities, ranked by total profit.
- **Debrief:** after every challenge, a "Key Moments" timeline built automatically from rule checks. Example: "Day 11: you sold at the gap-down open. Panic Pete did too. Hannah held and finished $420 ahead. Review: Ch1 L5 'Bulls, Bears & Volatility'." Each moment links to the relevant card.

**5-minute session.**

1. Open the app and claim the login reward (1 tap).
2. Home shows a single "Continue" button: the next level, e.g. Ch2 L3 Limit Orders.
3. 4 cards, then 4 missions. Earn a star and XP.
4. If time is left, play the daily challenge (20 days with "Skip ahead", about 4 minutes).

**30-minute session.**

1. Claim the login reward.
2. Play 3 levels (about 12 minutes).
3. Play the chapter boss (about 8 minutes) and read the debrief.
4. Play the daily challenge (about 4 minutes).
5. Do the Daily Review quiz (5 questions, about 2 minutes), or one ranked match (about 10 minutes) if unlocked.

**Chapter flow (map nodes).**
`[Preview Battle] → L1 → L2 → L3 → L4 → L5 → [Chapter Boss]`. Winning the boss unlocks the next chapter.

- **Preview Battle (pre-test).** It runs on the same market script as the boss but with a different seed and skin, at the same difficulty. You play it once and cannot fail it: it gives 10 XP and is labelled "your starting point". Its result is the research pre-measure. The boss result after the chapter is the post-measure. The debrief shows improvement ("+$640 better than your Preview"). In Chapter 1 the Preview, plus the onboarding questions in B8, is the GDD's "introductory assessment".
- **Chapter Boss (post-test).** Finishing 1st earns the normal boss star. Meeting every Concept Check in a winning attempt earns the special boss star.
- **Gate Boss (skip-ahead).** On each locked chapter card: "Already know this? Beat the Gate to jump in." Before an early attempt it shows the GDD's friendly message: "New to trading? We recommend playing chapters in order. The Gate is tough!" Gate N is a parallel form of the previous chapter's boss (same script family and opponent tier, new seed and skin). Pairing Gate N with Boss N−1 gives the research a clean comparison: skippers with prior knowledge against sequential learners on comparable forms.
- **Unlock rule.** Chapter N+1 unlocks when Boss N is won (which requires all 5 normal level stars) or Gate N+1 is won. Nothing else gates chapters.
- **Gates that are removed.** The per-module diagnostic, the module check and the delayed-review gate go. Chapter quizzes and spaced review move into Quiz Mode as optional, rewarded activities. **[CONFLICT with the current progression in `learning_runs.py`/`progression.py` and AGENTS.md's mastery gates; needs owner approval.]**
- **Stars per chapter.** 5 levels × 2 + boss × 2 = **12**, matching the sample's "3/12".
- **Retries.** Bosses and Gates can be retried without limit. Every retry is a new seed variant of the same script, so there is no hindsight exploit. XP is paid on the first win only. Research records keep first attempts separate from retries.

## B2. Simulation rules (all modes)

| Rule             | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting capital | $10,000 **Sim Cash** (green; always labelled "Sim $"). The currency symbol comes from the localization pack.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Tick             | 1 tick = 1 trading-day candle (OHLC + volume). Players press "Next day"; "Skip ahead" moves up to 5 days and stops automatically at a news event, a scheduled event or a fill.                                                                                                                                                                                                                                                                                                                                                  |
| Length           | Preview/Boss/Gate 25–40 days by chapter; Daily 20; Multiplayer 25 (host can pick 20/30/40); Sim Drills 5–15.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Tickers          | 1–3 fictional companies per scenario, each with a name, sector and one-line profile (check against real tickers before shipping).                                                                                                                                                                                                                                                                                                                                                                                               |
| Order types      | Unlocked as they are taught. Ch1: market. After Ch2 L3: limit. After L4: stop and stop-limit. Ch4: attached stop-loss/take-profit (bracket) and trailing stop.                                                                                                                                                                                                                                                                                                                                                                  |
| Fills            | Orders are placed between days and fill during the next candle. **Market:** next open ± half-spread. **Buy limit:** fills if the next low ≤ limit, at min(open, limit). **Sell limit:** if high ≥ limit, at max(open, limit). **Sell stop:** triggers if low ≤ stop, fills at min(open, stop) − half-spread, so a gap fills at the open (this is the gap-risk lesson). Buy stop is the mirror. **Stop-limit:** becomes a limit once triggered and may not fill. Orders stay open until cancelled or the scenario ends.          |
| Liquidity        | Each order fills at most 10% of that day's volume; the rest carries over to the next day (the partial-fill lesson).                                                                                                                                                                                                                                                                                                                                                                                                             |
| Costs            | $5 commission per order execution (charged once per order) plus the spread: 0.10% for liquid tickers, 1–2% for "thin" ones. A card in Ch2 L1 notes that many real brokers charge $0 commission but costs still exist.                                                                                                                                                                                                                                                                                                           |
| Constraints      | Long only, no leverage, no shorting, cash cannot go negative, open orders reserve cash. No global 25% cap; a per-position cap applies only in scenarios that teach diversification.                                                                                                                                                                                                                                                                                                                                             |
| Profit (score)   | **Total profit = final portfolio value − $10,000.** Final value = cash + shares × final day's close. Fees are already taken out of cash.                                                                                                                                                                                                                                                                                                                                                                                        |
| Ties             | AI challenges: the player must **strictly** beat every opponent, so a tie is not a win (matches current code). Multiplayer: tied players share a placement, and Elo scores a draw.                                                                                                                                                                                                                                                                                                                                              |
| Early exit       | Abandoning counts as a loss: no rewards, the attempt is counted, and a daily abandonment triggers the cooldown. AI challenges have no deadline and can be resumed.                                                                                                                                                                                                                                                                                                                                                              |
| Trade plan       | A structured plan replaces the four free-text fields. **Why** is a chip from the player's unlocked reasons ("Uptrend", "Bounce off support", "Breakout + volume", "Earnings beat", "RSI oversold", "Other" + optional text). **Exit if wrong** is a stop price, optional in Ch1–3 and required from Ch4. **Target** is optional. The app computes and shows "Risk if stopped: $X (Y% of portfolio)". About 3 taps. **[CONFLICT: AGENTS.md says "written plan"; this is a structured plan with optional text. Owner decision.]** |
| Visibility       | Players see past candles, current bid/ask, released news, the event calendar, opponents' last actions ("Momentum Max bought LUMB") and live standings (rank and profit). No future data. Opponents follow the same rules, fees and information.                                                                                                                                                                                                                                                                                 |

**Scenario scripts.** A scenario is a script, not a random walk. Fields: `script_id, version, chapter, objective, tickers[], days, segments[], events[], opponents[], concept_checks[]`.

- **Segment:** `{ticker, days a–b, drift %/day, volatility %/day, volume × average}`.
- **Event:** `{day, ticker|all, timing: after_close|pre_market, headline, tag: earnings|macro|rumor|company|hype, gap %, follow-through drift %/day for n days, volume ×}`. News appears at the close of day t−1, and its gap is in day t's open. Market orders therefore fill at the gapped price and nobody gets free money. Skill comes from reading the follow-through or the overreaction.
- **Variants:** each attempt re-seeds noise (sd ≤ 40% of segment drift, so the shape survives), shifts events by ±1–2 days, scales magnitudes ±20% and re-skins ticker names, keeping one fixed skin per chapter.
- **OHLC generation:** open = previous close × (1 + gap); close comes from the segment path; high/low = max/min(open, close) + |noise|. Pattern candles such as hammers and shooting stars can be placed on chosen days.

**Anti-button-smashing: an automated gauntlet before a script ships.** Each script is run over 500 seeds against baseline bots:

- **Do-Nothing** (profit 0). Must win in **0%** of seeds, so the top AI must finish above 0 in at least 98% of seeds.
- **All-In Day-1 Hold.** Must win in ≤10% of seeds, except the Ch1 script, where holding is the lesson.
- **Random Trader** (trades on 30% of days with random size and side). Must win in ≤5%.
- **Max-Frequency Flipper.** Must win in ≤1%.
- **Skill-Path bot** (applies the target concept as scripted). Must win in ≥80%.

Each script also carries traps for random play: chop that bleeds fees, false breakouts, gaps through tight stops, and FOMO headlines before reversals.

**Difficulty levers, rising by chapter.**

- Opponents: 1 (Ch1–2), 2 (Ch3–5), 3 (Ch6–8).
- AI tier: Rookie, then Pro, then Elite.
- Noise-to-signal ratio.
- Number of tickers.
- Number of traps.
- Coach Tips overlay: on in levels and drills; off in Preview, Boss, Gate and Daily.

## B3. AI opponents

Every opponent uses only already-observed data and the same engine and fees as the player.

**Tiers (unless a profile overrides):**

| Tier   | Position size per entry | Reaction delay | Stops                                  |
| ------ | ----------------------- | -------------- | -------------------------------------- |
| Rookie | 30% of equity           | 2 days         | none                                   |
| Pro    | 50%                     | 1 day          | 8% trailing                            |
| Elite  | 70%                     | 0 days         | at market structure, sized for 1% risk |

| Name              | Style                      | Rules                                                                                                                                                                                                | Teaching role                                                         |
| ----------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **HODL Hannah**   | Buy and hold               | Day-1 open: equal-weight buy of Rookie 50% / Pro 80% / Elite 100% of cash. Never sells.                                                                                                              | The benchmark. Beats over-traders in uptrends and suffers in crashes. |
| **Momentum Max**  | Trend follower             | Buys when close > 10-day SMA and the SMA is rising (Elite also needs a 10-day high). Exits when close < 10-day SMA (Rookie: < 20-day).                                                               | Strong in trends; whipsawed in ranges.                                |
| **Value Vera**    | Mean reversion / buys dips | Buys after 3 red candles (Rookie) or RSI(14) < 30 (Pro/Elite). Sells at the 10-day SMA or +5%. Rookie has no stop (catches falling knives). Elite buys dips only when price is above the 20-day SMA. | Strong in ranges; hurt in downtrends.                                 |
| **Panic Pete**    | Emotional                  | Buys after 3 green days or a positive headline. Sells on any negative headline or a −4% day. Size 40/60/80% by tier.                                                                                 | The beatable opponent. Shows FOMO and panic-selling.                  |
| **Scalper Sam**   | Over-trader                | Rookie: buys any green close and sells the next day with market orders. Pro: only on moves > 1%. Elite: uses limit orders at the bid.                                                                | Shows fee and spread drag.                                            |
| **Breakout Bea**  | Breakout                   | Buy stop at the 20-day high (Rookie: 10-day) when volume ≥ 1.5× average (Rookie ignores volume, so false breakouts trap her). Stop just under the breakout level.                                    | Shows confirmed vs false breakouts.                                   |
| **Newsy Nina**    | News trader                | Buys the open after an earnings beat, sells after a miss. Rookie reacts to rumors too. Pro ignores rumors. Elite fades large gaps on non-fundamental news.                                           | Shows expectations and "sell the news".                               |
| **Steady Stella** | Risk manager               | 1% risk per trade, stop under the last swing low, only trades when close > 20-day SMA, takes half off at 2R. Invests at most 40% / 70% / 100% of the portfolio by tier.                              | Disciplined and hard to beat at higher tiers.                         |
| **Ironhand Iris** | Final boss                 | Stella's sizing + Max's trend filter + Nina's rumor filter; exits on a volume climax or a shooting star. Elite only.                                                                                 | The capstone opponent.                                                |

## B4. Curriculum: 8 chapters × 5 levels

| Ch  | Title (map region)                       | Boss              |
| --- | ---------------------------------------- | ----------------- |
| 1   | Market Basics (Harbor of Basics)         | The Steady Climb  |
| 2   | Orders & the Order Book (Order Book Bay) | Thin Ice          |
| 3   | Reading Charts (Chart Cliffs)            | Range Breaker     |
| 4   | Risk Management (Risk Reef)              | Reef Storm        |
| 5   | Indicators (Indicator Isles)             | Signal & Noise    |
| 6   | News & Fundamentals (News Coast)         | Earnings Season   |
| 7   | Trading Strategies (Strategy Summit)     | Regime Shift      |
| 8   | Trader Psychology (Mindset Peak)         | The Mania (final) |

Every level adds its terms to the **Trading Archive** (the "Dictionary" button in the sample). Format in what follows: "Answer:" gives the correct option; the one-line explanation is shown after the answer.

---

### CHAPTER 1: MARKET BASICS

**L1.1 What Is a Stock?**
Objectives:

- Explain that a share is a small piece of ownership in a company.
- Explain why companies sell shares.
- Name the two ways shareholders earn (or lose) money.

Cards:

1. **A slice of the company.** Lumen Bikes is split into 1,000,000 shares. Owning 100 shares means you own 0.01% of the company. _Interactive: a slider for shares owned shows your ownership %._
2. **Why companies sell shares.** To raise money to grow: build factories, hire people. The first sale to the public is an IPO. After that, shares trade between investors, and the company gets no money when you buy from another investor.
3. **How shareholders make money.** Two ways: the price rises (a capital gain), or the company pays dividends (a share of profits). Neither is guaranteed: prices fall and dividends can be cut. _Interactive: tap the two "money sources"._
4. **Why prices move.** Price changes when buyers and sellers change their view of what the company is worth, because of profits, news or the overall market mood. More eager buyers than sellers pushes the price up.
5. **Market cap.** Market capitalization = share price × number of shares. A high share price does not mean a big company. _Interactive: "Which company is bigger?"_

Missions:

1. You own 200 shares of Orchard Foods, which has 1,000,000 shares. What do you own? A) 200% of the company B) 0.02% of the company C) 2% of the company D) The right to run the company. **Answer: B.** 200 ÷ 1,000,000 = 0.0002 = 0.02%.
2. True/False: When you buy a share from another investor on an exchange, the company receives your money. **Answer: False.** The money goes to the seller; the company raised money when it first issued the shares.
3. Which two are ways a shareholder can earn a return? A) Price rises and dividends B) Guaranteed interest and coupons C) Commissions and fees D) Guaranteed dividends and refunds. **Answer: A.** Price gains and dividends are the two sources, and neither is guaranteed.
4. Company A: $200 per share, 2 million shares. Company B: $20 per share, 50 million shares. Which is bigger? A) A B) B C) Same size D) Can't tell. **Answer: B.** A = $400M; B = $1B. Share price alone doesn't show size.

Bonus mission ("Perfect Streak": all correct on the first try):

- Nimbus Cloud reports much bigger profits than people expected. What is the most likely immediate effect? A) More buyers want the shares, so the price tends to rise B) Price must fall C) No effect until year-end D) Profits are automatically paid out as dividends. **Answer: A.** Usually more demand, but not guaranteed; if expectations were even higher it can fall (Ch6).
- True/False: A company with a $500 share price is always bigger than one with a $50 share price. **Answer: False.** Size = price × shares (market cap).
- Shareholders who own a tiny fraction of a company usually have: A) No ownership B) A small ownership stake, often with voting rights in proportion C) Control of the board D) A guaranteed salary. **Answer: B.**

**L1.2 How the Stock Market Works**
Objectives:

- Describe what exchanges and brokers do.
- Explain that the price is the last agreed trade.
- Explain market hours and overnight gaps.

Cards:

1. **A marketplace for shares.** An exchange (e.g., NYSE, Nasdaq, SGX) is where buy and sell orders meet, like an auction running all day.
2. **You go through a broker.** You don't trade on the exchange yourself. A broker (an app or firm) sends your order and holds your account.
3. **Every trade has two sides.** For every share bought, someone sold it. The price you see is the last price a buyer and seller agreed on. _Interactive: drag a buyer and a seller together until a trade "prints"._
4. **Supply and demand.** If more people want to buy than sell at the current price, buyers must pay up and the price rises. _Interactive: "Add buyers" and watch the price tick up._
5. **Market hours and gaps.** Exchanges open at set hours. News overnight can make the next open very different from the last close; this is called a gap. In this game, one candle = one trading day.

Missions:

1. What does a broker do? A) Sets the stock price B) Sends your orders to the market and holds your account C) Guarantees profits D) Owns the companies. **Answer: B.**
2. The last trade in Tidal Power was $31.20. What is $31.20? A) An official value set by regulators B) The price where the most recent buyer and seller agreed C) The price you're guaranteed next D) The yearly average. **Answer: B.**
3. True/False: For every share bought, a share is sold. **Answer: True.** Every trade has a buyer and a seller.
4. _Chart:_ Day 5 closes at $40.00. After overnight news, Day 6 opens at $43.50. What is this? A) Gap up B) Gap down C) Dividend D) Stock split. **Answer: A.** The open is well above the prior close.

Bonus mission:

- At $50, buyers want 5,000 shares but sellers offer only 2,000. What likely happens? A) Price rises until buying and selling balance B) Price falls C) Price can't change D) The exchange cancels trading. **Answer: A.** Excess demand pushes the price up.

**L1.3 Investing, Trading & Gambling**
Objectives:

- Tell investing (years), trading (days to weeks) and gambling (no plan, no edge) apart.
- State the rule about which money can be risked.
- Build a basic trade plan.

Cards:

1. **Same stock, different plans.** An investor buys Orchard Foods to hold for years. A trader buys hoping to sell in days or weeks after a price move. Neither is guaranteed to profit.
2. **What makes it gambling?** Betting with no reason, no plan and no exit is gambling. A plan answers: why am I buying, where do I get out if I'm wrong, and how much can I lose?
3. **Risk and reward travel together.** Bigger possible gains come with bigger possible losses. "High returns, no risk" is a red flag.
4. **The money rule.** In real life, only risk money you could lose without hurting essentials (rent, food, emergencies). Large studies of day traders find most lose money over time. That's why you practise here with Sim Cash.
5. **Your trade plan.** Every trade in this game starts with a quick plan: _Why?_ and _Exit if wrong?_ _Interactive: build a plan by tapping chips._

Missions:

1. Maya buys Kestrel Air shares to hold for 10 years because she expects the company to grow. This is: A) Investing B) Day trading C) Gambling D) Short selling. **Answer: A.**
2. Which is most like gambling? A) Buying after research with an exit plan B) Buying because a stranger online says "to the moon!", with no exit plan C) Holding a diversified fund for retirement D) Selling when your planned stop is hit. **Answer: B.** No reason of your own, no exit.
3. True/False: Higher potential return usually comes with higher risk. **Answer: True.**
4. In real life, which money is suitable for risky short-term trading? A) Next month's rent B) Emergency savings C) Money you could lose without affecting essentials D) A credit-card cash advance. **Answer: C.**

Bonus mission ("Plan Builder"): Pick the complete plan for buying Lumen Bikes at $50.

- A) "It's going up." (no exit)
- B) "Uptrend; exit if it closes below $47; using money set aside for rent."
- C) "Uptrend; exit if it closes below $47; risking spare Sim Cash."
- D) "Exit at $47." (no reason)

**Answer: C.** It has a reason, an exit if wrong, and appropriate money.

**L1.4 Profit, Loss & Portfolio Value**
Objectives:

- Calculate P/L and % return including fees.
- Tell realized from unrealized P/L.
- Compute portfolio value, which is the score in every challenge.

Cards:

1. **Profit and loss.** P/L = (sell price − buy price) × shares − fees. Example: buy 20 at $50, sell at $56, $10 fees: (6 × 20) − 10 = **$110**.
2. **Percent return.** Return % = P/L ÷ amount invested. $110 ÷ $1,000 = 11%. It lets you compare trades of different sizes. _Interactive: a slider._
3. **Paper vs real.** Unrealized ("paper") P/L is on shares you still hold and changes every day. Realized P/L is locked in when you sell.
4. **Portfolio value is your score.** Portfolio value = cash + shares × current price. Every challenge ranks you by **total profit = final portfolio value − $10,000**. Shares you still hold at the end count at the final close.
5. **Guided drill.** _Interactive: buy 10 shares in a 5-day mini-market and watch cash, holdings and portfolio value update._

Missions:

1. Buy 50 shares at $20, sell at $23, $10 total fees. P/L? A) $150 B) $140 C) $160 D) $1,150. **Answer: B.** 3 × 50 = 150, minus 10.
2. What is the % return on the $1,000 invested? A) 14% B) 15% C) 1.4% D) 23%. **Answer: A.** 140 ÷ 1,000.
3. You hold 30 shares bought at $40; the price is now $35 and you haven't sold. A) Realized loss $150 B) Unrealized loss $150 C) Unrealized gain $150 D) $0, since nothing counts until you sell. **Answer: B.** It's a real paper loss; selling would realize it.
4. A challenge ends with $6,200 cash + 80 shares closing at $50. You started with $10,000. Total profit? A) +$200 B) −$3,800 C) +$4,000 D) $10,200. **Answer: A.** 6,200 + 4,000 = 10,200; minus 10,000.
5. **Sim Drill:** buy 10 shares of Orchard Foods, advance 3 days, then enter your unrealized P/L. Verified exactly against your portfolio state.

Bonus mission ("Fee Detective"): Two traders both made +$300 from price moves. Ari made 2 trades ($10 fees); Ben made 40 trades ($200 fees). Who finished ahead, and by how much? A) Ari, by $190 B) Ben, by $190 C) Tie D) Ari, by $10. **Answer: A.** $290 vs $100.

**L1.5 Bulls, Bears & Volatility**
Objectives:

- Define bull and bear markets.
- Explain volatility as bigger swings both ways.
- Explain why holding cash is a valid choice when you can only buy.

Cards:

1. **Bulls and bears.** A bull market means prices are broadly rising; a bear market means falling. A 20% drop from a recent high is commonly called a bear market.
2. **Market indexes.** An index (e.g., S&P 500, STI) tracks a basket of stocks to show how "the market" is doing. In this game the **Harbor 50** shows the overall mood.
3. **Volatility.** How far and how fast prices swing. A volatile stock might move 5% a day; a calm one 0.5%. More volatility means bigger possible gains _and_ losses. _Interactive: tap the more volatile chart._
4. **Cash is a position.** In this game you can only buy, then sell. When prices are falling, waiting in cash (profit $0) beats losing money.
5. **Noise vs news.** Prices wiggle every day. A one-day drop in a steady uptrend is often just noise. _Interactive: spot the dip inside the uptrend._

Missions:

1. The Harbor 50 falls from 4,000 to 3,100 over several months. Best description? A) Bull market B) Bear market C) Normal day D) Sideways. **Answer: B.** That's −22.5%.
2. _Chart:_ Over 20 days, Stock A moves within ±0.5% a day; Stock B moves ±4%. Which is more volatile? A) A B) B C) Same D) Can't tell. **Answer: B.**
3. True/False: High volatility means a stock is more likely to go up. **Answer: False.** Swings are bigger in both directions.
4. You can only buy then sell, and the market is in a steady downtrend. Which choice avoids losses from it? A) Buy more each day B) Hold cash and wait for signs of a turn C) Buy the most volatile stock D) Trade daily to win it back. **Answer: B.**
5. _Chart:_ A stock rose steadily for 10 days, dropped 3% on one day, and then kept rising. That drop was most likely: A) The start of a crash B) Normal noise within an uptrend C) A bear market D) A stock split. **Answer: B.**

Bonus mission: The index is up 10% this year but your stock is down 5%. Is that possible? A) Yes; an index is an average, and single stocks can differ B) No, every stock follows the index C) Only if the index is wrong D) Only in bear markets. **Answer: A.**

**Chapter 1 Boss: "The Steady Climb"** (Preview skin: "Morning Breeze", Kestrel Air)

- **Objective shown:** "Hold your nerve. Don't let one scary headline shake you out of a good trend."
- **Setup:** 25 days, 1 ticker: Orchard Foods (ORCF), $40, liquid. Market orders only.
- **Script:**
  - Days 1–10: +0.6%/day, volatility 0.8%.
  - After the close on day 10: headline "Analyst calls Orchard Foods 'overvalued'". Day 11 gaps −4% on 2.5× volume.
  - Days 12–13: −0.5%/day.
  - Days 14–25: +0.7%/day.
  - Ends about +10% from the start.
- **Opponent:** Panic Pete (Rookie). He buys after 3 green days, sells at the day-11 gap, and buys back around day 17. Target ≈ +$150.
- **Skill path:** buy about 90% early and hold, ≈ +$800. Do-Nothing = $0 and loses. Random trading bleeds fees and usually sells into the dip.
- **Concept Checks (special star):** were invested by day 5; did not sell on days 11–13; finished ahead of Pete.

---

### CHAPTER 2: ORDERS & THE ORDER BOOK

**L2.1 Bid, Ask & Spread**
Objectives:

- Identify the bid and the ask.
- Calculate the spread and the spread %.
- Explain why a round trip costs at least the spread.

Cards:

1. **Two prices, not one.** A quote is Bid $49.95 (the highest price a buyer offers) and Ask $50.05 (the lowest price a seller accepts). _Interactive: tap the price you pay to buy now._
2. **The spread.** Ask − bid = spread ($0.10). It's a hidden cost: buy at the ask, sell straight away at the bid, and you lose the spread.
3. **Liquid vs thin.** Busy stocks have many buyers and sellers, so spreads are tight (a cent or two). Thinly traded stocks have wide spreads. Spread % = spread ÷ mid price.
4. **The mid and the close.** The mid is halfway between bid and ask. Charts show closing prices, and your score values holdings at the final close.

Missions:

1. Quote: Bid $24.80 / Ask $25.00. You market-buy 10 shares (enough are offered). Your price? A) $24.80 B) $24.90 C) $25.00 D) $25.20. **Answer: C.** Buys fill at the ask.
2. What's the spread? A) $0.02 B) $0.20 C) $24.90 D) $2.00. **Answer: B.**
3. Buy 100 at $25.00 and immediately sell at $24.80, with no commission. Result? A) $0 B) −$20 C) +$20 D) −$2. **Answer: B.** 100 × $0.20.
4. Which costs the most to trade in and out of? A) 100.00/100.02 B) 10.00/10.50 C) 50.00/50.05 D) 75.00/75.03. **Answer: B.** The spread is about 5% of the price.

Bonus mission: Bid $9.80 / Ask $10.20. What's the spread as a % of the mid? A) 0.4% B) 4% C) 2% D) 40%. **Answer: B.** $0.40 ÷ $10.00.

**L2.2 Market Orders**
Objectives:

- Explain that market orders trade speed for price certainty.
- Calculate slippage across order-book levels.
- Recognize gap fills at the open.

Cards:

1. **Buy now, whatever the price.** A market order fills immediately at the best available price: the ask for buys, the bid for sells.
2. **Slippage.** If your order is bigger than the shares offered at the best ask, the rest fills at higher prices. Expected price vs actual price = slippage. _Interactive: a mini order book with asks of 100 @ $50.05 and 200 @ $50.10; buy 250 and watch the average price._
3. **Gaps.** Here, orders placed tonight fill at tomorrow's open. If news hits overnight, the open can be far from today's close, and a market order fills there.
4. **When to use.** When getting in or out matters more than a few cents, in liquid stocks. Risky in thin stocks or around big news.

Missions:

1. Main advantage of a market order? A) Guarantees the price B) Executes quickly and almost certainly C) No fees D) Avoids the spread. **Answer: B.**
2. Asks: 100 @ $20.00, 100 @ $20.05, 200 @ $20.10. You market-buy 300. Average price? A) $20.00 B) $20.05 C) $20.10 D) $20.03. **Answer: B.** (2,000 + 2,005 + 2,010) ÷ 300.
3. _Chart:_ You place a market **sell** after Day 9 closes at $30. Bad news overnight; Day 10 opens at $27. Your fill is about: A) $30 B) $27 C) $28.50 D) It won't fill. **Answer: B.** Market orders fill at the open.
4. True/False: A market order guarantees the last traded price. **Answer: False.**

Bonus mission: Which situation best suits a market order? A) You must exit now, in a liquid stock B) Buying 5,000 shares of a thin stock with 200 offered C) You only want to buy if the price drops to $45 D) Buying right before earnings with a wide spread. **Answer: A.**

**L2.3 Limit Orders**
Objectives:

- Explain limit price rules for buys and sells.
- Recognize that a limit may never fill.
- Use a sell limit as a take-profit.

Cards:

1. **Name your price.** A buy limit at $48 buys only at $48 or lower. A sell limit at $55 sells only at $55 or higher.
2. **The catch.** If the price never reaches your limit, nothing fills, and you might miss the move.
3. **How limits fill here.** Your order waits until filled or cancelled. A buy limit fills if a day's low reaches it. If the stock opens below your limit, you get the better opening price.
4. **Take-profit.** A sell limit above the current price is a profit target. _Interactive: drag a limit line on the chart and see which day it would fill._

Missions:

1. You think Kestrel Air will dip to $95.50 and want to buy only there or lower. Which order? A) Market B) Buy limit at $95.50 C) Buy stop at $95.50 D) Trailing stop. **Answer: B.**
2. _Chart:_ Buy limit at $40. The next candle is O 41.20, H 41.80, L 40.30, C 41.00. Filled? A) Yes, at $40 B) Yes, at $41.20 C) No D) Yes, at $40.30. **Answer: C.** The low never reached $40.
3. _Chart:_ Buy limit at $40. The next candle is O 39.10, H 40.50, L 38.90, C 40.20. Fill price? A) $40.00 B) $39.10 C) $38.90 D) $40.20. **Answer: B.** It opened below your limit, so you got the better price.
4. True/False: A sell limit at $60 can execute at $61. **Answer: True.** "$60 or better."

Bonus mission: Your buy limit sits at $45 with the stock at $47. It rallies to $55 without dipping. The lesson? A) Limits give price control but can miss moves B) Limits always fill eventually C) You should have used a stop-loss D) The broker made an error. **Answer: A.**

**L2.4 Stop Orders & Stop-Losses**
Objectives:

- Explain stop triggers.
- Place a stop-loss before entering.
- Recognize gap fills below the stop and the stop-limit trade-off.

Cards:

1. **A tripwire.** A sell stop at $45 (with the price at $50) does nothing until the price trades at or below $45. Then it becomes a market sell.
2. **Stop-loss.** It limits a losing trade to roughly your planned level. Decide it _before_ you buy. _Interactive: drag the stop below your entry and watch "Risk if stopped" update._
3. **Gaps go through stops.** Close at $46, bad news, open at $40: a stop at $45 fills near $40. A stop is not a guaranteed price.
4. **Buy stops and stop-limits.** A buy stop above the price buys when the price breaks up, which is used for breakouts. A stop-limit becomes a limit when triggered: it protects your price but might not fill in a gap.
5. **Where to place it.** Not so tight that normal wiggles hit it, not so wide that the loss is huge. Just below a recent low is common (Ch3–4).

Missions:

1. You buy at $50 with a sell stop at $46. On a normal day the price trades down to $45.90. What happens? A) Nothing B) The stop triggers and sells at about $45.90 C) It sells at exactly $46, guaranteed D) It buys more. **Answer: B.**
2. _Chart:_ Sell stop at $46. The day closes at $47; the next candle is O 41, H 42, L 40.50. Your fill is about: A) $46 B) $41 C) $40.50 D) No fill. **Answer: B.** The gap opened through the stop, so it fills at the open.
3. You want to buy only if the price breaks above $60 resistance (now $57). Which order? A) Buy limit $60 B) Buy stop $60 C) Sell stop $60 D) Market now. **Answer: B.** A buy limit at $60 would fill immediately at about $57.
4. Stop-limit with stop $46 / limit $45.50. The stock gaps to $41 and the day's high is $42. Result? A) Sells at $45.50 B) Sells at $41 C) No fill; you still hold D) Sells at $46. **Answer: C.**

Bonus mission (Sim Drill, "Protect the position"): you start holding 50 shares bought at $30. Place a sell stop so that the most you'd lose without a gap is $150 or less. Verified when the stop is at $27.00 or higher and below the current price.

**L2.5 The Order Book, Liquidity & Volume**
Objectives:

- Read order-book depth.
- Explain liquidity and how big orders "walk the book".
- Use volume and partial fills.

Cards:

1. **The order book.** A list of waiting limit orders: bids below, asks above, with the best bid and best ask at the top. _Interactive._
2. **Depth = liquidity.** Many shares at each level means deep and liquid; few means thin. A big market order eats through levels.
3. **Volume.** Shares traded in a period, shown as bars under the chart. High volume means many participants.
4. **Partial fills.** In this game an order fills at most 10% of a day's volume; the rest fills on later days.

Missions:

1. Bids: 50.00×300, 49.95×500. Asks: 50.05×200, 50.10×400. What are the best bid and the spread? A) $50.00, $0.05 B) $49.95, $0.10 C) $50.05, $0.05 D) $50.00, $0.10. **Answer: A.**
2. Market-sell 600 into that book. Average price? A) $50.00 B) $49.975 C) $49.95 D) $50.05. **Answer: B.** 300 @ 50.00 + 300 @ 49.95.
3. True/False: A stock trading 2,000 shares a day is usually easier to trade in size than one trading 2,000,000. **Answer: False.**
4. Volume is 3× average while the price jumps 6%. Best interpretation? A) Strong participation, more meaningful than the same move on low volume B) Volume doesn't matter C) It's guaranteed to keep rising D) It must reverse. **Answer: A.**

Bonus mission: Daily volume is 5,000 with the game's 10% cap. You place a valid buy for 1,200 shares. How many fill on day 1, and how many days to fill completely if volume holds? A) 500; 3 days B) 1,200; 1 day C) 120; 10 days D) 500; 2 days. **Answer: A.** 500 + 500 + 200.

**Chapter 2 Boss: "Thin Ice"** (Gate 3 and Preview use parallel skins)

- **Objective:** "Choose the right order for the job: limits in thin stocks, stop-losses on everything."
- **Setup:** 30 days, 1 opponent. Market, limit, stop and stop-limit orders.
- **Nimbus Cloud (NMBC):** $60, liquid (0.1% spread).
  - Days 1–14: +0.5%/day.
  - After the close on day 15: "Nimbus loses its biggest customer". Day 16 gaps −9%.
  - Days 16–30: −0.4%/day.
- **Pebble Games (PBGM):** $12, thin (2% spread, low volume).
  - Swings between $11.40 and $12.60 on about a 6-day cycle.
  - Calendar: "New game launch, day 20". Day 21 gaps +12% and holds.
- **Opponent:** Scalper Sam (Pro). He uses market orders on PBGM's swings and bleeds the 2% spread, and he holds NMBC into the gap. Target ≈ +$150.
- **Skill path:** NMBC with a stop-loss. The gap fill hurts, but the stop avoids the next 14 days of decline. PBGM bought with a buy limit near $11.50 and held through the launch. ≈ +$600.
- **Traps:** market orders in PBGM; holding NMBC with no stop.
- **Concept Checks:** every PBGM entry used a limit order; NMBC had a stop-loss before day 15; no stop was cancelled or moved away from the price.

---

### CHAPTER 3: READING CHARTS

**L3.1 Candlestick Anatomy**
Objectives:

- Read open, high, low and close from a candle.
- Tell bullish from bearish candles.
- Compare line and candlestick charts.

Cards:

1. **Line vs candle.** A line chart joins closing prices. A candlestick shows four prices per day: open, high, low, close (OHLC).
2. **Body and wicks.** The body runs from open to close. The wicks (shadows) reach the high and the low. _Interactive: drag handles to build a candle._
3. **Green and red.** Green (bullish) closed above its open; red (bearish) closed below. Colors are customizable, and every candle also gets a text label for color-blind players.
4. **What a candle says.** A long green body means buyers controlled the day. A long upper wick means buyers pushed up but sellers pushed it back. _Interactive: "Spot the bullish candle."_

Missions:

1. What does a long green candlestick usually indicate? A) Strong selling pressure B) Increased selling volume C) Buyers in control, pushing price up D) The market is moving sideways. **Answer: C.** It closed well above its open.
2. _Candle:_ O 20.00, H 21.50, L 19.80, C 21.20. Its color? A) Green B) Red C) Neither D) Can't tell. **Answer: A.** Close > open.
3. _Candle:_ O 35.00, H 35.40, L 31.90, C 32.10. Which is true? A) Closed above its open B) Closed near its low, so sellers were in control C) It's a long lower wick D) The high was $35.00. **Answer: B.**
4. True/False: The wick above the body shows the period's highest traded price. **Answer: True.**

Bonus mission ("Build-a-Candle"): opened $50, fell to $47, rallied to $53, closed $52. Build it. Verified: green, body 50–52, lower wick to 47, upper wick to 53.

**L3.2 Candlestick Patterns**
Objectives:

- Recognize the doji, hammer, shooting star and engulfing patterns.
- Explain that patterns are probabilities and need context and confirmation.

Cards:

1. **Doji: indecision.** Open ≈ close, a tiny body: buyers and sellers were balanced.
2. **Hammer and shooting star.**
   - Hammer: small body near the top, lower wick at least 2× the body, after a decline. Sellers pushed down, buyers fought back, a possible bullish reversal.
   - Shooting star: the mirror image at the top of an uptrend, a possible bearish reversal.
3. **Engulfing.** Bullish engulfing: a green body completely covers the previous red body, after a downtrend. Bearish engulfing is the opposite.
4. **Clues, not promises.** Patterns fail often. Check where the pattern appears (trend, support), the volume, and wait for confirmation (the next candle). _Interactive: "Spot the hammer" in a 15-candle chart._

Missions:

1. _Candle after 5 red days:_ O 39.70, H 40.10, L 38.00, C 40.00. Pattern? A) Hammer B) Shooting star C) Bearish engulfing D) Doji. **Answer: A.** Lower wick 1.70 vs body 0.30, near the top.
2. _Two days:_ Day 1 O 52, C 50 (red). Day 2 O 49.80, C 52.60 (green). Pattern? A) Bullish engulfing B) Bearish engulfing C) Doji D) Hammer. **Answer: A.**
3. _Candle:_ O 30.00, H 30.90, L 29.20, C 30.02. Pattern? A) Doji B) Hammer C) Long green D) Gap. **Answer: A.**
4. You spot a hammer after a long downtrend. Most reasonable action? A) Buy the maximum; reversal guaranteed B) Treat it as a possible reversal: wait for confirmation and plan a stop below the hammer's low C) Sell everything D) Ignore candles. **Answer: B.**

Bonus mission: A shooting star forms at the top of an uptrend, right at resistance, on high volume. What does it suggest for a holder? A) Sellers rejected higher prices; consider tightening the stop or taking some profit B) Buy more, it's guaranteed C) Nothing D) Trend confirmed. **Answer: A.**

**L3.3 Trends & Trendlines**
Objectives:

- Identify uptrends, downtrends and ranges from swing highs and lows.
- Draw a trendline.
- Recognize signs that a trend is breaking.

Cards:

1. **Higher highs, higher lows.** An uptrend has rising peaks and dips. A downtrend has lower highs and lower lows. A range (sideways market) has neither.
2. **Trade with the trend.** Trends often persist for a while, so many traders trade in the trend's direction, until it ends.
3. **Trendlines.** Connect two or more rising lows (uptrend) or falling highs (downtrend). _Interactive: tap two lows to draw._
4. **When a trend breaks.** A close below the uptrend line plus a lower high is a warning. One break is not proof.

Missions:

1. _Chart:_ swing highs 50, 54, 58; swing lows 46, 49, 53. Trend? A) Up B) Down C) Sideways D) Can't tell. **Answer: A.**
2. _Chart:_ highs 80, 76, 71; lows 74, 69, 65. Trend? A) Up B) Down C) Sideways D) Breakout. **Answer: B.**
3. How do you draw an uptrend line? A) Connect rising lows B) Connect the highs C) A horizontal line at the average D) First close to last close. **Answer: A.**
4. In an uptrend, price closes below the trendline and the next bounce fails below the previous high. This suggests: A) The trend may be weakening or reversing B) A stronger uptrend C) Nothing D) A guaranteed crash. **Answer: A.**

Bonus mission (Sim Drill, "Trend Labeller"): label three 20-day charts as up, down or sideways. One is a range with a single spike, which is the trap.

**L3.4 Support & Resistance**
Objectives:

- Find support and resistance from repeated turning points.
- Explain role reversal.
- Place entries, stops and targets around levels.

Cards:

1. **Floors and ceilings.** Support is a level where falls have repeatedly stopped (buyers step in). Resistance is where rises have stalled (sellers appear).
2. **Why levels matter (sometimes).** Many traders watch the same levels, so orders cluster there, and round numbers often matter. Treat levels as zones, not exact lines.
3. **Role reversal.** Broken resistance often acts as support on a retest: the old ceiling becomes the new floor.
4. **Using levels.** Buy near support with a stop just below it, and target near resistance. _Interactive: drag the stop and target; see the reward-vs-risk preview._

Missions:

1. _Chart:_ bounces near $48 on days 3, 9 and 15; tops near $55 on days 6 and 12. Support and resistance? A) $48 / $55 B) $55 / $48 C) $50 / $52 D) None. **Answer: A.**
2. Price breaks above $55 on high volume, pulls back to $55 and holds. $55 is now acting as: A) Support B) Resistance C) Nothing D) A gap. **Answer: A.**
3. You're buying near the $48 support at $48.30. A sensible stop? A) $48.20 B) Just below the support zone, about $46.90 C) $40 D) No stop. **Answer: B.** Below the zone, so normal wiggles don't hit it, but not huge.
4. True/False: Support levels are exact prices that can never be broken. **Answer: False.**

Bonus mission (Sim Drill, "Buy the Floor"): in a 15-day range between $48 and $52, place a buy limit near support with a stop below it. Verified by placement only (limit $47.50–48.80, stop $46.00–47.90); the outcome doesn't matter.

**L3.5 Volume & Breakouts**
Objectives:

- Use volume to judge how strong a move is.
- Tell a confirmed breakout from a false one.
- Plan a breakout with a buy stop, a stop-loss and a measured-move target.

Cards:

1. **Volume confirms.** A rise on growing volume shows strong participation. A rise on shrinking volume is weaker.
2. **Breakouts.** Price closes beyond resistance (or support) after a range. It's more convincing on volume well above average (about 1.5–2×).
3. **False breakouts (bull traps).** Price pokes above resistance on weak volume, then falls back into the range. Defenses: wait for a close above, check the volume, keep the stop back inside the range.
4. **Breakout plan.** Buy stop just above resistance, stop-loss back inside the range, and a rough target of breakout + range height (the "measured move").

Missions:

1. Most convincing breakout? A) Closes above resistance on 2× average volume B) Pokes above intraday, closes below, low volume C) Closes above on half the average volume D) Touches resistance. **Answer: A.**
2. _Chart:_ range $40–44 for 15 days. Day 16: H 44.80, C 43.60, volume 0.7× average. What happened? A) False breakout B) Confirmed breakout C) Breakdown D) Gap up. **Answer: A.**
3. Range $40–44, breakout at $44. Measured-move target? A) $46 B) $48 C) $52 D) $44.40. **Answer: B.** Range height is $4.
4. You bought the breakout at $44.20. A logical stop? A) $44.10 B) Back inside the range, about $42.90 C) $30 D) None. **Answer: B.**

Bonus mission: _Chart:_ an uptrend pulls back to $50 (old resistance, now support), and a hammer forms there (low $49.10) on rising volume. Best plan? A) Buy about $50.50, stop below $49 (under the hammer), target the prior high of $56 B) Buy with no stop C) Sell everything D) Buy at $56. **Answer: A.** Reward ≈ 5.5 vs risk ≈ 1.6, more than 3:1.

**Chapter 3 Boss: "Range Breaker"** (2 opponents)

- **Objective:** "Read the chart: trade the range, catch the _real_ breakout, skip the fake one."
- **Setup:** 30 days.
- **Lumen Bikes (LUMB):** $50.
  - Days 1–15: range $48–52 (lows on days 3/8/13, highs on days 5/10).
  - Day 11: false breakout to an intraday $52.80, closes $51.60 on 0.7× volume.
  - Days 16–17: real breakout, closes $53.50 on 2.2× volume.
  - Days 18–30: +0.8%/day, with a retest of about $53 on days 22–24 (role reversal), ending about $62.
- **Tidal Power (TDLP):** $30. A downtrend of lower highs and lower lows at −0.4%/day. A hammer on day 12 fails, and the price keeps falling to about $26 (the "unconfirmed pattern" trap).
- **Opponents:**
  - Momentum Max (Rookie): enters LUMB about 2 days late and holds. Target ≈ +$350.
  - Value Vera (Rookie): buys TDLP dips (loses) and LUMB range lows, but sells at the SMA and misses the breakout. Target ≈ $0 ± $150.
- **Skill path:** LUMB about 70% after the confirmed breakout close, stop around $51.40, held through the retest. ≈ +$1,000. Avoid TDLP or exit it fast.
- **Concept Checks:** didn't buy LUMB on day 11, or had a stop inside the range if you did; no TDLP buy without a confirming higher close; every entry had a stop at a chart level.

---

### CHAPTERS 4–8 (titles, objectives, mission topics; full text to be written in the same format)

**Chapter 4: Risk Management**

- **L4.1 Position Sizing & the 1% Rule.** Size = (account × risk %) ÷ (entry − stop), and why fixed-% risk survives losing streaks. Missions: $10,000 × 1% = $100 with a $2 stop distance = 50 shares; 10 losses at 1% vs 10%; the difference between position size and risk; the maximum shares given cash.
- **L4.2 Stop Placement.** Stops based on structure and on the average daily range; too tight vs too wide; trailing stops; never widen a stop. Missions: choose a stop given the average range; move to breakeven; trailing-stop fills.
- **L4.3 Risk/Reward & Win Rate.** R-multiples, breakeven win rate = 1/(1+R), expectancy. Missions: compute R:R; 2R needs a 33.3% win rate; system expectancy; skip a trade below 1:1.
- **L4.4 Diversification & Correlation.** Spreading out reduces single-company risk, not market risk; correlated holdings act like concentration. Missions: spot a correlated pair; concentration %; impact of a sector crash.
- **L4.5 Drawdowns & Recovery.** Drawdown math; −50% needs +100% to recover; pause rules. Missions: peak-to-trough; recovery %; when to stop trading for the day.
- **Boss "Reef Storm"** (30 days, 3 tickers). Kestrel Air: volatile uptrend. Orchard Foods: steady +0.3%/day. Nimbus Cloud: a parabolic +1.2%/day, then an "accounting probe" gap of −30% after day 18 and three more down days.
  - Opponents: Momentum Max (Pro), who concentrates in NMBC and loses, and Steady Stella (Rookie), target ≈ +$200.
  - Skill path: spread across names, size by 1% risk, cap any position at about 25%, set stops. ≈ +$450.
  - Concept Checks: every entry risked ≤ 2%; no position over 30%; a stop on every position.

**Chapter 5: Indicators**

- **L5.1 Moving Averages:** SMA vs EMA; price vs MA as a trend filter; dynamic support.
- **L5.2 MA Crossovers:** fast/slow crosses, golden and death cross, lag and whipsaw in ranges.
- **L5.3 RSI:** 0–100, 70/30; overbought can stay overbought in strong trends; divergence basics.
- **L5.4 MACD:** MACD = 12-EMA − 26-EMA, signal line = 9-EMA, histogram; it lags.
- **L5.5 Combining Signals:** confluence of trend, level and indicator; indicator overload; indicators are calculated from price, not new information.
- **Boss "Signal & Noise"** (35 days). LUMB is a strong uptrend whose RSI stays above 70 for 10 or more days, the trap for "overbought" sellers. TDLP is a $28–32 range where RSI 30/70 works and MA crosses whipsaw.
  - Opponents: Value Vera (Pro), who sells LUMB early, and Momentum Max (Pro), who gets chopped in TDLP.
  - Skill path: the right tool for each regime.
  - Concept Checks: held LUMB while above the 20-day EMA; TDLP entries in the bottom third of the range.

**Chapter 6: News & Fundamentals**

- **L6.1 Earnings Reports:** EPS, revenue, beat or miss vs expectations, guidance.
- **L6.2 Valuation Basics:** P/E = price ÷ EPS, growth vs value, market cap again.
- **L6.3 Macro Events:** interest rates, CPI, jobs; which sectors are sensitive; the event calendar.
- **L6.4 Expectations & "Sell the News":** "priced in", buy the rumor and sell the news, overreaction vs drift.
- **L6.5 Hype, Rumors & Manipulation:** pump-and-dump, social-media hype, checking sources, insider trading is illegal.
- **Boss "Earnings Season"** (30 days, 3 tickers, 3 opponents).
  - ORCF: earnings day 8, beats and raises guidance; +7% gap then drift.
  - NMBC: earnings day 15, beats EPS but cuts guidance; −8% gap.
  - PBGM: acquisition rumor on day 18 (+10%), denied on day 22 (−12%).
  - Day 12: rates rise more than expected; everything −2.5%, NMBC −4%.
  - Opponents: Newsy Nina (Pro), Panic Pete (Pro), HODL Hannah (Pro).
  - Concept Checks: no position over 15% held into a scheduled earnings report; no buying PBGM on the rumor; entered ORCF after the guidance-raise confirmation.

**Chapter 7: Trading Strategies**

- **L7.1 Trend Following:** pullback entries, trailing exits, low win rate with big winners.
- **L7.2 Mean Reversion:** range trades, oversold bounces; fails in trends.
- **L7.3 Breakout Trading:** bases, volume, buy stops, false-breakout handling.
- **L7.4 Match Strategy to Market:** identify the regime; sitting out is a strategy.
- **L7.5 Testing & Journaling an Edge:** backtests, sample size, expectancy, overfitting, a trade journal.
- **Boss "Regime Shift"** (40 days, 2–3 tickers). Uptrend (days 1–14), then chop with false breakouts (15–28), then a breakdown (29–40), while KSTL breaks out of a base on day 30.
  - Opponents: Momentum Max, Value Vera and Breakout Bea, all Elite. Each wins one phase and loses the others.
  - Concept Checks: reduced exposure during the chop; exited the breakdown within 2 days of a lower low; caught the KSTL breakout with volume confirmation.

**Chapter 8: Trader Psychology**

- **L8.1 FOMO & Chasing:** buying extended moves; the plan comes first.
- **L8.2 Loss Aversion:** the disposition effect (cutting winners early, holding losers).
- **L8.3 Revenge Trading & Tilt:** sizing up after a loss; cool-off rules.
- **L8.4 Overconfidence & Overtrading:** luck vs skill, hot streaks, fee drag.
- **L8.5 Process over Outcome:** judge decisions, not results; journals; your personal trading plan.
- **Final Boss "The Mania"** (40 days).
  - PBGM: quiet base (days 1–10); an influencer hype headline on day 11; parabolic +4%/day with volume climbing (days 11–24) and FOMO headlines; a shooting star on record volume on day 25; "insiders selling" on day 26; then −40% over 6 days, a dead-cat bounce (days 33–35), and further decline.
  - ORCF: steady +0.3%/day.
  - Opponents: Panic Pete (Elite: chases late at 80% size), Momentum Max (Elite: exits about −12% from the peak), Ironhand Iris (Elite: small hype ride with a tight trail plus a core in ORCF).
  - Concept Checks: no PBGM position over 25% after day 20; out of PBGM within 3 days of the shooting star or by stop; no size increase right after a losing trade; didn't buy the bounce on days 33–35.

## B5. Daily challenge

- **Format.** 1 AI opponent, 20 days. Unlocks after the Chapter 1 boss, which fixes the problem of a first-ever trade happening in a daily.
- **Shared form.** Everyone gets the same seed on the first attempt that day. Retries get a new seed variant of the same script.
- **Weekday rotation** (difficulty varies, as the GDD allows):

| Day | Script                | Opponent              |
| --- | --------------------- | --------------------- |
| Mon | Steady Climb          | Panic Pete (Rookie)   |
| Tue | Range Chop            | Scalper Sam (Pro)     |
| Wed | Pullback in Uptrend   | Value Vera (Pro)      |
| Thu | Earnings Gap          | Newsy Nina (Pro)      |
| Fri | Breakout vs Fakeout   | Breakout Bea (Pro)    |
| Sat | News Shock & Recovery | Momentum Max (Elite)  |
| Sun | Bubble & Crash        | Steady Stella (Elite) |

- **Tools.** Only order types the player has unlocked. The Tuesday–Sunday scripts are built so that Ch1–3 tools are enough to win.
- **Reset.** 00:00 UTC, shown in local time.
- **Loss.** A 2-hour cooldown, or refresh immediately for **20 Gems**. A cooldown from yesterday's scenario does **not** block today's new daily; the reset clears it. **[CONFLICT: changes economy policy 1, which currently carries cooldowns across midnight.]**
- **Rewards.**
  - First win each day: **200 Doubloons** (the GDD's "Stocks").
  - Completing the daily: +15 XP once a day.
  - Winning: +15 XP once a day.

## B6. Currencies, streaks, shop, XP, badges, titles, avatars

**Three currencies, each with its own icon and color.**

- **Sim Cash ($):** green banknote. Lives only inside a challenge.
- **Doubloons:** gold coin, fits the treasure map. Weekly currency that expires Monday 00:00 UTC. The GDD calls it "Stocks" and itself flags confusion with shares; keep "stocks" as the internal key if renaming code is costly.
- **Gems:** purple. Premium currency from ranked play only; it never expires and cannot be bought with real money.

**Login streak** (one claim per UTC day, separate from the daily challenge):

| Day | Doubloons | XP  |
| --- | --------- | --- |
| 1   | 20        | 10  |
| 2   | 20        | 10  |
| 3   | 20        | 10  |
| 4   | 30        | 10  |
| 5   | 30        | 20  |
| 6   | 30        | 20  |
| 7   | 50        | 20  |

- A full week gives **200 Doubloons**. The cycle repeats after day 7.
- **Weekly reward math:** 5 daily wins (1,000), _or_ 4 wins plus a full login week (800 + 200). This delivers the GDD's "potentially reducing the number of victories required".
- **Missing a day:** the streak resets to Day 1. One free "streak shield" per week protects a single missed day; it is automatic, not sold.

**Weekly reward track (Doubloons).**

- 400: the week's themed avatar frame.
- 1,000: the weekly title (e.g., "Colossal Challenger", rotating weekly).
- Earned items stay forever; unspent Doubloons expire.

**Gem shop (cosmetic only, nothing changes the simulation).**

- Avatars: 120.
- Profile banners: 150.
- Avatar frames: 200.
- Map trail styles: 250 (subtle, no flashing).
- Titles: 300.
- Candle color themes: 100. Accessibility palettes (colorblind, high contrast) are **free**, never sold.
- Daily refresh: 20.
- 6–8 items rotate monthly.

**XP sources** (never per order, trade count or volume):

| Activity                              | XP                        |
| ------------------------------------- | ------------------------- |
| Level, first completion               | 20                        |
| Bonus mission                         | 10                        |
| Preview Battle                        | 10                        |
| Chapter Boss, first win               | 50                        |
| Gate Boss win                         | 50                        |
| Daily completed / won                 | 15 / 15 (once a day each) |
| Practice Arena challenge              | 10 (cap 3 a day)          |
| Chapter Quiz pass (≥80%), first pass  | 20                        |
| Daily Review                          | 10 a day                  |
| Mixed Mastery quiz, first pass        | 50                        |
| Ranked match                          | 10 (win 20)               |
| Login                                 | per the streak table      |
| Private lobbies and classroom quizzes | 0 (GDD / AGENTS)          |

**Player levels.**

- **Curve:** going from level L to L+1 costs 100 + 25 × (L − 1) XP. Cumulative totals: level 5 = 550, level 10 = 1,800, level 20 = 6,175, level 30 = 13,050, cap at level 50 = 34,300.
- **Rank names:**

| Levels | Rank                  |
| ------ | --------------------- |
| 1–4    | Rookie Trader         |
| 5–9    | Market Explorer       |
| 10–14  | Chart Reader          |
| 15–19  | Risk Manager          |
| 20–29  | Strategist            |
| 30–39  | Seasoned Trader       |
| 40–49  | Market Veteran        |
| 50     | Captain of the Ledger |

**Badges** (earned only, never sold; based on process, not profit size):

1. **First Steps:** finish Ch1 L1.
2. **First Plan:** place your first trade with a complete plan.
3. **Quick Learner:** 10 levels with every mission right on the first try.
4. **Chart Reader:** win the Chapter 3 boss.
5. **Risk Manager:** finish any challenge with a stop on every position and no entry risking more than 2%.
6. **Sniper:** fill 5 limit orders at your planned price.
7. **Fee Fighter:** win a chop or range scenario paying under $30 in fees.
8. **Cool Head:** finish a challenge where no trade after a loss was bigger than the trade before it.
9. **Patient Trader:** win a challenge while in cash on at least 40% of days.
10. **Explorer:** earn every special star in one chapter.
11. **Gatecrasher:** win any Gate Boss.
12. **Boss Slayer:** win all 8 chapter bosses.
13. **Streak Master:** 30-day login streak.
14. **Quiz Master:** pass 10 quizzes with 100%.
15. **Ranked Debut:** complete 5 ranked matches.
16. **Calibrated:** in 20 or more quiz answers marked "Sure", at least 85% were correct.

**Titles.**

- Rank titles (by player level).
- Weekly titles (Doubloons).
- Boss titles for special stars: "Steady Hand" (Ch1), "Order Master" (Ch2), "Chart Whisperer" (Ch3), "Reef Survivor" (Ch4), "Signal Seeker" (Ch5), "Headline Reader" (Ch6), "Regime Ranger" (Ch7), "Ironmind" (Ch8).
- Ranked tier titles per season.
- Gem shop titles.

**Avatars.**

- 4 starter avatars.
- 8 chapter-guide avatars (one per chapter boss win).
- Weekly frames.
- Gem shop avatars.

## B7. Quiz mode

- **Separate question bank.** Lesson missions _teach_: hints, immediate feedback, re-queued until correct, built around that level. Quizzes _check retrieval_ using different items from the same concepts, never the mission text.
- **Item schema:** `id, chapter, level, concept_tags[], type (mc | true_false | chart_id | calc | order_ticket | drag_level), difficulty 1–3, stem_template + params` (templates generate number variants so answers can't be memorized). Each distractor carries a misconception tag (e.g., `limit_guarantees_fill`, `stop_is_guaranteed_price`, `pattern_is_certain`). Plus `answer, explanation, glossary_links, version, review_status`. Aim for at least 20 items per chapter at launch, mixed in difficulty, with correct answers spread evenly across positions.
- **Quiz types:**
  - **Chapter Quiz:** 10 items. Pass at ≥80%. 20 XP on the first pass.
  - **Daily Review:** 5 items, spaced repetition weighted toward concepts you got wrong (Leitner boxes: 1/3/7/14 days). 10 XP a day.
  - **Mixed Mastery:** 20 items across all unlocked chapters (interleaved). 50 XP on the first pass.
- **Confidence.** An optional "Sure / Think so / Guessing" tap per item, for calibration and the Calibrated badge.
- **Feedback.** Standalone quizzes show feedback per question, like the sample's "Great choice!". Classroom quizzes let the instructor choose per-question or end-of-quiz feedback.
- **Rules.** No timers. Unlimited standalone retries, with XP once per quiz per edition. The research log flags retries.
- **Classroom.**
  - Instructor role comes from server configuration only (as now).
  - The instructor creates a room code and builds the quiz from chapters or hand-picked items (1–30 items).
  - Settings: attempt limit 1–3, feedback mode, open and close.
  - Live view of who has finished.
  - Results by student and by concept (a misconception heatmap), with CSV export.
  - Classroom quizzes give no XP.

## B8. Multiplayer

- **Private lobbies (classroom and friends).**
  - The host creates a lobby and gets a 6-character code (letters and digits, avoiding 0/O/1/I), shared outside the app. Players join with it.
  - 2–30 players. **[CONFLICT: current maximum is 8; classes need about 30.]**
  - **Host controls:**
    - Scenario: from the script library, or random.
    - Length: 20, 25, 30 or 40 days.
    - Tool rule set: Basic (market only), Standard (+ limit and stop), Advanced (+ bracket and trailing).
    - Optional AI fill-in opponents.
    - Turn timer: off, 30, 60 or 90 seconds per day.
    - Start (needs at least 2 humans).
    - Kick idle players.
    - End early: results are calculated at the current day.
  - No chapter prerequisite for private lobbies, so teachers can run them at any point; the host's rule set controls complexity. **[CONFLICT: current gate is chapters 1–4.]**
  - No XP, Gems or rating.
- **Public ranked.**
  - 1v1 matchmaking within ±150 rating, widening by 50 every 15 seconds.
  - Unlocks after the **Chapter 4 boss** (risk basics first). **[CONFLICT: currently modules 1–9; the supervisor summary says "fully mastered". Owner decision.]**
  - The scenario is drawn at random from a ranked pool of the 12 scripts. 25 days.
- **Same scenario for everyone.** Same seed, same path, independent liquidity per player (as now). A day advances when everyone is ready or the per-day timer runs out. Ranked uses a 45-second calm progress bar; if it runs out, you hold and the day advances. **[CONFLICT with "no countdowns": a terminating rule is needed for public play; it is shown as a neutral bar, never red or flashing.]**
- **Disconnects.**
  - Private: you hold until you return.
  - Ranked: 3 timed-out days in a row, or an explicit leave, is a forfeit. A forfeiter ranks below finishers, takes an Elo loss, and their portfolio is still valued.
  - If both players place zero orders, the match is a no-contest: no rating, no Gems (stops AFK farming).
- **Elo.**
  - Start at 1000. E = 1 / (1 + 10^((Rb − Ra)/400)).
  - K = 40 for the first 10 matches, then 24; K = 16 at 1700 or above.
  - Equal profit to the cent is a draw (0.5).
- **Tiers:** Bronze below 1100; Silver 1100–1299; Gold 1300–1499; Platinum 1500–1699; Diamond 1700+.
- **Seasons:** 8 weeks. Soft reset: new rating = 1000 + (old − 1000) × 0.5.
- **Gems.**
  - Win 15; completed loss 5 (needs at least one order placed); first win of the day +10.
  - First promotion each season: Silver 50 / Gold 100 / Platinum 150 / Diamond 250.
  - End of season: Bronze 20 / Silver 50 / Gold 100 / Platinum 200 / Diamond 300, plus the season tier title.
- **Global leaderboard:** sorted by rating, never by single-match profit.

## B9. Research logging (per decision)

- **Per attempt:**
  - Pseudonymous player ID, consent and cohort flags, prior-knowledge group.
  - Content, script, version, seed and variant.
  - Mode, difficulty and opponent tiers, hints on or off.
  - Attempt number; first attempt or retry; whether the retry was a paid refresh.
  - Whether it is the Preview or the Boss (the pre/post pair).
- **Per decision** (order submit, modify, cancel, hold-and-advance):
  - Server time, day index, seconds since the day was shown.
  - Action, ticker, side, order type, quantity, limit or stop price.
  - Plan: reason chip, stop, target, computed risk in $ and %.
  - **Market context at that moment:** last close, bid/ask/spread, visible indicators, headlines visible and their age, upcoming calendar events, distance to nearby support/resistance (tagged in the script), and the script's current segment label (uptrend, range, …; hidden from the player).
  - **Portfolio before and after:** cash, holdings, average cost, realized and unrealized P/L, exposure % per ticker, open orders.
  - Opponent actions visible at the time, and whether standings were viewed.
- **Per fill:** day, price, quantity, fee, slippage vs the expected price, whether it was a gap fill.
- **Derived flags:** stop set at entry; stop moved away; risk % over the limit; bought against the segment trend; chased after 3 or more green days; held into a scheduled event; sold on a news gap; revenge sizing (bigger size right after a loss); followed the planned exit.
- **End of attempt:**
  - Profit, rank, maximum drawdown, fees, turnover, days invested.
  - Comparison against buy-and-hold and against the Skill-Path bot on the same seed.
  - Concept Check results; a multiple-choice "key moment" reflection with confidence.
- **Learning rubric** (kept separate from the profit result): a **Decision Score from 0 to 100** = the weighted share of Concept Checks met (40%) + plan adherence (25%) + risk discipline (25%: stop present, risk ≤ 2%, cap respected) + overtrading index (10%: fees ÷ |profit|). It is used for special stars, the debrief and research only; it never decides a win. It needs validation before being called a learning measure.
- **Prior-knowledge measurement:**
  - Onboarding self-report: 4 items (experience, account ownership, how often you trade, confidence).
  - A 10-item concept pre-quiz, unscored for progress.
  - The Ch1 Preview Battle.
  - Plus Gate behavior: who skips ahead and whether they succeed.

## B10. Safety framing (light touch)

- **One persistent line** in challenge and lesson footers: _"Simulated money, fictional companies. Practice only, not financial advice."_
- **Results line:** _"Sim results. Real markets are harder, and nobody can guarantee profits."_ The debrief shows the buy-and-hold comparison and "What a disciplined plan did here" (the Skill-Path bot).
- **Mechanics:** no leverage, no shorting, no copy-trading. No order confetti, flashing tickers or "hot stock" banners. Celebrations happen only on lesson completion and boss wins. "You followed your plan" is praised even after a loss.
- **Copy rules:** never "get rich", "easy money" or "beat the market". The single money-safety message lives in L1.3. Headlines inside scenarios use a calm style (no red flashing, no countdowns).

## B11. Remaining GDD §12 decisions, each with a proposal

| Open item                                                          | Proposal   |
| ------------------------------------------------------------------ | ---------- |
| Chapters, levels, objectives                                       | B4         |
| Unlock and boss rules                                              | B1         |
| Simulation rules, duration, profit, fees, ties, exits, disconnects | B2, B8     |
| AI behavior, difficulty, scenarios, opponent counts                | B2, B3, B4 |
| Currency names and costs                                           | B6         |
| Rating and premium rewards                                         | B8         |
| Shop                                                               | B6         |
| Assessment rubric and prior knowledge                              | B9         |
| Classroom quizzes and instructor tools                             | B7         |

## B12. Build notes: keep, replace, add

- **Keep:** auth, persistence, idempotent command replay, the economy ledger, lobbies and queue, quiz rooms, append-only migrations. Saved attempts stay pinned to their old editions.
- **Replace:**
  - `catalog.json`: new edition, schema 2, with `cards[]` (type, text, interactive spec), `missions[]`, `bonus`, `drills[]`.
  - `engine.py`: becomes engine v2 with OHLC, volume, news, scripts, next-open fills, $5 commission, no global cap, order types unlocked by progress.
  - `challenges/profiles.py`: replaced by the named personalities and tiers.
  - Boss definitions: become script families with a seed per attempt.
  - Daily: rotates scripts by weekday.
  - The four free-text plan fields: replaced by the structured plan.
- **Remove from the critical path:** per-module diagnostics, module checks and delayed reviews as gates (they move to Quiz Mode). Each of these changes needs owner sign-off because AGENTS.md currently treats them as contracts.
