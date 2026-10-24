import Button, { ButtonLink } from '../../ui/Button.tsx'
import Emblem from '../../ui/Emblem.tsx'
import type { EmblemName } from '../../ui/emblemArt.tsx'
import type { EmblemTone } from '../../ui/Emblem.tsx'
import Logo from '../../ui/Logo.tsx'
import usePlayNow from './usePlayNow.ts'
import styles from './Home.module.css'

const FEATURES: {
  emblem: EmblemName
  tone: EmblemTone
  title: string
  text: string
}[] = [
  {
    emblem: 'map',
    tone: 'gold',
    title: 'Learn by playing',
    text: 'Short lessons and quick checks on a chapter map.',
  },
  {
    emblem: 'swords',
    tone: 'green',
    title: 'Beat AI rivals',
    text: 'Trade against named rivals, each with their own style.',
  },
  {
    emblem: 'users',
    tone: 'gem',
    title: 'Play together',
    text: 'Real-time matches with friends, your class or ranked rivals.',
  },
]

export default function Landing() {
  const { playNow, busy } = usePlayNow()
  return (
    <div className={styles.landing}>
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroArt} aria-hidden="true">
          <Emblem name="map" size={112} tone="gold" />
          <Logo size={64} className={styles.heroBadge} />
        </div>
        <h1 id="landing-title" className={styles.heroTitle}>
          Trader’s Edge
        </h1>
        <p className={styles.pitch}>
          Learn to trade by playing. Lessons, trading missions, AI rivals and
          real-time matches, all with simulated money.
        </p>
        <div className={styles.heroActions}>
          <Button
            size="lg"
            icon="play"
            disabled={busy}
            onClick={() => void playNow()}
          >
            {busy ? 'Setting up…' : 'Play now'}
          </Button>
          <ButtonLink to="/adventure" variant="secondary" size="lg" icon="map">
            See the map
          </ButtonLink>
        </div>
      </section>
      <ul className={styles.features}>
        {FEATURES.map((feature) => (
          <li key={feature.title} className={styles.feature}>
            <Emblem name={feature.emblem} tone={feature.tone} size={56} />
            <div>
              <h2 className={styles.featureTitle}>{feature.title}</h2>
              <p className={styles.featureText}>{feature.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.footnote}>Simulated money · fictional companies</p>
    </div>
  )
}
