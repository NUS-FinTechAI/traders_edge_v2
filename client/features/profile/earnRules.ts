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
  amount?: string
  to: string
  note?: string
}

export interface EarnInfo {
  label: string
  summary: string
  rows: EarnRow[]
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

export const EARN: Record<EarnTopic, EarnInfo> = {
  doubloons: {
    label: 'Doubloons',
    summary:
      'Weekly coins for the weekly title. They reset to 0 every Monday at 00:00 UTC.',
    rows: [
      {
        source: 'Daily login reward',
        to: '/',
        amount: `${range(LOGIN_DOUBLOONS)} a day`,
        note: 'Claim it on Home. More on later streak days.',
      },
      {
        source: 'Win the daily challenge',
        to: '/play/daily',
        amount: '200',
        note: 'First win each day. Opens after the Chapter 1 boss.',
      },
    ],
  },
  gems: {
    label: 'Gems',
    summary:
      'Shop currency from ranked matches only. Gems never expire and are never sold for real money.',
    rows: [
      {
        source: 'Ranked win',
        to: '/multiplayer',
        amount: '+15',
        note: 'A win counts when an opponent also traded.',
      },
      {
        source: 'First ranked win of the day',
        to: '/multiplayer',
        amount: '+10 extra',
      },
      {
        source: 'Ranked loss with at least one order',
        to: '/multiplayer',
        amount: '+5',
      },
    ],
  },
  xp: {
    label: 'XP',
    summary:
      'XP raises your level. It comes from learning and finishing matches, never from orders, trade count or volume.',
    rows: [
      {
        source: 'Finish a level’s check',
        to: '/adventure',
        amount: '10',
        note: 'First time.',
      },
      {
        source: 'Level stars: normal / special',
        to: '/adventure',
        amount: '20 / 10',
        note: 'First time each.',
      },
      {
        source: 'Play a Preview Battle to the end',
        to: '/adventure',
        amount: '10',
      },
      {
        source: 'Win a Gate or Chapter Boss',
        to: '/play/bosses',
        amount: '50',
        note: 'First win.',
      },
      {
        source: 'Pass a chapter quiz / mixed mastery',
        to: '/quiz',
        amount: '20 / 50',
        note: 'Score 80% or more, first pass.',
      },
      {
        source: 'Daily review quiz',
        to: '/quiz/daily',
        amount: '10',
        note: 'Once a day.',
      },
      {
        source: 'Daily challenge: finish / win',
        to: '/play/daily',
        amount: '15 + 15',
        note: 'Once a day each.',
      },
      {
        source: 'Finish a practice match',
        to: '/play/practice',
        amount: '10',
        note: 'Up to 3 a day.',
      },
      {
        source: 'Ranked match: loss / win',
        to: '/multiplayer',
        amount: '10 / 20',
        note: 'Up to 5 a day.',
      },
      { source: 'Daily login reward', to: '/', amount: range(LOGIN_XP) },
    ],
  },
  streak: {
    label: 'Streak',
    summary:
      'Claim the login reward on Home once per UTC day. Each day in a row adds one; a missed day restarts at day 1, with no other penalty.',
    rows: [
      {
        source: 'Daily check-in',
        to: '/',
        note: 'Go to Home to claim your daily login reward.',
      },
    ],
  },
}
