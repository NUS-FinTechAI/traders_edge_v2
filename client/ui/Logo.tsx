/** One compass arm, pointing north, that ends on the centre ring. */
const ARM = 'M32 2 38.38 19.53A14 14 0 0 0 25.62 19.53Z'
/** A short diagonal tick between two arms. */
const TICK = 'M32 10 34.91 18.31H29.09Z'

/**
 * The Trader’s Edge mark: a compass star with a candlestick at its centre.
 * North is full gold and the other points are dimmed; the star follows the
 * gold token and the candle the gain token, so the mark adapts to every theme.
 * Matches `client/public/favicon.svg`.
 */
export default function Logo({
  size = 24,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ color: 'var(--gold)' }}
    >
      <g fill="currentColor">
        <g opacity="0.5">
          {[45, 135, 225, 315].map((angle) => (
            <path key={angle} d={TICK} transform={`rotate(${angle} 32 32)`} />
          ))}
        </g>
        <g opacity="0.7">
          {[90, 180, 270].map((angle) => (
            <path key={angle} d={ARM} transform={`rotate(${angle} 32 32)`} />
          ))}
        </g>
        <path d={ARM} />
      </g>
      <circle
        cx="32"
        cy="32"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M32 21.5v21"
        stroke="var(--gain)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="27.5" y="26" width="9" height="12" rx="1.5" fill="var(--gain)" />
    </svg>
  )
}
