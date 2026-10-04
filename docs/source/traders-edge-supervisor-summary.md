# Trader’s Edge: FYP Research Summary

## Project Aim

Trader’s Edge is being redesigned as a mobile-first educational platform that teaches complete beginners how to make informed financial and trading decisions through short lessons, guided missions and realistic simulations.

The intention is to retain the strongest elements of the existing project while rebuilding it in a cleaner repository with a coherent curriculum, safer gamification and independently useful learning modules.

## Research Conducted

The proposed redesign was informed by:

- Investor-education frameworks from IOSCO, OECD, SEC, FINRA, CFTC, CME Group and CFA Institute
- Research on financial education, active learning, retrieval practice, feedback and simulation
- Regulatory and academic research on trading-app gamification and retail-investor behavior

The research examined curriculum sequencing, beginner prerequisites, simulation design, assessment, mobile learning and the risks of encouraging excessive trading.

## Main Finding

There is no single universally accepted syllabus for teaching trading. However, authoritative curricula consistently support the following sequence:

> **Financial readiness and risk → investing fundamentals → market execution → optional speculative trading.**

Beginners should understand goals, time horizon, emergency savings, risk, diversification, fees and investor protection before learning trading strategies or advanced products.

This changes the role of Trader’s Edge. It should not be a trading game with lessons attached. It should be:

> **A financial decision-making academy supported by a trading simulator.**

## Proposed Curriculum

The recommended learning path is:

1. **Money Before Markets** — saving, investing, trading, speculation, financial goals and risk capacity.
2. **How Markets Work** — assets, brokers, exchanges, prices, liquidity and bid–ask spreads.
3. **Investment Products** — stocks, bonds, funds and ETFs, including their risks, costs and return sources.
4. **Building a Portfolio** — diversification, asset allocation, concentration, rebalancing and benchmarks.
5. **Safe Execution** — market, limit and stop orders; fills, slippage, fees and settlement.
6. **Managing Risk** — position exposure, maximum loss, drawdown, exits and risk/reward.
7. **Making Decisions** — developing a thesis, evaluating evidence and using analytical tools probabilistically.
8. **Psychology and Protection** — behavioral biases, conflicts, manipulation and fraud.
9. **Integrated Simulation** — planning, executing and reviewing decisions under varied market conditions.
10. **Optional Advanced Paths** — active trading, leverage, shorting, futures and options, unlocked only after prerequisite mastery.

Each module will follow a consistent cycle:

> **Question → short explanation → worked example → prediction → guided simulation → feedback → reflection → delayed review → mastery check**

## Simulator and Assessment Design

Simulated profit should not be treated as proof of competence. A reckless trade can make money through luck, while a sensible decision can lose because markets are uncertain.

Learners should instead be assessed on:

- Risk recognition and maximum-loss awareness
- Position-size and order-type reasoning
- Understanding of fees, spreads, slippage and liquidity
- Diversification and concentration awareness
- Probability calibration
- Adherence to a pre-written plan
- Ability to avoid an unsuitable trade
- Quality of post-decision reflection
- Retention and application in unfamiliar scenarios

The simulator should model realistic friction, including transaction costs, spreads, partial fills, slippage and unfavorable market paths. Learners should compare active decisions with an appropriate passive benchmark and review results across multiple scenarios rather than a single successful run.

## Gamification Approach

Gamification will prioritise rewarding learning and disciplined decision-making rather than frequent trading.

Appropriate rewards include completing lessons, identifying hidden risks, recognizing scams, following a risk plan, improving forecast calibration and maintaining a learning journal.

Once the learner has fully mastered trading techniques, they may do so via a multiplayer or endless mode where they can freely test their skills further.

Some gamification features we propose:

- Rewards on level completion and daily check-ins
- Each module will have a treasure map-based level UI
- Earn normal stars for passing and special stars for completion of bonus missions to provide a sense of completion
- Trading archive to store explanations of jargons and techniques.
- Player rank (Multiplayer)
- Global Leaderboard

Proposed game rewards:

- Experience points (For player level)
- Rank points (For player rank, gained from multiplayer only)
- Player titles, profile avatars, badges etc.

The platform should avoid:

- Profit leaderboards
- Rewards for trade count or volume
- Confetti after orders
- Urgent market alerts and countdowns
- Flashing “hot stock” displays
- One-swipe execution
- Default leverage
- Copy-trading mechanics

Regulatory experiments indicate that notifications, prize mechanics and other game-like trading features can increase trading frequency and exposure to higher-risk products. Therefore, the project will distinguish clearly between gamifying **education** and gamifying **financial risk-taking**.

## Elements Retained From the Existing Project

The redesign will preserve the strongest existing concepts:

- Mission-based progression
- Hands-on simulated decision-making
- Scenario-driven ticker playback
- Progressive unlocking
- Post-module checks
- Portfolio analytics
- Separation between lesson content and market simulation

The main changes will be to introduce risk and diversification earlier, delay technical and leveraged trading, add behavioral and fraud-awareness content, require a plan before each simulated trade, and reward the quality of the learner’s process rather than their final virtual balance.

## Technical and Content Direction

The rebuilt application should use a jurisdiction-neutral core curriculum. Region-specific rules—such as taxation, account types, settlement, margin requirements and investor-protection procedures—can be added through separate localization packs.

Ticker data should primarily support controlled historical or synthetic scenarios. Future outcomes should remain hidden, and scenarios should cover rising, falling, sideways and highly volatile markets to reduce hindsight bias and overconfidence.

## Proposed Evaluation

The FYP can evaluate whether the redesigned platform improves:

- Financial and market knowledge
- Retention after a delay
- Risk identification
- Decision quality in new scenarios
- Confidence calibration
- Ability to recognize unsuitable or fraudulent opportunities
- Player engagement without encouraging excessive simulated trading

The evaluation should not claim that the application makes users profitable traders. The defensible objective is to demonstrate improved financial understanding, safer decision-making and more disciplined simulated behavior.

## Conclusion

The research supports rebuilding Trader’s Edge around a foundations-first curriculum, guided practice, realistic simulation and safety-conscious gamification. The project’s distinctive contribution is not simply teaching users how to place trades; it is teaching beginners how to reason about uncertainty, risk and financial decisions before they act.

## Selected References

- [IOSCO–OECD Core Competencies Framework for Investors](https://www.oecd.org/content/dam/oecd/en/publications/reports/2019/09/iosco-oecd-core-competencies-framework-on-financial-education-for-investors_8c2e7afa/566ce90b-en.pdf)
- [FINRA Investing Basics](https://www.finra.org/investors/investing/investing-basics)
- [SEC Investor.gov: Introduction to Investing](https://www.investor.gov/introduction-investing)
- [CFA Investment Foundations Curriculum](https://store.cfainstitute.org/content/Investment-Foundations-Learning-Goals-and-Topics.pdf)
- [Financial Education and Downstream Behaviors](https://www.nber.org/papers/w27057.pdf)
- [FCA Research on Digital Engagement Practices](https://www.fca.org.uk/publications/fca-research/research-note-digital-engagement-practices-trading-apps-experiment)
- [ASIC Review of Online Trading Providers](https://download.asic.gov.au/media/lqsfve5y/rep778-published-6-december-2023.pdf)
