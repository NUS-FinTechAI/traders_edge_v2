import type { Challenge } from '../services/challengeService.ts'

export function challenge(tick = 0): Challenge {
  return {
    id: 'attempt-one',
    challenge_id: 'practice-foundation-1',
    mode: 'practice',
    module_id: null,
    attempt_number: 1,
    version: 'shared-ai-1',
    status: 'active',
    policy: {
      version: 'shared-ai-1',
      ticks: 30,
      starting_value: '10000.00',
      profit:
        'final_cash_plus_holdings_at_mid_minus_starting_value_net_of_paid_fees',
      ties: 'joint_rank_human_must_strictly_outperform_every_opponent_to_win',
      liquidity:
        'equal_independent_capacity_per_participant_at_each_observation',
      early_exit: 'abandoned_without_result_or_reward',
      resume: 'saved_attempt_without_wall_clock_deadline',
      objective: 'Compare planned outcomes',
      provenance: 'Synthetic fixture',
      difficulty: 'foundation',
    },
    player: {
      version: 1,
      tick,
      total_ticks: 30,
      scenario: 'Controlled synthetic practice',
      finished: false,
      cash: '10000.00',
      available_cash: '10000.00',
      equity: '10000.00',
      fees: '0.00',
      positions: [],
      orders: [],
      fills: [],
      quotes: [
        {
          symbol: 'NORTH',
          mid: '40.00',
          bid: '39.96',
          ask: '40.04',
          available_units: 5,
        },
      ],
      history: { NORTH: Array.from({ length: tick + 1 }, () => '40.00') },
      benchmark_value: '10000.00',
      max_drawdown_percent: '0.00',
      reflection: null,
      rules: {
        max_asset_weight_percent: 25,
        shorting: false,
        leverage: 1,
        fee_rate: '0.001',
        first_fill_fee: '1.00',
        spread_percent: '0.2',
        settlement: 'Immediate',
        benchmark: 'Equal basket',
      },
    },
    opponents: [{ id: 'ai-1', display_name: 'Opponent 1', tick }],
    result: null,
  }
}

export function completedChallenge(): Challenge {
  const value = challenge(29)
  value.status = 'completed'
  value.player.finished = true
  value.player.reflection =
    'I followed the written plan and compared outcomes after costs.'
  value.result = {
    attempt_id: value.id,
    user_id: 'owner',
    mode: value.mode,
    module_id: null,
    challenge_id: value.challenge_id,
    attempt_number: 1,
    final_tick: 29,
    policy_version: 'shared-ai-1',
    win: false,
    profit: '0.00',
    leaderboard: ['ai-1', 'human'].map((participant_id) => ({
      participant_id,
      display_name: participant_id,
      rank: 1,
      profit: '0.00',
      final_value: '10000.00',
      fees: '0.00',
    })),
  }
  return value
}

export function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}
