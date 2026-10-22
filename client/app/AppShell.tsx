import {
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigation,
} from 'react-router-dom'
import AuthProvider from '../components/AuthProvider.tsx'
import useAuth from '../hooks/useAuth.ts'
import { CurrencyChip } from '../ui/Chip.tsx'
import Chip from '../ui/Chip.tsx'
import Icon, { type IconName } from '../ui/Icon.tsx'
import { ButtonLink } from '../ui/Button.tsx'
import { ToastProvider } from '../ui/Toast.tsx'
import Avatar from '../ui/Avatar.tsx'
import { playerAvatarImage } from '../ui/avatarImage.ts'
import usePageTitle from './usePageTitle.ts'
import ThemeApplier from './ThemeApplier.tsx'
import { usePlayer } from './PlayerContext.ts'
import PlayerProvider from './PlayerProvider.tsx'
import { useResearchAccess } from '../features/research/useResearch.ts'
import styles from './AppShell.module.css'

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/adventure', label: 'Adventure', icon: 'map' },
  { to: '/play', label: 'Play', icon: 'swords' },
  { to: '/quiz', label: 'Quiz', icon: 'quiz' },
  { to: '/profile', label: 'Profile', icon: 'user' },
]

function Hud() {
  const { status } = useAuth()
  const { player } = usePlayer()
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
            <Icon name="compass" size={22} />
          </span>
          <span className={styles.brandName}>Trader’s Edge</span>
        </NavLink>
        <nav className={styles.topNav} aria-label="Main">
          {NAV.slice(1).map((item) => (
            <NavLink key={item.to} to={item.to} className={styles.topLink}>
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/leaderboard" className={styles.topLink}>
            Leaderboard
          </NavLink>
          {researcher && (
            <NavLink to="/research" className={styles.topLink}>
              Research
            </NavLink>
          )}
        </nav>
        <div className={styles.hudStats}>
          {player ? (
            <>
              <Chip
                tone="flame"
                icon="flame"
                role="img"
                aria-label={`${player.streak.days}-day streak`}
              >
                <span className="num" aria-hidden="true">
                  {player.streak.days}
                </span>
              </Chip>
              <CurrencyChip kind="doubloons" amount={player.wallet.doubloons} />
              <span className={styles.hideSmall}>
                <CurrencyChip kind="gems" amount={player.wallet.gems} />
              </span>
              <NavLink
                to="/profile"
                className={styles.hudAvatar}
                aria-label={`Profile, level ${player.level}`}
              >
                <Avatar
                  id={player.avatar_id}
                  image={playerAvatarImage(player)}
                  size={36}
                  level={player.level}
                />
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

function BottomNav() {
  return (
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
        </NavLink>
      ))}
    </nav>
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
