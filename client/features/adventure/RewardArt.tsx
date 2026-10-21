import type { Reward } from '../../services/campaignService.ts'
import Avatar from '../../ui/Avatar.tsx'
import { itemImage } from '../../ui/avatarImage.ts'
import Emblem from '../../ui/Emblem.tsx'

/** The picture for a map reward: the avatar itself, or a title/badge emblem. */
export default function RewardArt({
  reward,
  size,
  earned,
}: {
  reward: Reward
  size: number
  earned: boolean
}) {
  if (reward.kind === 'avatar')
    return <Avatar id={reward.id} image={itemImage(reward)} size={size} />
  return (
    <Emblem
      name={reward.kind === 'title' ? 'scroll' : 'medal'}
      tone={earned ? (reward.kind === 'title' ? 'gem' : 'gold') : 'neutral'}
      size={size}
      shape="circle"
    />
  )
}
