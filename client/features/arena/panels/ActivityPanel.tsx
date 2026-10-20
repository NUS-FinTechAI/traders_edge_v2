import { useState } from 'react'
import type { Me, Order } from '../../../services/gameService.ts'
import Button from '../../../ui/Button.tsx'
import { Delta } from '../../../ui/Chip.tsx'
import Tabs from '../../../ui/Tabs.tsx'
import { formatMoney } from '../../../ui/format.ts'
import { dayNumber } from '../arenaLogic.ts'
import styles from './panels.module.css'

type View = 'positions' | 'orders' | 'fills'

function orderLabel(order: Order) {
  if (order.type === 'stop') return 'Stop-loss'
  if (order.type === 'limit')
    return order.side === 'buy' ? 'Buy limit' : 'Sell limit'
  return order.side === 'buy' ? 'Buy' : 'Sell'
}

function SideTag({ side }: { side: 'buy' | 'sell' }) {
  return (
    <span className={side === 'buy' ? 'gain' : 'loss'}>
      {side === 'buy' ? '▲ Buy' : '▼ Sell'}
    </span>
  )
}

interface ActivityPanelProps {
  me: Me
  onSelectSymbol: (symbol: string) => void
  onCancel: (order: Order) => void
  cancelling: string | null
  canTrade: boolean
}

export default function ActivityPanel({
  me,
  onSelectSymbol,
  onCancel,
  cancelling,
  canTrade,
}: ActivityPanelProps) {
  const [view, setView] = useState<View>('positions')
  const open = me.orders.filter((order) => order.status === 'open')
  const fills = [...me.fills].sort((a, b) => b.t - a.t)
  const tabs = [
    { id: 'positions', label: `Positions (${me.positions.length})` },
    { id: 'orders', label: `Orders (${open.length})` },
    { id: 'fills', label: `Fills (${fills.length})` },
  ] as const

  return (
    <section className={styles.activity} aria-label="Your trades">
      <Tabs
        label="Your trades"
        tabs={tabs}
        value={view}
        onChange={setView}
        idPrefix="activity"
      />
      <div
        role="tabpanel"
        id={`activity-panel-${view}`}
        aria-labelledby={`activity-tab-${view}`}
        className={styles.tableWrap}
      >
        {view === 'positions' &&
          (me.positions.length === 0 ? (
            <p className={styles.empty}>
              No shares yet. Use the order ticket to buy.
            </p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Stock</th>
                  <th scope="col">Shares</th>
                  <th scope="col" className={styles.wideOnly}>
                    Avg price
                  </th>
                  <th scope="col">Value</th>
                  <th scope="col">Profit</th>
                </tr>
              </thead>
              <tbody>
                {me.positions.map((position) => (
                  <tr key={position.symbol}>
                    <th scope="row">
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => onSelectSymbol(position.symbol)}
                      >
                        {position.symbol}
                      </button>
                    </th>
                    <td className="num">{position.qty}</td>
                    <td className={`num ${styles.wideOnly}`}>
                      {formatMoney(position.avg_price)}
                    </td>
                    <td className="num">{formatMoney(position.value)}</td>
                    <td>
                      <Delta value={position.unrealized} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        {view === 'orders' &&
          (open.length === 0 ? (
            <p className={styles.empty}>
              No open orders. Limit and stop orders wait here until they fill.
            </p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Shares</th>
                  <th scope="col">Price</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {open.map((order) => (
                  <tr key={order.id}>
                    <th scope="row">{orderLabel(order)}</th>
                    <td>{order.symbol}</td>
                    <td className="num">{order.qty}</td>
                    <td className="num">
                      {formatMoney(
                        (order.type === 'stop'
                          ? order.stop_price
                          : order.limit_price) ?? 0,
                      )}
                    </td>
                    <td className={styles.actionCell}>
                      <Button
                        variant="secondary"
                        size="sm"
                        className={styles.cancelButton}
                        disabled={!canTrade || cancelling === order.id}
                        aria-label={`Cancel ${orderLabel(order).toLowerCase()} for ${order.qty} ${order.symbol}`}
                        onClick={() => onCancel(order)}
                      >
                        {cancelling === order.id ? 'Cancelling…' : 'Cancel'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        {view === 'fills' &&
          (fills.length === 0 ? (
            <p className={styles.empty}>Nothing has filled yet.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Side</th>
                  <th scope="col">Shares</th>
                  <th scope="col">Price</th>
                  <th scope="col" className={styles.wideOnly}>
                    Fee
                  </th>
                </tr>
              </thead>
              <tbody>
                {fills.map((fill, n) => (
                  <tr key={`${fill.order_id}-${n}`}>
                    <th scope="row" className="num">
                      {dayNumber(fill.t)}
                    </th>
                    <td>
                      <SideTag side={fill.side} />
                    </td>
                    <td className="num">
                      {fill.qty} {fill.symbol}
                    </td>
                    <td className="num">{formatMoney(fill.price)}</td>
                    <td className={`num ${styles.wideOnly}`}>
                      {formatMoney(fill.fee)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </div>
    </section>
  )
}
