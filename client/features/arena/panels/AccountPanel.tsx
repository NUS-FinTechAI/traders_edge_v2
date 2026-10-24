import type { Me } from '../../../services/gameService.ts'
import { Delta } from '../../../ui/Chip.tsx'
import Icon from '../../../ui/Icon.tsx'
import { formatMoney, formatPct } from '../../../ui/format.ts'
import { strategyLabel } from '../labels.ts'
import Panel from './Panel.tsx'
import styles from './panels.module.css'

export default function AccountPanel({ me, bare }: { me: Me; bare?: boolean }) {
  const holdings = me.equity - me.cash
  const overLimit =
    me.plan !== null && me.max_drawdown_pct > me.plan.max_loss_pct
  return (
    <Panel title="Your account" bare={bare}>
      <dl className={styles.stats}>
        <div>
          <dt>Cash</dt>
          <dd className="num">{formatMoney(me.cash)}</dd>
        </div>
        <div>
          <dt>Holdings value</dt>
          <dd className="num">{formatMoney(holdings)}</dd>
        </div>
        <div>
          <dt>Total value</dt>
          <dd className="num">{formatMoney(me.equity)}</dd>
        </div>
        <div>
          <dt>Profit</dt>
          <dd>
            <Delta value={me.profit} pct={me.profit_pct} />
          </dd>
        </div>
      </dl>
      {me.plan && (
        <p className={styles.planLine}>
          <Icon name="target" size={16} />
          <span>
            Plan: {strategyLabel(me.plan.strategy)} · max loss{' '}
            {me.plan.max_loss_pct}%
          </span>
          <span className={overLimit ? styles.planOver : styles.planOk}>
            {overLimit ? (
              <>
                <Icon name="info" size={14} /> Worst drop{' '}
                <span className="num">{formatPct(me.max_drawdown_pct)}</span>,
                past your limit
              </>
            ) : (
              <>
                <Icon name="check" size={14} /> Worst drop{' '}
                <span className="num">{formatPct(me.max_drawdown_pct)}</span>
              </>
            )}
          </span>
        </p>
      )}
    </Panel>
  )
}
