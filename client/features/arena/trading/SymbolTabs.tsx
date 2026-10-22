import type { Asset } from '../../../services/gameService.ts'
import { Delta } from '../../../ui/Chip.tsx'
import { formatMoney } from '../../../ui/format.ts'
import { tourTarget } from '../tour/tour.ts'
import styles from './Trading.module.css'

export default function SymbolTabs({
  assets,
  value,
  onChange,
}: {
  assets: Asset[]
  value: string
  onChange: (symbol: string) => void
}) {
  return (
    <div
      className={styles.symbols}
      role="group"
      aria-label="Stocks"
      {...tourTarget('symbols')}
    >
      {assets.map((asset) => (
        <button
          key={asset.symbol}
          type="button"
          className={styles.symbol}
          aria-pressed={asset.symbol === value}
          onClick={() => onChange(asset.symbol)}
        >
          <span className={styles.symbolTop}>
            <strong>{asset.symbol}</strong>
            <span className="num">{formatMoney(asset.price)}</span>
          </span>
          <span className={styles.symbolBottom}>
            <span className={styles.symbolName}>{asset.name}</span>
            <Delta pct={asset.change_pct} />
          </span>
        </button>
      ))}
    </div>
  )
}
