import Icon from './Icon.tsx'
import styles from './ui.module.css'

interface StarsProps {
  normal: boolean
  special: boolean
  size?: number
}

/** A level's normal (gold) and special (gem) stars with a text equivalent. */
export default function Stars({ normal, special, size = 18 }: StarsProps) {
  const label = `${normal ? 'Normal star earned' : 'Normal star not earned'}, ${special ? 'special star earned' : 'special star not earned'}`
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
