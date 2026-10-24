import Avatar from '../../ui/Avatar.tsx'
import Emblem from '../../ui/Emblem.tsx'
import { badgeArt } from '../../ui/badgeArt.ts'
import type { RewardToast } from './rewardToasts.ts'

const ART_SIZE = 48

export default function RewardPicture({ reward }: { reward: RewardToast }) {
  if (reward.kind === 'avatar')
    return <Avatar id={reward.id} image={reward.image} size={ART_SIZE} />
  if (reward.kind === 'badge')
    return (
      <Emblem
        name={badgeArt(reward.id)}
        tone="gold"
        size={ART_SIZE}
        shape="circle"
      />
    )
  return (
    <Emblem
      name={reward.kind === 'title' ? 'scroll' : 'medal'}
      tone="gem"
      size={ART_SIZE}
      shape="circle"
    />
  )
}
