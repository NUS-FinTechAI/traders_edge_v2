import { useEffect, useRef, useState } from 'react'
import {
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigation,
} from 'react-router-dom'
import AuthProvider from '../components/AuthProvider.tsx'
import useAuth from '../hooks/useAuth.ts'
import Chip from '../ui/Chip.tsx'
import Icon, { type IconName } from '../ui/Icon.tsx'
import Logo from '../ui/Logo.tsx'
import Button, { ButtonLink } from '../ui/Button.tsx'
import { ToastProvider } from '../ui/Toast.tsx'
import Avatar from '../ui/Avatar.tsx'
import NotificationDot from '../ui/NotificationDot.tsx'
import { unreadUnlocks } from './unlockNotifications.ts'
import { playerAvatarImage } from '../ui/avatarImage.ts'
import { formatCount } from '../ui/format.ts'
import { EarnButton } from '../features/profile/EarnGuide.tsx'
import usePageTitle from './usePageTitle.ts'
import ThemeApplier from './ThemeApplier.tsx'
import { usePlayer } from './PlayerContext.ts'
import PlayerProvider from './PlayerProvider.tsx'
import { useResearchAccess } from '../features/research/useResearch.ts'
import styles from './AppShell.module.css'

interface NavItem {
  to: string
  label: string
  icon: IconName
}

const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/adventure', label: 'Adventure', icon: 'map' },
  { to: '/play', label: 'Play', icon: 'swords' },
  { to: '/quiz', label: 'Quiz', icon: 'quiz' },
]

/** Desktop shows these in the top bar; phones reach them through "More". */
const EXTRA: NavItem[] = [
  { to: '/leaderboard', label: 'Leaderboard', icon: 'podium' },
  { to: '/shop', label: 'Shop', icon: 'bag' },
  { to: '/archive', label: 'Archive', icon: 'book' },
]

const MORE: NavItem[] = [
  { to: '/profile', label: 'Profile', icon: 'user' },
  ...EXTRA,
]

const RESEARCH: NavItem = { to: '/research', label: 'Research', icon: 'chart' }

/** Three dots, drawn like the shared icon set. */
function MoreIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth={3} />
    </svg>
  )
}

function Hud() {
  const { status } = useAuth()
  const { player } = usePlayer()
  const newChapters = unreadUnlocks(player, 'campaign', 'chapters').length > 0
  const newKeywords = unreadUnlocks(player, 'archive', 'keywords').length > 0
  const newRewards = unreadUnlocks(player, 'level_rewards').length > 0
  const researcher = useResearchAccess()
  return (
    <header className={styles.hud}>
      <div className={styles.hudInner}>
        <NavLink
          to="/"
          className={styles.brand}
          aria-label="Trader’s Edge home"
        >
          <span className={styles.brandMark} aria-hidden="true">
            <Logo size={36} />
          </span>
          <span className={styles.brandName}>Trader’s Edge</span>
        </NavLink>
        <nav className={styles.topNav} aria-label="Main">
          {NAV.slice(1).map((item) => (
            <NavLink key={item.to} to={item.to} className={styles.topLink}>
              {item.label}
              {item.to === '/adventure' && newChapters && (
                <NotificationDot label="Newly unlocked chapters" />
              )}
            </NavLink>
          ))}
          <span className={styles.topDivider} aria-hidden="true" />
          {EXTRA.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={styles.topLink}
              title={item.label}
            >
              <Icon name={item.icon} size={20} />
              <span className={styles.topLabel}>{item.label}</span>
              {item.to === '/archive' && newKeywords && (
                <NotificationDot label="New archive keywords" />
              )}
            </NavLink>
          ))}
          {researcher && (
            <NavLink to="/research" className={styles.topLink} title="Research">
              <Icon name="chart" size={20} />
              <span className={styles.topLabel}>Research</span>
            </NavLink>
          )}
        </nav>
        <div className={styles.hudStats}>
          {player ? (
            <>
              <EarnButton
                topic="streak"
                label={`${player.streak.days}-day streak`}
              >
                <Chip tone="flame" icon="flame">
                  <span className="num">{player.streak.days}</span>
                </Chip>
              </EarnButton>
              <EarnButton
                topic="doubloons"
                label={`${formatCount(player.wallet.doubloons)} Doubloons`}
              >
                <Chip tone="gold" icon="coin">
                  <span className="num">
                    {formatCount(player.wallet.doubloons)}
                  </span>
                </Chip>
              </EarnButton>
              <span className={styles.hideSmall}>
                <EarnButton
                  topic="gems"
                  label={`${formatCount(player.wallet.gems)} Gems`}
                >
                  <Chip tone="gem" icon="gem">
                    <span className="num">
                      {formatCount(player.wallet.gems)}
                    </span>
                  </Chip>
                </EarnButton>
              </span>
              <NavLink
                to="/profile"
                className={styles.hudAvatar}
                aria-label={`Profile, level ${player.level}${unreadUnlocks(player, 'cosmetics').length ? ', new cosmetics' : ''}${newRewards ? ', unclaimed level rewards' : ''}`}
              >
                <Avatar
                  id={player.avatar_id}
                  image={playerAvatarImage(player)}
                  size={36}
                  level={player.level}
                />
                {(unreadUnlocks(player, 'cosmetics').length > 0 ||
                  newRewards) && (
                  <NotificationDot
                    label={
                      newRewards ? 'Unclaimed level rewards' : 'New cosmetics'
                    }
                  />
                )}
              </NavLink>
            </>
          ) : (
            status === 'signed-out' && (
              <ButtonLink to="/login" size="sm">
                Play now
              </ButtonLink>
            )
          )}
        </div>
      </div>
    </header>
  )
}

