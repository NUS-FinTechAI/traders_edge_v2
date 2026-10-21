import { useState } from 'react'
import { usePlayer } from '../../app/PlayerContext.ts'
import {
  updateMe,
  type Collection as CollectionData,
  type PlayerUpdate,
} from '../../services/playerService.ts'
import Avatar from '../../ui/Avatar.tsx'
import Button from '../../ui/Button.tsx'
import Chip from '../../ui/Chip.tsx'
import Emblem from '../../ui/Emblem.tsx'
import type { EmblemName } from '../../ui/emblemArt.tsx'
import Icon from '../../ui/Icon.tsx'
import ProgressBar from '../../ui/ProgressBar.tsx'
import Tabs from '../../ui/Tabs.tsx'
import { useToast } from '../../ui/toastContext.ts'
import { errorText } from '../../ui/useResource.ts'
import styles from './Profile.module.css'

type Tab = 'badges' | 'avatars' | 'titles'

const TABS = [
  { id: 'badges', label: 'Badges' },
  { id: 'avatars', label: 'Avatars' },
  { id: 'titles', label: 'Titles' },
] as const

const BADGE_ART: [RegExp, EmblemName][] = [
  [/step/, 'flag'],
  [/plan/, 'scroll'],
  [/learn/, 'bolt'],
  [/chart/, 'candles'],
  [/risk/, 'shield'],
  [/snip/, 'target'],
  [/fee/, 'coin'],
  [/cool|calm/, 'anchor'],
  [/patien/, 'lantern'],
  [/explor/, 'compass'],
  [/gate/, 'shield'],
  [/boss|slay/, 'crown'],
  [/streak/, 'flame'],
  [/quiz/, 'book'],
  [/rank/, 'trophy'],
  [/calibr/, 'telescope'],
]

function badgeArt(id: string): EmblemName {
  return BADGE_ART.find(([pattern]) => pattern.test(id))?.[1] ?? 'medal'
}

const MILESTONES = [5, 10, 20, 30, 40]

export default function Collection({
  data,
  onChange,
}: {
  data: CollectionData
  onChange: () => void
}) {
  const [tab, setTab] = useState<Tab>('badges')
  const { refreshPlayer } = usePlayer()
  const notify = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  async function equip(id: string, changes: PlayerUpdate, name: string) {
    setBusy(id)
    try {
      await updateMe(changes)
      notify(`${name} equipped`, 'success')
      await refreshPlayer()
      onChange()
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  const earned = data.badges.filter((badge) => badge.earned).length

  return (
    <section className={styles.panel} aria-label="Collection">
      <Tabs
        label="Collection"
        tabs={TABS}
        value={tab}
        onChange={setTab}
        idPrefix="collection"
      />
      <div
        role="tabpanel"
        id={`collection-panel-${tab}`}
        aria-labelledby={`collection-tab-${tab}`}
        className={styles.tabPanel}
      >
        {tab === 'badges' && (
          <>
            <p className={styles.muted}>
              {earned} of {data.badges.length} badges earned. Badges reward how
              you trade and learn, never profit size.
            </p>
            <ul className={styles.badges}>
              {data.badges.map((badge) => (
                <li
                  key={badge.id}
                  className={`${styles.badge} ${badge.earned ? '' : styles.badgeLocked}`}
                >
                  <span className={styles.badgeArt}>
                    <Emblem
                      name={badgeArt(badge.id)}
                      tone={badge.earned ? 'gold' : 'neutral'}
                      size={64}
                      shape="circle"
                    />
                    {!badge.earned && (
                      <span className={styles.badgeLock} aria-hidden="true">
                        <Icon name="lock" size={14} />
                      </span>
                    )}
                  </span>
                  <strong className={styles.badgeName}>{badge.name}</strong>
                  <span
                    className={badge.earned ? styles.earned : styles.lockedText}
                  >
                    {badge.earned ? 'Earned' : 'Locked'}
                  </span>
                  <span className={styles.badgeHow}>{badge.description}</span>
                  {!badge.earned && badge.progress && (
                    <span className={`num ${styles.badgeProgress}`}>
                      {badge.progress}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <h3 className={styles.subTitle}>Level milestones</h3>
            <ul className={styles.milestones}>
              {MILESTONES.map((goal) => {
                const value = Math.min(goal, data.stats.levels_done)
                return (
                  <li key={goal} className={styles.milestone}>
                    <Emblem
                      name="star"
                      size={40}
                      shape="circle"
                      tone={value >= goal ? 'gold' : 'neutral'}
                    />
                    <span className={styles.milestoneText}>
                      <strong>{goal} levels</strong>
                      <span className="num">
                        {value} / {goal}
                      </span>
                    </span>
                    <ProgressBar
                      value={value}
                      max={goal}
                      tone="gold"
                      label={`${goal} levels milestone`}
                      className={styles.milestoneBar}
                    />
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {tab === 'avatars' && (
          <ul className={styles.avatars}>
            {data.avatars.map((avatar) => (
              <li
                key={avatar.id}
                className={[
                  styles.avatarItem,
                  avatar.equipped && styles.equipped,
                  !avatar.owned && styles.badgeLocked,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <Avatar id={avatar.id} size={72} />
                <strong className={styles.badgeName}>{avatar.name}</strong>
                {avatar.equipped ? (
                  <Chip tone="gain" icon="check">
                    Equipped
                  </Chip>
                ) : avatar.owned ? (
                  <Button
                    variant="secondary"
                    disabled={!!busy}
                    onClick={() =>
                      void equip(
                        avatar.id,
                        { avatar_id: avatar.id },
                        avatar.name,
                      )
                    }
                    aria-label={`Equip ${avatar.name}`}
                  >
                    Equip
                  </Button>
                ) : (
                  <>
                    <span className={styles.lockedText}>
                      <Icon name="lock" size={14} /> Locked
                    </span>
                    <span className={styles.badgeHow}>{avatar.how}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {tab === 'titles' && (
          <ul className={styles.titles}>
            {data.titles.map((title) => (
              <li
                key={title.id}
                className={[
                  styles.titleItem,
                  title.equipped && styles.equipped,
                  !title.owned && styles.badgeLocked,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <Emblem
                  name="scroll"
                  size={44}
                  tone={title.owned ? 'gem' : 'neutral'}
                />
                <span className={styles.titleText}>
                  <strong>{title.name}</strong>
                  <span className={styles.badgeHow}>
                    {title.owned ? 'Unlocked' : title.how}
                  </span>
                </span>
                {title.equipped ? (
                  <Chip tone="gain" icon="check">
                    Equipped
                  </Chip>
                ) : title.owned ? (
                  <Button
                    variant="secondary"
                    disabled={!!busy}
                    onClick={() =>
                      void equip(title.id, { title_id: title.id }, title.name)
                    }
                    aria-label={`Equip ${title.name}`}
                  >
                    Equip
                  </Button>
                ) : (
                  <Chip icon="lock">Locked</Chip>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
