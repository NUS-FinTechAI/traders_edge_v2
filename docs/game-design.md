# **Trader’s Edge: Game Design Document**

**Platform:** Web browser  
**Purpose:** Trading education, competitive gameplay, and research into learning outcomes

## **1\. Game Overview**

The application is a gamified stock trading platform where players learn and practise trading through simulated challenges. It combines structured lessons, AI opponents, multiplayer competitions, daily challenges, and optional quizzes.

The application supports both independent learning and classroom use. It also serves as a research platform for examining how players with different levels of prior trading knowledge learn and apply trading concepts.

Trading performance determines the outcome of competitions, while learning assessment considers both performance and the decisions made during gameplay.

## **2\. Design Objectives**

The application aims to:

- Teach trading terminology and techniques through a progression from basic to advanced topics.
- Give players opportunities to apply their knowledge against AI opponents and other players.
- Encourage continued participation through daily challenges, collectible rewards, and ranked competition.
- Support classroom activities through private multiplayer lobbies and quizzes.
- Capture gameplay evidence that helps researchers evaluate learning beyond quiz scores.

## **3\. Shared Trading Challenge Rules**

### **3.1 Challenge Formats**

Stock trading challenges support the following formats:

- One player against one AI opponent.
- One player against multiple AI opponents trading simultaneously.
- Multiple human players competing in the same multiplayer session.

The number of AI opponents and the scenario used depend on the challenge.

### **3.2 Results and Leaderboards**

Every stock trading challenge ends with a leaderboard that ranks participants by total profit.

For AI challenges, the player wins by finishing first. In challenges with multiple AI opponents, the player must outperform all opponents.

For multiplayer matches, the player with the highest total profit wins.

### **3.3 Profit Calculation**

The exact definition of total profit must be standardized across all trading modes.

**Proposed calculation:**

Total profit \= final portfolio value − starting portfolio value

Final portfolio value includes available cash and the end-of-challenge market value of any remaining holdings.

The treatment of transaction fees, ties, early exits, and disconnected players remains to be defined. Challenge duration and starting conditions also require specification.

## **4\. Adventure Mode**

### **4.1 Chapter Structure**

Adventure Mode provides a structured learning journey divided into chapters. Chapters progress from basic trading terminology and concepts to more advanced techniques.

Each chapter contains multiple levels displayed through an adventure map interface. Levels introduce concepts and provide missions that allow players to practise them.

### **4.2 Missions and Stars**

Each level includes basic missions and may include bonus missions.

- **Normal star:** Awarded for completing the basic missions.
- **Special star:** Awarded for completing the bonus missions.

Bonus missions provide additional goals for players who want to demonstrate deeper understanding or pursue full completion.

Chapter cards display completion progress, including earned stars, to help players identify unfinished content and encourage further exploration.

### **4.3 Prerequisite Boss Fights**

Each chapter, except Chapter 1, has a prerequisite boss fight against AI. This challenge assesses whether the player has the knowledge needed to enter the chapter.

Players may attempt a chapter’s prerequisite boss fight before unlocking it through normal progression. Passing the fight unlocks that chapter, allowing experienced players to enter at an appropriate level.

Before an early attempt, the application displays a friendly message recommending sequential learning for beginners.

### **4.4 Post-Chapter Boss Fights**

Each chapter ends with a boss fight that evaluates the player’s ability to apply the concepts taught in that chapter.

Prerequisite and post-chapter boss fights provide assessment points before and after learning. Chapter 1 requires a separate introductory assessment if a pre-learning measurement is needed.

Boss fights follow the shared trading challenge rules and conclude with a profit-based leaderboard.

## **5\. AI Challenge Design**

### **5.1 AI Opponents**

AI challenges place players against one or more AI trading agents in a shared simulated trading scenario.

In multi-agent challenges, all AI opponents trade simultaneously with the player. The player passes by achieving first place in total profit.

### **5.2 Educational Role**

AI challenges give players opportunities to apply concepts through trading decisions. They also provide opportunities to observe player behaviour for research assessment.

Scenarios should have identifiable learning objectives so that recorded actions can be interpreted in relation to the concepts being assessed.

Furthermore, the challenges should not be easily beatable by players who are simply “button smashing” without a purpose. Daily AI challenges can vary in difficulty, whereas chapter challenges should have a progressive increment in difficulty.

AI strategies, difficulty levels, scenario generation, and the number of opponents per challenge remain to be defined.

## **6\. Daily Challenges**

### **6.1 Daily Challenge Format**

The daily challenge presents a custom trading scenario against one AI opponent.

The player wins by earning a higher total profit than the AI. Each attempt ends with a leaderboard showing the result.

### **6.2 Victory Rewards**

Winning awards a custom reward currency that contributes toward a weekly cosmetic reward.

Example weekly reward structure:

| Item                       | Example                            |
| -------------------------- | ---------------------------------- |
| Weekly reward              | “Colossal Challenger” player title |
| Required currency          | 1,000 Stocks                       |
| Currency per daily victory | 200 Stocks                         |
| Required daily victories   | Five within seven days             |

“Stocks” is a working name for the reward currency. It should be clearly distinguished from tradable shares and simulated trading funds.

**Reward limit:** Only the first victory each day grants weekly reward currency. This preserves the intended requirement to win on five separate days.

### **6.3 Defeat and Retry Rules**

After losing, the player can:

- Wait for a two-hour cooldown to expire.
- Spend premium currency to refresh the challenge immediately.

The premium currency cost, daily reset time, and handling of a cooldown across the daily reset remain to be defined.

