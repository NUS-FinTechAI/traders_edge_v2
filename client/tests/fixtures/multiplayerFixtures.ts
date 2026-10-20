import type {
  MultiplayerMatch,
  MultiplayerOrder,
} from '../../services/multiplayerService.ts'
import { challenge, memoryStorage } from './challengeFixtures.ts'
export { memoryStorage }

export const plannedOrder: MultiplayerOrder = {
  symbol: 'NORTH',
  side: 'buy',
  type: 'limit',
  quantity: 2,
  price: '39.00',
  plan: {
    reason: 'Test the fictional thesis with a bounded position.',
    risk: 'The market may decline or the limit may never fill.',
    exit: 'Review the thesis after the next five observations.',
    size_reason: 'Keep this position small relative to the cash balance.',
    max_loss: '20.00',
  },
}

export function multiplayer(tick: number | null = 0): MultiplayerMatch {
  return {
    id: 'match-one',
    host_id: 'owner',
    mode: 'private',
    status: tick === null ? 'waiting' : 'active',
    version: 'shared-multiplayer-1',
    attempt_number: 1,
    policy: {
      version: 'shared-multiplayer-1',
      ticks: 30,
      starting_value: '10000.00',
      profit: 'net_profit',
      ties: 'joint_rank_and_draw_for_rating',
      liquidity: 'equal_independent_capacity',
      advance: 'all_ready',
      disconnect: 'resume_without_deadline',
      forfeit: 'below_finishers',
      rating: 'public_elo',
      provenance: 'Controlled synthetic practice',
    },
    participants: [
      {
        user_id: 'owner',
        display_name: 'First player',
        ready: false,
        forfeit: false,
        departed: false,
        completed: false,
      },
      {
        user_id: 'peer',
        display_name: 'Second player',
        ready: false,
        forfeit: false,
        departed: false,
        completed: false,
      },
    ],
    player: tick === null ? null : challenge(tick).player,
    result: null,
    awards: null,
  }
}
