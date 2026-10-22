import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { usePlayer } from '../../app/PlayerContext.ts'
import {
  THEMES,
  equipTheme,
  subscribeTheme,
  themeSelection,
  type ThemeKind,
} from '../../app/themes.ts'
import {
  getShop,
  updateMe,
  type Collection as CollectionData,
  type PlayerUpdate,
  type ShopItem,
} from '../../services/playerService.ts'
import Avatar from '../../ui/Avatar.tsx'
import Button, { ButtonLink } from '../../ui/Button.tsx'
import { itemImage } from '../../ui/avatarImage.ts'
import Chip from '../../ui/Chip.tsx'
import Emblem from '../../ui/Emblem.tsx'
import { badgeArt } from '../../ui/badgeArt.ts'
import Icon from '../../ui/Icon.tsx'
import Modal from '../../ui/Modal.tsx'
import ProgressBar from '../../ui/ProgressBar.tsx'
import { useToast } from '../../ui/toastContext.ts'
import useResource, { errorText, type Resource } from '../../ui/useResource.ts'
import styles from './Profile.module.css'

type Gallery = 'badges' | 'avatars' | 'titles' | 'themes'

const GALLERY_TITLE: Record<Gallery, string> = {
  badges: 'Badges',
  avatars: 'Avatars',
  titles: 'Titles',
  themes: 'Themes',
}

const MILESTONES = [5, 10, 20, 30, 40]

function EquippedTick() {
  return (
    <span className={styles.equippedTick} role="img" aria-label="Equipped">
      <Icon name="check" size={20} />
    </span>
  )
}

/** Every theme with whether this player can use it (free, or owned from the shop). */
function themeOptions(items: ShopItem[] | undefined) {
  const owned = new Set(
    (items ?? [])
      .filter((item) => item.kind === 'theme' && item.owned)
      .map((item) => item.id),
  )
  return THEMES.map((theme) => ({
    id: theme.id,
    kind: theme.kind,
    name: theme.name,
    description: theme.description,
    available: theme.free || owned.has(theme.id),
  }))
}

const THEME_GROUPS: { kind: ThemeKind; title: string; hint: string }[] = [
  { kind: 'base', title: 'Colour themes', hint: 'The look of the whole game.' },
  {
    kind: 'candles',
    title: 'Candle colours',
    hint: 'Chart candle colours, from the shop.',
  },
  {
    kind: 'palette',
    title: 'Accessibility palettes',
    hint: 'Free colour-blind and high-contrast options, layered on top.',
  },
]

function GalleryButton({
  art,
  label,
  count,
  onOpen,
}: {
  art: ReactNode
  label: string
  count: string
  onOpen: () => void
}) {
  return (
    <li>
      <button
        type="button"
        className={styles.galleryButton}
        aria-haspopup="dialog"
        onClick={onOpen}
      >
        {art}
        <span className={styles.galleryText}>
          <strong>{label}</strong>
          <span className={styles.muted}>{count}</span>
        </span>
        <Icon name="chevron-right" size={20} className={styles.galleryArrow} />
      </button>
    </li>
  )
}