### **6.4 Daily Streak**

Players can log in each day to claim rewards and build a daily login streak. Rewards may include:

- **Player XP:** Contributes toward player level progression.
- **Stocks:** Contributes toward the current weekly reward.

Consecutive daily logins advance the streak. Daily login rewards can be claimed once per day and are separate from daily challenge victory rewards.

Stocks earned through login rewards follow the same weekly expiry rules as Stocks earned through daily challenges. This provides an additional way to progress toward the weekly reward, potentially reducing the number of daily challenge victories required.

## **7\. Rewards and Currency**

### **7.1 Daily Challenge Currency**

Daily challenge currency rewards successful participation and progresses players toward weekly rewards.

Possible rewards include:

- Avatar icons.
- Player titles.
- Badges.

Unspent currency from the week expires and the progress resets in a brand new week.

### **7.2 Premium Currency**

Premium currency is earned through ranked multiplayer progression.

Players may spend it to:

- Refresh daily challenges after a defeat.
- Purchase premium rewards from the shop.

The earning rates, refresh costs, shop inventory, and reward prices remain to be defined. Real-money purchasing is not specified in the current design.

### **7.3 Separation of Funds**

The interface should clearly distinguish between:

- Simulated funds used to trade during challenges.
- Currency earned through daily challenges.
- Premium currency earned through ranked progression.

These resources serve different purposes and should have distinct names and visual indicators.

All challenges except private lobbies reward some amount of XP that contribute to the player’s level.

## **8\. Multiplayer Mode**

### **8.1 Lobby Creation and Joining**

Multiplayer uses a lobby-based system with at least two players.

One player creates a lobby and becomes the host. The application generates a join code that the host can share outside the application.

Other players enter the code within the application to join the lobby.

### **8.2 Match Flow**

1. A player creates a lobby.
2. The host shares the join code.
3. Other players enter the code and join.
4. Once at least two players are present, the host starts the match.
5. Players compete in a trading challenge.
6. The match ends with a leaderboard ranked by total profit.

Maximum lobby size, host controls, match settings, and disconnection handling remain to be defined.

### **8.3 Classroom Use**

Private lobbies allow instructors to organize trading activities among students.

The join-code system supports grouping participants into a shared session without requiring in-app messaging.

## **9\. Ranked Progression and Global Leaderboard**

The application includes a global multiplayer leaderboard ranked by player rating.

This is separate from the leaderboard displayed at the end of each match:

| Leaderboard                    | Ranking basis                 | Purpose                                   |
| ------------------------------ | ----------------------------- | ----------------------------------------- |
| Match leaderboard              | Total profit in one challenge | Determines the challenge winner           |
| Global multiplayer leaderboard | Player rank rating            | Shows competitive standing across matches |

Players improve their rating through ranked competition and can earn premium currency as they progress.

The rating formula, rank tiers, reward milestones, and any seasonal resets require further design.

Private classroom lobbies do not affect global ratings, only matches won via public matchmaking do.

## **10\. Learning Assessment and Research**

### **10.1 Research Goal**

The application supports a study of how players learn trading concepts with and without prior knowledge.

Assessment should examine both the outcomes players achieve and the decisions they make. A profitable result alone does not establish whether the player understood the concepts being assessed.

### **10.2 Behaviour Logging**

Player actions during AI challenges are recorded in the backend for later analysis.

**Proposed logged information includes:**

- Challenge identifier, scenario version, and difficulty.
- Relevant market information available when a decision was made.
- Buy and sell actions, including timing, quantity, and price.
- Cash balance and portfolio holdings over time.
- Exposure to individual stocks and changes in allocation.
- Realized and unrealized profit or loss.
- Attempt number, final profit, and leaderboard position.

Logs should include enough scenario context to interpret decisions, rather than recording actions in isolation.

### **10.3 Proposed Learning Measures**

Possible measures include:

- Improvement between pre-learning and post-learning challenges.
- Application of the concepts targeted by a scenario.
- Changes in risk-taking and portfolio concentration.
- Consistency across multiple challenges.
- Ability to apply knowledge to unfamiliar scenarios.
- Differences in learning gains between prior-knowledge groups.

These measures are proposed assessment inputs. A scoring rubric must be defined before they can be treated as a validated measure of learning.

### **10.4 Assessment Design Considerations**

Pre-learning and post-learning challenges should assess comparable concepts at comparable difficulty.

Research records should distinguish first attempts from retries, including retries enabled through premium currency. The study should also establish how prior knowledge is measured and how participant records are handled.

## **11\. Quiz Mode**

Quiz Mode allows players to test their understanding of trading terminology and concepts. Passing quizzes grants rewards, with reward types and amounts to be determined.

Quizzes are a supplementary learning activity rather than the primary research assessment because correct answers may be obtained through memorization, repeated attempts, or guessing.

In classroom settings, instructors may use quizzes to assess students’ knowledge alongside trading activities.

Instructor controls, question selection, attempt limits, and access to results remain to be defined.

## **12\. Outstanding Design Decisions**

The following decisions are required before implementation:

- Chapter topics, level content, and learning objectives.
- Exact chapter unlock and boss-fight progression rules.
- Trading simulation rules, challenge duration, and profit calculation.
- AI behaviour, difficulty, and scenario structure.
- Currency names and reward costs.
- Ranked rating calculations and premium currency rewards.
- Shop functionality and available cosmetics.
- Learning assessment rubric and prior-knowledge measurement.
- Classroom quiz and instructor features.
