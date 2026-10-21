import { avatarArt } from './avatarArt.tsx'
import styles from './Avatar.module.css'

const PALETTE = [
  '#2f6b4b',
  '#6b4f2f',
  '#2f566b',
  '#5b3f6b',
  '#6b2f3a',
  '#4f6b2f',
]

function hue(id: string): string {
  let total = 0
  for (const char of id) total = (total * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[total % PALETTE.length]
}

interface AvatarProps {
  id: string
  size?: number
  level?: number
  label?: string
}

/** Player or AI portrait; unknown ids fall back to a lettered disc. */
export default function Avatar({ id, size = 40, level, label }: AvatarProps) {
  const art = avatarArt(id)
  const name = id.replace(/^avatar-/, '').replace(/-/g, ' ')
  return (
    <span
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        background: art ? art.bg : hue(id),
        fontSize: size * 0.42,
      }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {art ? (
        <svg
          className={styles.art}
          viewBox="0 0 64 64"
          focusable="false"
          aria-hidden="true"
        >
          {art.art}
        </svg>
      ) : (
        name.charAt(0).toUpperCase()
      )}
      {level !== undefined && <span className={styles.level}>{level}</span>}
    </span>
  )
}
