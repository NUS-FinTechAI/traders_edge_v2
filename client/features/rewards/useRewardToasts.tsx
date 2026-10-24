import { useEffect } from 'react'
import type { GameResult } from '../../services/gameService.ts'
import { useCelebrate } from '../../ui/toastContext.ts'
import RewardPicture from './RewardPicture.tsx'
import { browserSeenStore, rewardToasts, takeUnseen } from './rewardToasts.ts'

/** Celebrates each new badge or cosmetic from a finished game, once. */
export default function useRewardToasts(
  gameId: string,
  rewards: GameResult['rewards'],
) {
  const celebrate = useCelebrate()
  useEffect(() => {
    const fresh = takeUnseen(rewardToasts(gameId, rewards), browserSeenStore)
    for (const reward of fresh) {
      celebrate({
        key: reward.key,
        heading: reward.heading,
        name: reward.name,
        art: <RewardPicture reward={reward} />,
        action: { label: 'View in collection', to: '/profile' },
      })
    }
  }, [gameId, rewards, celebrate])
}
