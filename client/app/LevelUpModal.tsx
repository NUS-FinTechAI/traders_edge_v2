import { useState } from 'react'
import type { Player } from '../services/playerService.ts'
import Avatar from '../ui/Avatar.tsx'
import { playerAvatarImage } from '../ui/avatarImage.ts'
import Button from '../ui/Button.tsx'
import Modal from '../ui/Modal.tsx'
import { observeLevel, type LevelUpState } from './levelUp.ts'
import styles from './LevelUpModal.module.css'

export default function LevelUpModal({ player }: { player: Player | null }) {
  const [progress, setProgress] = useState<LevelUpState>(() =>
    observeLevel({ id: null, level: 0, celebration: null }, player),
  )
  const current = observeLevel(progress, player)
  if (current !== progress) setProgress(current)

  function dismiss() {
    setProgress((value) => ({ ...value, celebration: null }))
  }

  return (
    <Modal
      open={current.celebration !== null && player !== null}
      title="Level Up!"
      hideTitle
      onClose={dismiss}
    >
      {player && current.celebration !== null && (
        <div className={styles.content}>
          <h2 className={styles.title}>Level Up!</h2>
          <div className={styles.portrait} key={current.celebration}>
            <Avatar
              id={player.avatar_id}
              image={playerAvatarImage(player)}
              size={112}
              label={`${player.display_name}'s avatar`}
            />
            <p className={styles.level}>Level {current.celebration}</p>
          </div>
          <Button onClick={dismiss}>Continue</Button>
        </div>
      )}
    </Modal>
  )
}