export default function Collection({
  data,
  onChange,
}: {
  data: CollectionData
  onChange: () => void
}) {
  const [open, setOpen] = useState<Gallery | null>(null)
  const { player, refreshPlayer } = usePlayer()
  const shop = useResource(getShop)
  const notify = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [justEquipped, setJustEquipped] = useState<string | null>(null)

  // Keep keyboard focus on the updated equipment control or status.
  useEffect(() => {
    if (justEquipped)
      document.getElementById(`equipped-${justEquipped}`)?.focus()
  }, [justEquipped, data])

  async function equip(id: string, changes: PlayerUpdate) {
    setBusy(id)
    try {
      await updateMe(changes)
      await refreshPlayer()
      onChange()
      setJustEquipped(id)
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  const earned = data.badges.filter((badge) => badge.earned).length
  const avatars = data.avatars.filter((avatar) => avatar.owned).length
  const titles = data.titles.filter((title) => title.owned).length
  const themes = themeOptions(shop.data?.items)
  const equippedAvatar = data.avatars.find(
    (avatar) => avatar.id === player?.avatar_id,
  )

  return (
    <section className={styles.panel} aria-labelledby="collection-title">
      <h2 id="collection-title" className={styles.panelTitle}>
        Collection
      </h2>
      <ul className={styles.galleries}>
        <GalleryButton
          label="Badges"
          count={`${earned} of ${data.badges.length} earned`}
          art={<Emblem name="medal" size={48} shape="circle" />}
          onOpen={() => setOpen('badges')}
        />
        <GalleryButton
          label="Avatars"
          count={`${avatars} of ${data.avatars.length} owned`}
          art={
            equippedAvatar ? (
              <Avatar
                id={equippedAvatar.id}
                image={itemImage(equippedAvatar)}
                size={48}
              />
            ) : (
              <Emblem name="users" size={48} shape="circle" />
            )
          }
          onOpen={() => setOpen('avatars')}
        />
        <GalleryButton
          label="Titles"
          count={`${titles} of ${data.titles.length} owned`}
          art={<Emblem name="scroll" tone="gem" size={48} shape="circle" />}
          onOpen={() => setOpen('titles')}
        />
        <GalleryButton
          label="Themes"
          count={
            shop.data
              ? `${themes.filter((theme) => theme.available).length} of ${themes.length} available`
              : `${themes.length} themes`
          }
          art={<Emblem name="candles" tone="green" size={48} shape="circle" />}
          onOpen={() => setOpen('themes')}
        />
      </ul>
      <Modal
        open={open !== null}
        title={open ? GALLERY_TITLE[open] : ''}
        onClose={() => setOpen(null)}
        wide
      >
        <div className={styles.gallery}>
          {open === 'badges' && (
            <>
              <p className={styles.muted}>
                {earned} of {data.badges.length} badges earned. Badges reward
                how you trade and learn, never profit size. Equip one to show
                beside your name.
              </p>
              <ul className={styles.badges}>
                {data.badges.map((badge) => (
                  <li
                    key={badge.id}
                    className={[
                      styles.badge,
                      badge.equipped && styles.equipped,
                      !badge.earned && styles.badgeLocked,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {badge.equipped && <EquippedTick />}
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
                      className={
                        badge.earned ? styles.earned : styles.lockedText
                      }
                    >
                      {badge.earned ? 'Earned' : 'Locked'}
                    </span>
                    <span className={styles.badgeHow}>{badge.description}</span>
                    {badge.earned && (
                      <div className={styles.badgeActions}>
                        <Button
                          variant="secondary"
                          disabled={!!busy}
                          id={`equipped-${badge.id}`}
                          onClick={() =>
                            void equip(badge.id, {
                              badge_id: badge.equipped ? null : badge.id,
                            })
                          }
                          aria-label={`${badge.equipped ? 'Unequip' : 'Equip'} ${badge.name}`}
                        >
                          {badge.equipped ? 'Unequip' : 'Equip'}
                        </Button>
                      </div>
                    )}
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
          {open === 'avatars' && (
            <ul className={styles.avatars}>
              {data.avatars.map((avatar) => (
                <li
                  key={avatar.id}
                  id={`equipped-${avatar.id}`}
                  tabIndex={-1}
                  aria-label={`${avatar.name}${avatar.equipped ? ', equipped' : ''}`}
                  className={[
                    styles.avatarItem,
                    avatar.equipped && styles.equipped,
                    !avatar.owned && styles.badgeLocked,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {avatar.equipped && <EquippedTick />}
                  <Avatar id={avatar.id} image={itemImage(avatar)} size={72} />
                  <strong className={styles.badgeName}>{avatar.name}</strong>
                  {avatar.owned ? (
                    <div className={styles.badgeActions}>
                      {!avatar.equipped && (
                        <Button
                          variant="secondary"
                          disabled={!!busy}
                          onClick={() =>
                            void equip(avatar.id, { avatar_id: avatar.id })
                          }
                          aria-label={`Equip ${avatar.name}`}
                        >
                          Equip
                        </Button>
                      )}
                    </div>
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
          {open === 'titles' && (
            <ul className={styles.titles}>
              {data.titles.map((title) => (
                <li
                  key={title.id}
                  id={`equipped-${title.id}`}
                  tabIndex={-1}
                  aria-label={`${title.name}${title.equipped ? ', equipped' : ''}`}
                  className={[
                    styles.titleItem,
                    styles.equipmentTitle,
                    title.equipped && styles.equipped,
                    !title.owned && styles.badgeLocked,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {title.equipped && <EquippedTick />}
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
                  {title.equipped ? null : title.owned ? (
                    <Button
                      variant="secondary"
                      disabled={!!busy}
                      onClick={() =>
                        void equip(title.id, { title_id: title.id })
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
          {open === 'themes' && player && (
            <Themes playerId={player.id} shop={shop} />
          )}
        </div>
      </Modal>
    </section>
  )
}

/** Pick a colour theme, an owned candle theme and a free accessibility palette. */
function Themes({
  playerId,
  shop,
}: {
  playerId: string
  shop: Resource<{ items: ShopItem[] }>
}) {
  const selection = useSyncExternalStore(
    subscribeTheme,
    () => themeSelection(playerId),
    () => themeSelection(null),
  )
  const options = themeOptions(shop.data?.items)
  return (
    <>
      <p className={styles.muted}>Themes change colours on this device only.</p>
      {THEME_GROUPS.map((group) => (
        <section key={group.kind} aria-label={group.title}>
          <h3 className={styles.themeGroupTitle}>{group.title}</h3>
          <p className={styles.badgeHow}>{group.hint}</p>
          <ul className={styles.titles}>
            {options
              .filter((option) => option.kind === group.kind)
              .map((option) => {
                const on = selection[option.kind] === option.id
                return (
                  <li
                    key={option.id}
                    className={[
                      styles.titleItem,
                      on && styles.equipped,
                      !option.available && styles.badgeLocked,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <ThemeSwatch themeId={option.id} />
                    <span className={styles.titleText}>
                      <strong>{option.name}</strong>
                      <span className={styles.badgeHow}>
                        {option.description}
                      </span>
                    </span>
                    {on && option.kind === 'base' ? (
                      <Chip tone="gain" icon="check">
                        In use
                      </Chip>
                    ) : on ? (
                      <Button
                        variant="ghost"
                        icon="check"
                        onClick={() => equipTheme(playerId, null, option.kind)}
                        aria-label={`Stop using ${option.name}`}
                      >
                        In use · Remove
                      </Button>
                    ) : option.available ? (
                      <Button
                        variant="secondary"
                        onClick={() => equipTheme(playerId, option.id)}
                        aria-label={`Use ${option.name}`}
                      >
                        Use
                      </Button>
                    ) : shop.status === 'loading' ? null : (
                      <ButtonLink to="/shop" variant="ghost" icon="bag">
                        Shop
                      </ButtonLink>
                    )}
                  </li>
                )
              })}
          </ul>
        </section>
      ))}
      <Button variant="ghost" onClick={() => equipTheme(playerId, null)}>
        Reset to the default look
      </Button>
    </>
  )
}

function ThemeSwatch({ themeId }: { themeId: string | null }) {
  const vars = THEMES.find((theme) => theme.id === themeId)?.vars ?? {}
  const up = vars['--candle-up'] ?? vars['--gain'] ?? 'var(--gain)'
  const down = vars['--candle-down'] ?? vars['--loss'] ?? 'var(--loss)'
  return (
    <svg className={styles.swatch} viewBox="0 0 44 44" aria-hidden="true">
      <rect x="0.5" y="0.5" width="43" height="43" rx="10" />
      <line x1="15" y1="8" x2="15" y2="36" style={{ stroke: up }} />
      <rect
        x="10"
        y="14"
        width="10"
        height="14"
        style={{ fill: 'var(--bg)', stroke: up }}
      />
      <line x1="29" y1="10" x2="29" y2="36" style={{ stroke: down }} />
      <rect
        x="24"
        y="18"
        width="10"
        height="12"
        style={{ fill: down, stroke: down }}
      />
    </svg>
  )
}
