import Chip from './Chip.tsx'
import Emblem, { type EmblemTone } from './Emblem.tsx'

type ChipTone = 'flame' | 'neutral' | 'gold' | 'info' | 'gem'

const TIERS: Record<string, { chip: ChipTone; emblem: EmblemTone }> = {
  bronze: { chip: 'flame', emblem: 'flame' },
  silver: { chip: 'neutral', emblem: 'neutral' },
  gold: { chip: 'gold', emblem: 'gold' },
  platinum: { chip: 'info', emblem: 'info' },
  diamond: { chip: 'gem', emblem: 'gem' },
}

function look(tier: string) {
  return TIERS[tier.toLowerCase()] ?? TIERS.bronze
}

/** Ranked tier as a labelled chip. */
export default function TierBadge({ tier }: { tier: string }) {
  return (
    <Chip tone={look(tier).chip} icon="shield">
      {tier}
    </Chip>
  )
}

/** Large ranked tier crest. */
export function TierCrest({
  tier,
  size = 88,
}: {
  tier: string
  size?: number
}) {
  return (
    <Emblem
      name="gem"
      tone={look(tier).emblem}
      size={size}
      shape="circle"
      label={`${tier} tier`}
    />
  )
}
