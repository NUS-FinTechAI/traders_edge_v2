/**
 * The Trader’s Edge mark: a compass ring with a north point and three rising
 * candles. The ring follows the text colour and the candles the gain token, so
 * the mark adapts to every theme. Matches `client/public/favicon.svg`.
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
      <circle
        cx="32"
        cy="34"
        r="23"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path d="M32 3 38 13H26Z" fill="currentColor" />
      <path
        d="M23 36v13M32 29v17M41 22v18"
        stroke="var(--gain)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <g fill="var(--gain)">
        <rect x="19.5" y="38" width="7" height="8" rx="1.5" />
        <rect x="28.5" y="32" width="7" height="9" rx="1.5" />
        <rect x="37.5" y="25" width="7" height="10" rx="1.5" />
      </g>
    </svg>
  )
}
