import Icon from '../../ui/Icon.tsx'
import styles from './Adventure.module.css'

export default function StarLegend() {
  return (
    <ul className={styles.legend} aria-label="Star legend">
      <li>
        <Icon name="star" size={18} filled className={styles.starIcon} />
        Standard mission
      </li>
      <li>
        <Icon name="sparkle" size={18} filled className={styles.gemIcon} />
        Bonus mission
      </li>
    </ul>
  )
}
