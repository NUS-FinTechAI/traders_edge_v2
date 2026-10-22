import Emblem from './Emblem.tsx'
import { badgeArt } from './badgeArt.ts'
import styles from './PlayerBadge.module.css'

export default function PlayerBadge({
  badge,
}: {
  badge: { id: string; name: string } | null
}) {
  if (!badge) return null
  return (
    <span className={styles.badge} title={badge.name}>
      <Emblem
        name={badgeArt(badge.id)}
        size={24}
        shape="circle"
        label={`Badge: ${badge.name}`}
      />
    </span>
  )
}
