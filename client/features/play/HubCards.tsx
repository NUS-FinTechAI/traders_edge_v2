import { ButtonLink } from '../../ui/Button.tsx'
import Emblem from '../../ui/Emblem.tsx'
import type { EmblemName } from '../../ui/emblemArt.tsx'
import styles from './HubCards.module.css'

export interface HubCard {
  to: string
  emblem: EmblemName
  tone: 'gold' | 'gem' | 'info' | 'green'
  title: string
  text: string
  cta: string
  primary?: boolean
}

const COLUMNS: Record<number, string> = { 3: 'three', 4: 'four' }

/** Mode cards that each open their own page, styled like Home's mode cards. */
export default function HubCards({
  cards,
  label,
}: {
  cards: HubCard[]
  label: string
}) {
  return (
    <ul
      className={[styles.cards, styles[COLUMNS[cards.length] ?? '']]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
    >
      {cards.map((card) => (
        <li key={card.to} className={styles.card}>
          <div className={`${styles.art} ${styles[card.tone]}`}>
            <Emblem
              name={card.emblem}
              tone={card.tone}
              size={72}
              shape="none"
            />
          </div>
          <h2 className={styles.title}>{card.title}</h2>
          <p className={styles.text}>{card.text}</p>
          <ButtonLink
            to={card.to}
            variant={card.primary ? 'primary' : 'secondary'}
            iconRight="chevron-right"
            block
            aria-label={`${card.cta}: ${card.title}`}
          >
            {card.cta}
          </ButtonLink>
        </li>
      ))}
    </ul>
  )
}
