import Chip from './Chip.tsx'
import Emblem, { type EmblemTone } from './Emblem.tsx'
import type { RatingTier } from '../api/api-enums.ts'

type ChipTone = 'flame' | 'neutral' | 'gold' | 'info' | 'gem'

const TIERS: Record<
  RatingTier,
  { label: string; chip: ChipTone; emblem: EmblemTone }
> = {
  bronze: { label: 'Bronze', chip: 'flame', emblem: 'flame' },
  silver: { label: 'Silver', chip: 'neutral', emblem: 'neutral' },
  gold: { label: 'Gold', chip: 'gold', emblem: 'gold' },
  platinum: { label: 'Platinum', chip: 'info', emblem: 'info' },
  diamond: { label: 'Diamond', chip: 'gem', emblem: 'gem' },
}

function look(tier: RatingTier) {
  return TIERS[tier]
}

/** Ranked tier as a labelled chip. */
export default function TierBadge({ tier }: { tier: RatingTier }) {
  return (
    <Chip tone={look(tier).chip} icon="shield">
      {look(tier).label}
    </Chip>
  )
}

/** Large ranked tier crest. */
export function TierCrest({
  tier,
  size = 88,
}: {
  tier: RatingTier
  size?: number
}) {
  return (
    <Emblem
      name="shield"
      tone={look(tier).emblem}
      size={size}
      shape="circle"
      label={`${look(tier).label} tier`}
    />
  )
}
