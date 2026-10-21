import Icon from './Icon.tsx'
import styles from './ui.module.css'

interface StarsProps {
  normal: boolean
  special: boolean
  size?: number
}

/**
 * A level's Star (standard mission, gold) and Bonus star (bonus mission, gem):
 * filled when earned, hollow when not, with a text equivalent.
 */
export default function Stars({ normal, special, size = 18 }: StarsProps) {
  const label = `Star ${normal ? 'earned' : 'not earned'}, bonus star ${special ? 'earned' : 'not earned'}`
  return (
    <span className={styles.stars} role="img" aria-label={label}>
      <Icon
        name="star"
        size={size}
        filled={normal}
        className={normal ? styles.starOn : styles.starOff}
      />
      <Icon
        name="sparkle"
        size={size}
        filled={special}
        className={special ? styles.starSpecialOn : styles.starOff}
      />
    </span>
  )
}
