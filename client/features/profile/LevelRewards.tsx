import { useState } from 'react'
import { usePlayer } from '../../app/PlayerContext.ts'
import {
  claimLevelRewards,
  getLevelRewards,
  type LevelReward,
} from '../../services/playerService.ts'
import Button from '../../ui/Button.tsx'
import { CurrencyChip } from '../../ui/Chip.tsx'
import Modal from '../../ui/Modal.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import useResource, { errorText } from '../../ui/useResource.ts'
import styles from './LevelRewards.module.css'
import Icon from '../../ui/Icon.tsx'
import NotificationDot from '../../ui/NotificationDot.tsx'
import { unreadUnlocks } from '../../app/unlockNotifications.ts'

export function LevelRewardBar({
  rewards,
  busy,
  onClaim,
}: {
  rewards: LevelReward[]
  busy: boolean
  onClaim: () => void
}) {
  const total = rewards
    .filter((reward) => reward.status === 'claimable')
    .reduce((sum, reward) => sum + reward.amount, 0)

  return (
    <>
      <div className={styles.bar}>
        <span>Level Rewards</span>
        <CurrencyChip kind="gems" amount={total} />
      </div>
      {total > 0 && (
        <Button
          className={styles.notificationTarget}
          disabled={busy}
          onClick={onClaim}
        >
          {busy ? 'Claiming…' : 'Claim'}
          <NotificationDot label="Unclaimed level rewards" />
        </Button>
      )}
    </>
  )
}

function LevelRewardList({
  rewards,
  busy,
  onClaim,
}: {
  rewards: LevelReward[]
  busy: boolean
  onClaim: (level: number) => void
}) {
  return (
    <ol className={styles.list} aria-label="All level rewards">
      {rewards.map((reward) => (
        <li key={reward.level} className={styles.row}>
          <span>Level {reward.level}</span>
          <CurrencyChip kind="gems" amount={reward.amount} />
          {reward.status === 'claimable' ? (
            <span className={styles.notificationTarget}>
              <Button
                variant="primary"
                icon="chest"
                disabled={busy}
                aria-label={`Claim level ${reward.level} reward`}
                title={`Claim level ${reward.level} reward`}
                onClick={() => onClaim(reward.level)}
              />
              <NotificationDot label="Unclaimed level reward" />
            </span>
          ) : (
            <span>
              {reward.status === 'claimed' ? (
                <Icon name="check" />
              ) : (
                <Icon name="lock" />
              )}
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

export function LevelRewardClaims({ view }: { view: 'bar' | 'list' }) {
  const { player, refreshPlayer } = usePlayer()
  const resource = useResource(getLevelRewards, [player?.id, player?.level])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimed, setClaimed] = useState<number | null>(null)

  async function claim(level?: number) {
    setBusy(true)
    setError(null)
    try {
      const result = await claimLevelRewards(level)
      setClaimed(result.gems)
      resource.reload()
      await refreshPlayer()
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.content}>
      <ResourceView resource={resource} label="Loading level rewards…">
        {(rewards) =>
          view === 'bar' ? (
            <LevelRewardBar
              rewards={rewards}
              busy={busy}
              onClaim={() => void claim()}
            />
          ) : (
            <LevelRewardList
              rewards={rewards}
              busy={busy}
              onClaim={(level) => void claim(level)}
            />
          )
        }
      </ResourceView>
      {view === 'bar' && claimed !== null && (
        <p role="status">
          {claimed ? `Rewards claimed.` : 'Rewards already claimed.'}
        </p>
      )}
      {error && <p role="alert">{error} Try claiming again.</p>}
    </div>
  )
}

export default function LevelRewards() {
  const [open, setOpen] = useState(false)
  const { player } = usePlayer()
  const hasRewards = unreadUnlocks(player, 'level_rewards').length > 0
  return (
    <>
      <span className={styles.notificationTarget}>
        <Button
          variant="secondary"
          icon="chest"
          aria-label="Claim level-up rewards"
          title="Claim level-up rewards"
          onClick={() => setOpen(true)}
        />
        {hasRewards && <NotificationDot label="Unclaimed level rewards" />}
      </span>
      <Modal
        open={open}
        title="Level-up rewards"
        onClose={() => setOpen(false)}
      >
        {open && <LevelRewardClaims view="list" />}
      </Modal>
    </>
  )
}
