import { useEffect, useState, useSyncExternalStore } from 'react'
import type {
  ClockAction,
  GameState,
  Order,
  OrderRequest,
  Side,
} from '../../../services/gameService.ts'
import Button from '../../../ui/Button.tsx'
import Chip from '../../../ui/Chip.tsx'
import Modal from '../../../ui/Modal.tsx'
import ProgressBar from '../../../ui/ProgressBar.tsx'
import Tabs from '../../../ui/Tabs.tsx'
import { currentDay, isMultiplayer, isPaused } from '../arenaLogic.ts'
import PriceChart from '../chart/PriceChart.tsx'
import { modeLabel } from '../labels.ts'
import AccountPanel from '../panels/AccountPanel.tsx'
import ActivityPanel from '../panels/ActivityPanel.tsx'
import MissionsPanel from '../panels/MissionsPanel.tsx'
import NewsFeed from '../panels/NewsFeed.tsx'
import RivalsPanel from '../panels/RivalsPanel.tsx'
import TradeTicket from '../ticket/TradeTicket.tsx'
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

type MobileTab = 'account' | 'rivals' | 'missions' | 'news' | 'trades'
const MOBILE_TABS = [
  { id: 'account', label: 'Account' },
  { id: 'rivals', label: 'Rivals' },
  { id: 'missions', label: 'Missions' },
  { id: 'news', label: 'News' },
  { id: 'trades', label: 'Trades' },
] as const

interface TradingScreenProps {
  state: GameState
  reconnecting: boolean
  clockBusy: boolean
  cancelling: string | null
  onClock: (action: ClockAction, speed?: 1 | 2 | 4) => void
  onPlace: (order: OrderRequest, attachStop: number | null) => Promise<void>
  onCancel: (order: Order) => void
  onForfeit: () => Promise<void>
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

export default function TradingScreen({
  state,
  reconnecting,
  clockBusy,
  cancelling,
  onClock,
  onPlace,
  onCancel,
  onForfeit,
}: TradingScreenProps) {
  const desktop = useDesktop()
  const [symbol, setSymbol] = useState(state.assets[0]?.symbol ?? '')
  const [side, setSide] = useState<Side>('buy')
  const [focusSignal, setFocusSignal] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('account')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const solo = !isMultiplayer(state)
  const paused = isPaused(state)
  const canTrade = state.status !== 'ended' && state.status !== 'settled'
  const asset = state.assets.find((a) => a.symbol === symbol) ?? state.assets[0]
  const day = currentDay(state)

  function openTicket(next: Side) {
    setSide(next)
    if (desktop) setFocusSignal((n) => n + 1)
    else setSheetOpen(true)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTyping(event.target) || document.querySelector('dialog[open]'))
        return
      const key = event.key.toLowerCase()
      if (key === 'b' || key === 's') {
        event.preventDefault()
        setSide(key === 'b' ? 'buy' : 'sell')
        if (window.matchMedia(DESKTOP).matches) setFocusSignal((n) => n + 1)
        else setSheetOpen(true)
      } else if (key === ' ' && solo) {
        const { target } = event
        if (
          target instanceof Element &&
          target.closest('button, a, summary, [role="tab"]')
        )
          return
        event.preventDefault()
        onClock(paused ? 'resume' : 'pause')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [solo, paused, onClock])

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
        setSheetOpen(false)
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

  return (
    <div className={styles.screen}>
      <header className={styles.topBar}>
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
        <div className={styles.dayBlock}>
          <span className={styles.dayText}>
            {state.tick_label || 'Day'} <span className="num">{day}</span> of{' '}
            <span className="num">{state.ticks}</span>
            {paused && <span className={styles.pausedTag}>Paused</span>}
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
              onClock={onClock}
            />
          )}
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
          {!desktop && (
            <div className={styles.mobileTabs}>
              <Tabs
                label="Match details"
                tabs={MOBILE_TABS}
                value={mobileTab}
                onChange={setMobileTab}
                idPrefix="arena"
              />
              <div
                role="tabpanel"
                id={`arena-panel-${mobileTab}`}
                aria-labelledby={`arena-tab-${mobileTab}`}
                className={styles.card}
              >
                {mobileTab === 'account' && <AccountPanel me={state.me} bare />}
                {mobileTab === 'rivals' && (
                  <RivalsPanel entries={state.leaderboard} bare />
                )}
                {mobileTab === 'missions' && (
                  <MissionsPanel missions={state.missions} bare />
                )}
                {mobileTab === 'news' && <NewsFeed news={state.news} bare />}
                {mobileTab === 'trades' && activity}
              </div>
            </div>
          )}
        </div>

        {desktop && (
          <aside className={styles.side} aria-label="Trading tools">
            <div className={`${styles.card} ${styles.ticketCard}`}>
              {ticket}
            </div>
            <AccountPanel me={state.me} />
            <RivalsPanel entries={state.leaderboard} />
            <MissionsPanel missions={state.missions} />
            <NewsFeed news={state.news} />
          </aside>
        )}
      </div>

      <footer className={styles.footer}>
        <span>Simulated money · fictional companies</span>
        {desktop && (
          <span className={styles.shortcuts}>
            Shortcuts: <kbd>B</kbd> buy · <kbd>S</kbd> sell
            {solo && (
              <>
                {' '}
                · <kbd>Space</kbd> pause or play
              </>
            )}
          </span>
        )}
      </footer>

      {!desktop && (
        <>
          <div className={styles.actionBar}>
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
          <BottomSheet
            open={sheetOpen}
            title="Order ticket"
            onClose={() => setSheetOpen(false)}
          >
            {ticket}
          </BottomSheet>
        </>
      )}

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