/** Five-slot bottom bar; "More" opens a sheet with the remaining pages. */
function BottomNav() {
  const { player } = usePlayer()
  const newChapters = unreadUnlocks(player, 'campaign', 'chapters').length > 0
  const newKeywords = unreadUnlocks(player, 'archive', 'keywords').length > 0
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  const more = useResearchAccess() ? [...MORE, RESEARCH] : MORE
  const moreCurrent = more.some(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  )

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <>
      <nav className={styles.bottomNav} aria-label="Main">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={styles.bottomLink}
          >
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
            {item.to === '/adventure' && newChapters && (
              <NotificationDot label="Newly unlocked chapters" />
            )}
          </NavLink>
        ))}
        <button
          type="button"
          className={[styles.bottomLink, moreCurrent && styles.bottomCurrent]
            .filter(Boolean)
            .join(' ')}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <MoreIcon />
          <span>More</span>
          {newKeywords && <NotificationDot label="New archive keywords" />}
        </button>
      </nav>
      {/* Outside the bar, which is hidden on wide screens, so an open sheet
          stays visible if the window widens. */}
      <dialog
        ref={ref}
        className={styles.sheet}
        aria-labelledby="more-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          // The dialog has no padding, so a click on it is on the backdrop.
          if (event.target === event.currentTarget) setOpen(false)
        }}
      >
        {open && (
          <div className={styles.sheetInner}>
            <div className={styles.sheetHead}>
              <h2 id="more-title" className={styles.sheetTitle}>
                More
              </h2>
              <Button
                variant="ghost"
                icon="close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              />
            </div>
            <ul className={styles.sheetList}>
              {more.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={styles.sheetLink}
                    onClick={() => setOpen(false)}
                  >
                    <Icon name={item.icon} size={22} />
                    <span>{item.label}</span>
                    {item.to === '/archive' && newKeywords && (
                      <NotificationDot label="New archive keywords" />
                    )}
                    <Icon
                      name="chevron-right"
                      size={18}
                      className={styles.sheetChevron}
                    />
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )}
      </dialog>
    </>
  )
}

export default function AppShell() {
  const navigation = useNavigation()
  const { pathname } = useLocation()
  const immersive = pathname.startsWith('/game/')
  // Lessons, quizzes and the study questions hide the HUD and navigation so one task fills the screen.
  const focus =
    /^\/(level|quiz\/attempt)\//.test(pathname) || pathname === '/onboarding'
  const chrome = !immersive && !focus
  usePageTitle(pathname)
  return (
    <AuthProvider>
      <PlayerProvider>
        <ToastProvider>
          <ThemeApplier />
          <div
            className={
              immersive ? styles.immersive : focus ? styles.focus : styles.shell
            }
          >
            <a href="#main" className={styles.skip}>
              Skip to content
            </a>
            {chrome && <Hud />}
            <main
              id="main"
              className={styles.main}
              aria-busy={navigation.state === 'loading'}
            >
              <Outlet />
            </main>
            {chrome && <BottomNav />}
            <ScrollRestoration />
          </div>
        </ToastProvider>
      </PlayerProvider>
    </AuthProvider>
  )
}
