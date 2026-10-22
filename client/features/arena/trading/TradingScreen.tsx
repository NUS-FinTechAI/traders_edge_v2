import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
} from 'react'
import type {
  ClockAction,
  GameState,
  Order,
  OrderRequest,
  Side,
} from '../../../services/gameService.ts'
import Button from '../../../ui/Button.tsx'
import Chip from '../../../ui/Chip.tsx'
import Icon from '../../../ui/Icon.tsx'
import Modal from '../../../ui/Modal.tsx'
import ProgressBar from '../../../ui/ProgressBar.tsx'
import Tabs from '../../../ui/Tabs.tsx'
import { currentDay, isMultiplayer } from '../arenaLogic.ts'
import PriceChart from '../chart/PriceChart.tsx'
import { modeLabel } from '../labels.ts'
import AccountPanel from '../panels/AccountPanel.tsx'
import ActivityPanel from '../panels/ActivityPanel.tsx'
import MissionsPanel from '../panels/MissionsPanel.tsx'
import NewsFeed from '../panels/NewsFeed.tsx'
import RivalsPanel from '../panels/RivalsPanel.tsx'
import TradeTicket from '../ticket/TradeTicket.tsx'
import { tourTarget, type ArenaTab } from '../tour/tour.ts'
import BottomSheet from './BottomSheet.tsx'
import ClockControls from './ClockControls.tsx'
import SymbolTabs from './SymbolTabs.tsx'
import styles from './Trading.module.css'

const DESKTOP = '(min-width: 1024px)'

function useDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(DESKTOP)
      query.addEventListener('change', notify)
      return () => query.removeEventListener('change', notify)
    },
    () => window.matchMedia(DESKTOP).matches,
  )
}

const MOBILE_TABS: { id: ArenaTab; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'rivals', label: 'Rivals' },
  { id: 'news', label: 'News' },
  { id: 'trades', label: 'Trades' },
]

const SHORTCUTS_KEY = 'traders-edge:arena-shortcuts'

function readShortcuts(): boolean {
  try {
    return localStorage.getItem(SHORTCUTS_KEY) !== 'off'
  } catch {
    return true
  }
}

function writeShortcuts(on: boolean): void {
  try {
    localStorage.setItem(SHORTCUTS_KEY, on ? 'on' : 'off')
  } catch {
    // The choice still applies until the page reloads.
  }
}

