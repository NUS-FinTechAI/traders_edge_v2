import { useNavigate } from 'react-router-dom'
import type { ChapterMap, MapNode } from '../../services/campaignService.ts'
import Button, { ButtonLink } from '../../ui/Button.tsx'
import { CurrencyChip, Delta } from '../../ui/Chip.tsx'
import Emblem from '../../ui/Emblem.tsx'
import Icon, { type IconName } from '../../ui/Icon.tsx'
import Modal from '../../ui/Modal.tsx'
import Stars from '../../ui/Stars.tsx'
import useStartGame from '../play/useStartGame.ts'
import RewardArt from './RewardArt.tsx'
import styles from './ChapterMap.module.css'

const OBJECTIVE_ICONS: IconName[] = ['candles', 'target', 'chart', 'shield']

const REWARD_KIND = { avatar: 'Avatar', title: 'Title', badge: 'Badge' }

function Locked({ reason }: { reason: string | null }) {
  return (
    <p className={styles.lockedLine}>
      <Icon name="lock" size={18} />
      {reason ?? 'Finish the earlier stops first'}
    </p>
  )
}

function StarStatus({ node }: { node: MapNode }) {
  if (!node.stars) return null
  const { normal, special } = node.stars
  return (
    <div className={styles.starStatus}>
      <Stars normal={normal} special={special} size={20} />
      <span>
        {normal && special
          ? 'Both stars earned'
          : normal
            ? 'Bonus star still to win'
            : 'No stars yet'}
      </span>
    </div>
  )
}

function LevelBody({ map, node }: { map: ChapterMap; node: MapNode }) {
  const navigate = useNavigate()
  const number =
    map.nodes.filter((item) => item.kind === 'level').indexOf(node) + 1
  return (
    <div className={styles.popup}>
      <p className={styles.popupEyebrow}>
        Chapter {map.chapter.number} · Level {number}
      </p>
      <p className={styles.muted}>{node.summary}</p>
      {node.objectives.length > 0 && (
        <div className={styles.learn}>
          <p className={styles.learnTitle}>You will learn to:</p>
          <ul className={styles.objectives}>
            {node.objectives.map((objective, index) => (
              <li key={objective}>
                <span className={styles.objectiveIcon} aria-hidden="true">
                  <Icon
                    name={OBJECTIVE_ICONS[index % OBJECTIVE_ICONS.length]}
                    size={18}
                  />
                </span>
                {objective}
              </li>
            ))}
          </ul>
        </div>
      )}
      <StarStatus node={node} />
      <div className={styles.popupFoot}>
        {node.xp > 0 && <CurrencyChip kind="xp" amount={node.xp} signed />}
        {node.state === 'locked' ? (
          <Locked reason={node.locked_reason} />
        ) : (
          <Button
            size="lg"
            icon="play"
            className={styles.popupCta}
            onClick={() =>
              void navigate(`/level/${encodeURIComponent(node.id)}`)
            }
          >
            {node.state === 'done' ? 'Play again' : 'Start lesson'}
          </Button>
        )}
      </div>
    </div>
  )
}

function BattleBody({ map, node }: { map: ChapterMap; node: MapNode }) {
  const { start, busy } = useStartGame()
  const preview = node.kind === 'preview'
  return (
    <div className={styles.popup}>
      <div className={styles.battleHead}>
        <Emblem
          name={preview ? 'swords' : 'chest'}
          size={72}
          shape="circle"
          tone={preview ? 'info' : 'gold'}
        />
        <div>
          <p className={styles.popupEyebrow}>
            {preview
              ? `Chapter ${map.chapter.number} · Preview battle`
              : `Chapter ${map.chapter.number} · Chapter Boss`}
          </p>
          {!preview && <p className={styles.muted}>{node.summary}</p>}
        </div>
      </div>
      <p className={styles.note}>
        {preview
          ? 'You can’t lose this one: it shows where you’re starting from.'
          : 'Finish first in profit to win. Win to open the next chapter.'}
      </p>
      {node.attempts > 0 && (
        <dl className={styles.best}>
          <div>
            <dt>Best result</dt>
            <dd>
              {node.best_profit === null ? (
                '-'
              ) : Math.abs(node.best_profit) < 0.005 ? (
                'Broke even'
              ) : (
                <Delta value={node.best_profit} whole />
              )}
            </dd>
          </div>
          <div>
            <dt>Attempts</dt>
            <dd className="num">{node.attempts}</dd>
          </div>
        </dl>
      )}
      {node.reward && (
        <div className={styles.rewardRow}>
          <RewardArt
            reward={node.reward}
            size={44}
            earned={node.state === 'done'}
          />
          <span>
            <span className={styles.muted}>
              {REWARD_KIND[node.reward.kind]} reward
            </span>
            <strong>{node.reward.name}</strong>
          </span>
        </div>
      )}
      <StarStatus node={node} />
      <div className={styles.popupFoot}>
        {node.xp > 0 && <CurrencyChip kind="xp" amount={node.xp} signed />}
        {node.state === 'locked' ? (
          <Locked reason={node.locked_reason} />
        ) : (
          <Button
            size="lg"
            icon="swords"
            className={styles.popupCta}
            disabled={!!busy}
            onClick={() =>
              void start(
                {
                  mode: 'boss',
                  chapter_id: map.chapter.id,
                  boss: preview ? 'preview' : 'final',
                },
                { scenarioId: node.scenario_id },
              )
            }
          >
            {busy
              ? 'Starting…'
              : node.state === 'done'
                ? 'Battle again'
                : 'Start battle'}
          </Button>
        )}
      </div>
    </div>
  )
}

function RewardBody({ node }: { node: MapNode }) {
  const reward = node.reward
  const earned = node.state === 'done'
  return (
    <div className={`${styles.popup} ${styles.center}`}>
      {reward && <RewardArt reward={reward} size={96} earned={earned} />}
      {reward && (
        <p className={styles.popupEyebrow}>{REWARD_KIND[reward.kind]}</p>
      )}
      <p className={styles.muted}>{node.summary}</p>
      {earned ? (
        <>
          <p className={styles.claimed}>
            <Icon name="check" size={18} />
            Claimed: it’s in your collection
          </p>
          <ButtonLink to="/profile" variant="secondary" icon="user">
            View collection
          </ButtonLink>
        </>
      ) : (
        <Locked reason={node.locked_reason} />
      )}
    </div>
  )
}

export default function NodePopup({
  map,
  node,
  onClose,
}: {
  map: ChapterMap
  node: MapNode | null
  onClose: () => void
}) {
  const title = !node
    ? ''
    : node.kind === 'reward'
      ? (node.reward?.name ?? node.title)
      : node.title
  return (
    <Modal open={!!node} title={title} onClose={onClose}>
      {node?.kind === 'level' && <LevelBody map={map} node={node} />}
      {(node?.kind === 'preview' || node?.kind === 'boss') && (
        <BattleBody map={map} node={node} />
      )}
      {node?.kind === 'reward' && <RewardBody node={node} />}
    </Modal>
  )
}
