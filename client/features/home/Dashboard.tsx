import RequirePlayer from '../../app/RequirePlayer.tsx'
import { getCampaign, type Campaign } from '../../services/campaignService.ts'
import { getDaily } from '../../services/dailyService.ts'
import { getActivity, type Player } from '../../services/playerService.ts'
import Avatar from '../../ui/Avatar.tsx'
import { playerAvatarImage } from '../../ui/avatarImage.ts'
import { ButtonLink } from '../../ui/Button.tsx'
import Emblem, { type EmblemTone } from '../../ui/Emblem.tsx'
import type { EmblemName } from '../../ui/emblemArt.tsx'
import ProgressBar from '../../ui/ProgressBar.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { formatCount } from '../../ui/format.ts'
import useResource from '../../ui/useResource.ts'
import DailyCard from '../play/DailyCard.tsx'
import ResumeMatches from '../play/ResumeMatches.tsx'
import StreakCard from './StreakCard.tsx'
import styles from './Home.module.css'

const MODES: {
  to: string
  emblem: EmblemName
  tone: EmblemTone
  title: string
  text: string
  cta: string
}[] = [
  {
    to: '/adventure',
    emblem: 'map',
    tone: 'gold',
    title: 'Adventure',
    text: 'Learn trading step by step',
    cta: 'Continue',
  },
  {
    to: '/quiz',
    emblem: 'book',
    tone: 'gem',
    title: 'Quiz',
    text: 'Test your knowledge',
    cta: 'Start quiz',
  },
  {
    to: '/multiplayer',
    emblem: 'swords',
    tone: 'info',
    title: 'Multiplayer',
    text: 'Challenge friends and rivals',
    cta: 'Play',
  },
  {
    to: '/play/practice',
    emblem: 'infinity',
    tone: 'green',
    title: 'Practice Arena',
    text: 'Trade without limits',
    cta: 'Start',
  },
]

function Welcome({ player }: { player: Player }) {
  const pct = Math.round(
    (player.xp_into_level / Math.max(1, player.xp_for_next_level)) * 100,
  )
  return (
    <section className={styles.welcome} aria-labelledby="welcome-title">
      <Avatar
        id={player.avatar_id}
        image={playerAvatarImage(player)}
        size={64}
        level={player.level}
      />
      <div className={styles.welcomeText}>
        <h1 id="welcome-title" className={styles.welcomeTitle}>
          Welcome back, {player.display_name}
        </h1>
        <p className={styles.muted}>
          {player.rank_name} · Level {player.level}
        </p>
        <div className={styles.xpRow}>
          <ProgressBar
            value={player.xp_into_level}
            max={player.xp_for_next_level}
            label={`Progress to level ${player.level + 1}`}
            valueText={`${player.xp_into_level} of ${player.xp_for_next_level} XP`}
            className={styles.xpBar}
          />
          <span className={`num ${styles.xpText}`}>
            {formatCount(player.xp_into_level)} /{' '}
            {formatCount(player.xp_for_next_level)} XP · {pct}%
          </span>
        </div>
      </div>
    </section>
  )
}

function ContinueCard({ campaign }: { campaign: Campaign }) {
  const next = campaign.next
  if (!next)
    return (
      <section className={styles.continue} aria-labelledby="continue-title">
        <Emblem name="trophy" size={72} tone="gold" />
        <div className={styles.continueBody}>
          <p className={styles.eyebrow}>Adventure</p>
          <h2 id="continue-title" className={styles.continueTitle}>
            Every chapter is complete
          </h2>
          <p className={styles.muted}>Keep sharp in the Practice Arena.</p>
        </div>
        <ButtonLink to="/play/practice" size="lg" iconRight="chevron-right">
          Practice
        </ButtonLink>
      </section>
    )
  const chapter = campaign.chapters.find(({ id }) => id === next.chapter_id)
  return (
    <section className={styles.continue} aria-labelledby="continue-title">
      <Emblem name="map" size={72} tone="gold" />
      <div className={styles.continueBody}>
        <p className={styles.eyebrow}>
          {chapter ? `Continue · ${chapter.region}` : 'Next up'}
        </p>
        <h2 id="continue-title" className={styles.continueTitle}>
          {next.label}
        </h2>
        {chapter && (
          <p className={styles.muted}>
            {chapter.stars} / {chapter.stars_total} stars
          </p>
        )}
      </div>
      <ButtonLink
        to={`/adventure/${encodeURIComponent(next.chapter_id)}?node=${encodeURIComponent(next.node_id)}`}
        size="lg"
        iconRight="chevron-right"
      >
        Continue
      </ButtonLink>
    </section>
  )
}

export default function Dashboard() {
  return (
    <RequirePlayer label="Loading your camp…">
      {(player) => <Camp player={player} />}
    </RequirePlayer>
  )
}

function Camp({ player }: { player: Player }) {
  const activity = useResource(getActivity)
  const campaign = useResource(getCampaign)
  const daily = useResource(getDaily)

  return (
    <div className={styles.dashboard}>
      <Welcome player={player} />
      <ResumeMatches />
      <StreakCard
        player={player}
        activity={activity.data}
        onClaimed={activity.reload}
      />
      <div className={styles.split}>
        <ResourceView resource={campaign} label="Loading your map…">
          {(data) => <ContinueCard campaign={data} />}
        </ResourceView>
        <ResourceView resource={daily} label="Loading the daily…">
          {(data) => (
            <DailyCard
              daily={data}
              onChange={daily.reload}
              onReload={daily.reload}
            />
          )}
        </ResourceView>
      </div>
      <section aria-labelledby="modes-title">
        <h2 id="modes-title" className={styles.sectionTitle}>
          Ready to trade?
        </h2>
        <ul className={styles.modes}>
          {MODES.map((mode) => (
            <li key={mode.title} className={styles.mode}>
              <div className={`${styles.modeArt} ${styles[mode.tone]}`}>
                <Emblem
                  name={mode.emblem}
                  tone={mode.tone}
                  size={72}
                  shape="none"
                />
              </div>
              <h3 className={styles.modeTitle}>{mode.title}</h3>
              <p className={styles.modeText}>{mode.text}</p>
              <ButtonLink
                to={mode.to}
                variant={mode.title === 'Adventure' ? 'primary' : 'secondary'}
                block
              >
                {mode.cta}
              </ButtonLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