interface TradingScreenProps {
  state: GameState
  reconnecting: boolean
  clockBusy: boolean
  cancelling: string | null
  /** Stop-losses waiting for their buy order to fill. */
  pendingStops: number
  onClock: (action: ClockAction, speed?: 1 | 2 | 4) => void
  onPlace: (order: OrderRequest, attachStop: number | null) => Promise<void>
  onCancel: (order: Order) => void
  onForfeit: () => Promise<void>
  /** Mobile tab the tour has opened, shown in place of the player's choice. */
  tourTab: ArenaTab | null
  onHowToPlay: () => void
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

function StopNote({ count }: { count: number }) {
  return (
    <p className={styles.stopNote} role="status">
      <Icon name="shield" size={16} />
      {count === 1
        ? 'A stop-loss will be placed when your buy fills.'
        : `${count} stop-losses will be placed when your buys fill.`}
    </p>
  )
}

export default function TradingScreen({
  state,
  reconnecting,
  clockBusy,
  cancelling,
  pendingStops,
  onClock,
  onPlace,
  onCancel,
  onForfeit,
  tourTab,
  onHowToPlay,
}: TradingScreenProps) {
  const desktop = useDesktop()
  const [symbol, setSymbol] = useState(state.assets[0]?.symbol ?? '')
  const [side, setSide] = useState<Side>('buy')
  const [focusSignal, setFocusSignal] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<ArenaTab>('account')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [missionsOpen, setMissionsOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [shortcuts, setShortcuts] = useState(readShortcuts)
  const [autoPaused, setAutoPaused] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  const solo = !isMultiplayer(state)
  const paused = state.paused
  const canTrade = state.status !== 'ended' && state.status !== 'settled'
  const asset = state.assets.find((a) => a.symbol === symbol) ?? state.assets[0]
  const day = currentDay(state)
  const alone = state.leaderboard.length <= 1
  const mobileTabs = alone
    ? MOBILE_TABS.filter((tab) => tab.id !== 'rivals')
    : MOBILE_TABS
  const chosenTab = tourTab ?? mobileTab
  const shownTab = mobileTabs.some((tab) => tab.id === chosenTab)
    ? chosenTab
    : 'account'

  // Solo clocks pause while the order ticket is in use so there is no time
  // pressure; the clock resumes afterwards only if this screen paused it.
  const engageTicket = useCallback(() => {
    if (!solo || paused || clockBusy || autoPaused) return
    setAutoPaused(true)
    onClock('pause')
  }, [solo, paused, clockBusy, autoPaused, onClock])

  const releaseTicket = useCallback(() => {
    if (!autoPaused) return
    setAutoPaused(false)
    onClock('resume')
  }, [autoPaused, onClock])

  const clock = useCallback(
    (action: ClockAction, speed?: 1 | 2 | 4) => {
      if (action === 'resume' || action === 'pause') setAutoPaused(false)
      onClock(action, speed)
    },
    [onClock],
  )

  function openTicket(next: Side) {
    setSide(next)
    if (desktop) setFocusSignal((n) => n + 1)
    else {
      setSheetOpen(true)
      engageTicket()
    }
  }

  function closeSheet() {
    setSheetOpen(false)
    releaseTicket()
  }

  function onTicketBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
      releaseTicket()
  }

  useEffect(() => {
    if (!shortcuts) return
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
      const { target } = event
      const inArena =
        target === document.body ||
        (target instanceof Node && !!root.current?.contains(target))
      if (
        !inArena ||
        isTyping(target) ||
        document.querySelector('dialog[open]')
      )
        return
      const key = event.key.toLowerCase()
      if (key === 'b' || key === 's') {
        event.preventDefault()
        setSide(key === 'b' ? 'buy' : 'sell')
        if (window.matchMedia(DESKTOP).matches) setFocusSignal((n) => n + 1)
        else {
          setSheetOpen(true)
          engageTicket()
        }
      } else if (key === ' ' && solo && !clockBusy) {
        if (
          target instanceof Element &&
          target.closest('button, a, summary, [role="tab"], label')
        )
          return
        event.preventDefault()
        clock(paused ? 'resume' : 'pause')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcuts, solo, paused, clockBusy, clock, engageTicket])

  function toggleShortcuts() {
    writeShortcuts(!shortcuts)
    setShortcuts(!shortcuts)
  }

  async function leave() {
    setLeaving(true)
    try {
      await onForfeit()
    } finally {
      setLeaving(false)
      setConfirmLeave(false)
    }
  }

  const ticket = asset && (
    <TradeTicket
      key={asset.symbol}
      state={state}
      symbol={asset.symbol}
      side={side}
      onSideChange={setSide}
      focusSignal={focusSignal}
      canTrade={canTrade}
      onPlace={async (order, stop) => {
        await onPlace(order, stop)
        if (!desktop) closeSheet()
      }}
    />
  )

  const assetNews = state.news.filter(
    (item) =>
      item.symbols.length === 0 || item.symbols.includes(asset?.symbol ?? ''),
  )

  const activity = (
    <ActivityPanel
      me={state.me}
      onSelectSymbol={setSymbol}
      onCancel={onCancel}
      cancelling={cancelling}
      canTrade={canTrade}
    />
  )

  const feed = <NewsFeed news={state.news} />

  return (
    <div className={styles.screen} ref={root}>
      <header className={styles.topBar} {...tourTarget('top-bar')}>
        <div className={styles.topLeft}>
          <Button
            variant="ghost"
            icon="chevron-left"
            className={styles.leave}
            aria-label="Leave match"
            onClick={() => setConfirmLeave(true)}
          >
            <span className={styles.leaveText}>Leave</span>
          </Button>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{state.scenario.title}</h1>
            <Chip tone="gold" className={styles.modeChip}>
              {modeLabel(state.mode, state.boss)}
            </Chip>
          </div>
        </div>
        <div className={styles.dayBlock} {...tourTarget('day')}>
          <span className={styles.dayText}>
            {state.tick_label || 'Day'} <span className="num">{day}</span> of{' '}
            <span className="num">{state.ticks}</span>
            {paused && (
              <span className={styles.pausedTag}>
                {autoPaused ? 'Paused while you trade' : 'Paused'}
              </span>
            )}
          </span>
          <ProgressBar
            value={day}
            max={state.ticks}
            label="Match progress"
            valueText={`Day ${day} of ${state.ticks}`}
            tone="gold"
            className={styles.dayBar}
          />
        </div>
        <div className={styles.topRight}>
          {reconnecting && (
            <span className={styles.reconnecting} role="status">
              Reconnecting…
            </span>
          )}
          {solo && (
            <ClockControls
              paused={paused}
              speed={state.speed}
              busy={clockBusy}
              onClock={clock}
            />
          )}
          <Button
            variant="ghost"
            icon="star"
            className={styles.help}
            aria-label="Missions"
            aria-haspopup="dialog"
            title="Missions"
            onClick={() => setMissionsOpen(true)}
            {...tourTarget('missions')}
          >
            <span className={styles.helpText} aria-hidden="true">
              Missions
            </span>
          </Button>
          <Button
            variant="ghost"
            icon="quiz"
            className={styles.help}
            aria-label="Tutorial"
            onClick={onHowToPlay}
            {...tourTarget('help')}
          >
            <span className={styles.helpText} aria-hidden="true">
              Tutorial
            </span>
          </Button>
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          <SymbolTabs
            assets={state.assets}
            value={asset?.symbol ?? ''}
            onChange={setSymbol}
          />
          {asset && (
            <section
              className={styles.chartCard}
              aria-label={`${asset.symbol} chart`}
              {...tourTarget('chart')}
            >
              <div className={styles.chartHead}>
                <div>
                  <h2 className={styles.chartTitle}>
                    {asset.symbol} <span>{asset.name}</span>
                  </h2>
                  <p className={styles.chartSub}>
                    {asset.sector} · {asset.blurb}
                  </p>
                </div>
              </div>
              <PriceChart
                key={asset.symbol}
                symbol={asset.symbol}
                bars={state.bars[asset.symbol] ?? []}
                tools={state.scenario.tools}
                fills={state.me.fills}
                orders={state.me.orders}
                news={assetNews}
                height={desktop ? 320 : 220}
              />
            </section>
          )}
          {desktop && <div className={styles.card}>{activity}</div>}
          {desktop && <div {...tourTarget('news')}>{feed}</div>}
          {!desktop && (
            <div className={styles.mobileTabs} {...tourTarget('details')}>
              <Tabs
                label="Match details"
                tabs={mobileTabs}
                value={shownTab}
                onChange={setMobileTab}
                idPrefix="arena"
              />
              <div
                role="tabpanel"
                id={`arena-panel-${shownTab}`}
                aria-labelledby={`arena-tab-${shownTab}`}
                className={styles.card}
              >
                {shownTab === 'account' && <AccountPanel me={state.me} bare />}
                {shownTab === 'rivals' && (
                  <RivalsPanel entries={state.leaderboard} bare />
                )}
                {shownTab === 'news' && <NewsFeed news={state.news} bare />}
                {shownTab === 'trades' && activity}
              </div>
            </div>
          )}
        </div>

        {desktop && (
          <aside className={styles.side} aria-label="Trading tools">
            <div
              className={`${styles.card} ${styles.ticketCard}`}
              onFocus={engageTicket}
              onBlur={onTicketBlur}
              {...tourTarget('ticket')}
            >
              {ticket}
            </div>
            {pendingStops > 0 && <StopNote count={pendingStops} />}
            <div {...tourTarget('account')}>
              <AccountPanel me={state.me} />
            </div>
            {!alone && (
              <div {...tourTarget('rivals')}>
                <RivalsPanel entries={state.leaderboard} />
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className={styles.footer}>
        <span>Simulated money · fictional companies</span>
        {desktop && (
          <span className={styles.shortcuts}>
            {shortcuts && (
              <span>
                Shortcuts: <kbd>B</kbd> buy · <kbd>S</kbd> sell
                {solo && (
                  <>
                    {' '}
                    · <kbd>Space</kbd> pause or play
                  </>
                )}
              </span>
            )}
            <button
              type="button"
              className={styles.shortcutToggle}
              aria-pressed={shortcuts}
              onClick={toggleShortcuts}
            >
              Keyboard shortcuts: {shortcuts ? 'on' : 'off'}
            </button>
          </span>
        )}
      </footer>

      {!desktop && (
        <>
          <div className={styles.actionBar} {...tourTarget('trade-actions')}>
            <Button
              variant="buy"
              size="lg"
              block
              onClick={() => openTicket('buy')}
              disabled={!canTrade}
            >
              ▲ Buy
            </Button>
            <Button
              variant="sell"
              size="lg"
              block
              onClick={() => openTicket('sell')}
              disabled={!canTrade}
            >
              ▼ Sell
            </Button>
          </div>
          {pendingStops > 0 && <StopNote count={pendingStops} />}
          <BottomSheet
            open={sheetOpen}
            title="Order ticket"
            onClose={closeSheet}
          >
            {ticket}
          </BottomSheet>
        </>
      )}

      <Modal
        open={missionsOpen}
        title="Missions"
        hideTitle
        onClose={() => setMissionsOpen(false)}
      >
        <div className={styles.missionsDialog}>
          <MissionsPanel missions={state.missions} />
        </div>
      </Modal>

      <Modal
        open={confirmLeave}
        title="Leave this match?"
        onClose={() => setConfirmLeave(false)}
      >
        <p className={styles.modalText}>
          You’ll rank last and earn no win rewards.
        </p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
            Keep playing
          </Button>
          <Button variant="danger" onClick={leave} disabled={leaving}>
            {leaving ? 'Leaving…' : 'Leave match'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
