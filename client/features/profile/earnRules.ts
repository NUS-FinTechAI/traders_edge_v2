/**
 * How players earn Doubloons, Gems, XP and login streaks. The amounts repeat
 * the server's rules (docs/reference/progression.md): player/service.py
 * (login), campaign/daily.py (daily challenge), campaign/settlement.py
 * (ranked, practice), campaign/progress.py (levels, bosses) and
 * quiz/service.py (quizzes). Change both together.
 */

export type EarnTopic = 'doubloons' | 'gems' | 'xp' | 'streak'

export interface EarnRow {
  source: string
  amount: string
  note?: string
}

export interface EarnInfo {
  label: string
  summary: string
  rows: EarnRow[]
  notes: string[]
}

/** Login reward for streak days 1–7; the cycle then repeats. */
export const LOGIN_DOUBLOONS = [20, 20, 20, 30, 30, 30, 50] as const
export const LOGIN_XP = [10, 10, 10, 10, 20, 20, 20] as const

export const EARN_TOPICS: readonly EarnTopic[] = [
  'doubloons',
  'gems',
  'xp',
  'streak',
]

function range(values: readonly number[]): string {
  const low = Math.min(...values)
  const high = Math.max(...values)
  return low === high ? `${low}` : `${low}–${high}`
}

/** Group consecutive cycle days with the same reward ("Days 1–3"). */
export function streakRows(
  doubloons: readonly number[] = LOGIN_DOUBLOONS,
  xp: readonly number[] = LOGIN_XP,
): EarnRow[] {
  const rows: EarnRow[] = []
  let first = 0
  for (let day = 1; day <= doubloons.length; day++) {
    const next =
      day < doubloons.length &&
      doubloons[day] === doubloons[first] &&
      xp[day] === xp[first]
    if (next) continue
    rows.push({
      // Word joiners keep "Days 5–6" on one line.
      source: first + 1 === day ? `Day ${day}` : `Days ${first + 1}⁠–⁠${day}`,
      amount: `${doubloons[first]} Doubloons · ${xp[first]} XP`,
    })
    first = day
  }
  return rows
}

export const EARN: Record<EarnTopic, EarnInfo> = {
  doubloons: {
    label: 'Doubloons',
    summary:
      'Weekly coins for the weekly title. They reset to 0 every Monday at 00:00 UTC.',
    rows: [
      {
        source: 'Daily login reward',
        amount: `${range(LOGIN_DOUBLOONS)} a day`,
        note: 'Claim it on Home. More on later streak days.',
      },
      {
        source: 'Win the daily challenge',
        amount: '200',
        note: 'First win each day. Opens after the Chapter 1 boss.',
      },
    ],
    notes: ['Spend them on the weekly title (1,000 Doubloons).'],
  },
  gems: {
    label: 'Gems',
    summary:
      'Shop currency from ranked matches only. Gems never expire and are never sold for real money.',
    rows: [
      {
        source: 'Ranked win',
        amount: '+15',
        note: 'A win counts when an opponent also traded.',
      },
      { source: 'First ranked win of the day', amount: '+10 extra' },
      { source: 'Ranked loss with at least one order', amount: '+5' },
    ],
    notes: [
      'Gems are paid for up to 5 ranked matches a day (UTC). Forfeits pay nothing.',
      'Ranked opens after you win the Chapter 3 boss.',
      'Spend them on shop cosmetics, or 20 Gems to skip a daily-challenge wait.',
    ],
  },
  xp: {
    label: 'XP',
    summary:
      'XP raises your level. It comes from learning and finishing matches, never from orders, trade count or volume.',
    rows: [
      { source: 'Finish a level’s check', amount: '10', note: 'First time.' },
      {
        source: 'Level stars: normal / special',
        amount: '20 / 10',
        note: 'First time each.',
      },
      { source: 'Play a Preview Battle to the end', amount: '10' },
      {
        source: 'Win a Gate or Chapter Boss',
        amount: '50',
        note: 'First win.',
      },
      {
        source: 'Pass a chapter quiz / mixed mastery',
        amount: '20 / 50',
        note: 'Score 80% or more, first pass.',
      },
      { source: 'Daily review quiz', amount: '10', note: 'Once a day.' },
      {
        source: 'Daily challenge: finish / win',
        amount: '15 + 15',
        note: 'Once a day each.',
      },
      {
        source: 'Finish a practice match',
        amount: '10',
        note: 'Up to 3 a day.',
      },
      {
        source: 'Ranked match: loss / win',
        amount: '10 / 20',
        note: 'Up to 5 a day.',
      },
      { source: 'Daily login reward', amount: range(LOGIN_XP) },
    ],
    notes: [
      'Level 1 to 2 costs 100 XP; each level after that costs 25 more.',
      'Forfeits and private lobby matches give no XP.',
    ],
  },
  streak: {
    label: 'Streak',
    summary:
      'Claim the login reward on Home once per UTC day. Each day in a row adds one; a missed day restarts at day 1, with no other penalty.',
    rows: streakRows(),
    notes: ['After day 7 the rewards start again from day 1.'],
  },
}
