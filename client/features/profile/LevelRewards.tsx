import { useState } from 'react'
import { usePlayer } from '../../app/PlayerContext.ts'
import {
  claimLevelRewards,
  getLevelRewards,
} from '../../services/playerService.ts'
import Button from '../../ui/Button.tsx'
import { CurrencyChip } from '../../ui/Chip.tsx'
import Modal from '../../ui/Modal.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import useResource, { errorText } from '../../ui/useResource.ts'
import styles from './LevelRewards.module.css'
import Icon from '../../ui/Icon.tsx'

export function LevelRewardClaims({ all = false }: { all?: boolean }) {
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
        {(rewards) => {
          const pending = rewards.filter(
            (reward) => reward.status === 'claimable',
          )
          const total = pending.reduce((sum, reward) => sum + reward.amount, 0)
          return (
            <>
              <div className={styles.bar}>
                <span>Claimable rewards</span>
                <CurrencyChip kind="gems" amount={total} />
              </div>
              <Button
                disabled={busy || total === 0}
                onClick={() => void claim()}
              >
                {busy
                  ? 'Claiming…'
                  : total
                    ? 'Claim rewards'
                    : 'No rewards to claim'}
              </Button>
              {all && (
                <>
                  <ol className={styles.list} aria-label="All level rewards">
                    {rewards.map((reward) => (
                      <li key={reward.level} className={styles.row}>
                        <span>Level {reward.level}</span>
                        <CurrencyChip kind="gems" amount={reward.amount} />
                        {reward.status === 'claimable' ? (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            aria-label={`Claim level ${reward.level} reward`}
                            onClick={() => void claim(reward.level)}
                          >
                            Claim
                          </Button>
                        ) : (
                          <span>
                            {reward.status === 'claimed' ? <Icon name="check" /> : <Icon name="lock" />}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )
        }}
      </ResourceView>
      {claimed !== null && (
        <p role="status">
          {claimed ? `${claimed} Gems claimed.` : 'Rewards already claimed.'}
        </p>
      )}
      {error && <p role="alert">{error} Try claiming again.</p>}
    </div>
  )
}

export default function LevelRewards() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Claim level-up rewards
      </Button>
      <Modal
        open={open}
        title="Level-up rewards"
        onClose={() => setOpen(false)}
      >
        {open && <LevelRewardClaims all />}
      </Modal>
    </>
  )
}
