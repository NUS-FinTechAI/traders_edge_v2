import type { SVGProps } from 'react'

const paths = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5',
  map: 'M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20ZM9 4v13.5M15 6.5V20',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 5-5 2 2-5Z',
  swords:
    'M14.5 4H20v5.5L9 20.5 6.5 18ZM4 14l6 6M3.5 20.5l3-3M9.5 4H4v5.5l3.5 3.5M17.5 17.5l3 3M14 20l6-6',
  trophy:
    'M7 4h10v5a5 5 0 0 1-10 0ZM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3.5M8 20.5h8M9.5 17.5h5',
  chart: 'M4 4v16h16M7.5 15l3.5-4 3 2.5 4.5-6',
  candles: 'M7 3v3M7 14v3M5 6h4v8H5ZM17 7v3M17 18v3M15 10h4v8h-4ZM12 5v14',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5ZM4 20.5A2.5 2.5 0 0 0 6.5 21H20M8 7.5h8',
  quiz: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.3-2.7 3.8M12 17h.01',
  users:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8',
  infinity:
    'M7 8.5a3.5 3.5 0 1 0 0 7c3 0 7-7 10-7a3.5 3.5 0 1 1 0 7c-3 0-7-7-10-7Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  flame:
    'M12 21c-4 0-6.5-2.7-6.5-6.2 0-4.3 4-6.3 4.5-10.8 2.5 1.6 4 4.3 4 6.5 1-.8 1.6-2 1.8-3.3 1.7 1.7 2.7 4.3 2.7 6.9C18.5 18 16 21 12 21Z',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  gem: 'M6.5 4h11L21 9l-9 11L3 9ZM3 9h18M9.5 4 8 9l4 11M14.5 4 16 9l-4 11',
  cash: 'M3 6.5h18v11H3ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 9.5v.01M18 14.5v.01',
  star: 'm12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9Z',
  skull:
    'M12 3C7 3 4 6.6 4 11c0 2.6 1.5 4.5 4 5v4h8v-4c2.5-.5 4-2.4 4-5 0-4.4-3-8-8-8ZM10 17v3M14 17v3M8 9.5l2 1M16 9.5l-2 1M11 14l1-1 1 1',
  sparkle:
    'M12 3c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6ZM18.5 15c.3 2 .9 2.6 2.5 3-1.6.4-2.2 1-2.5 3-.3-2-.9-2.6-2.5-3 1.6-.4 2.2-1 2.5-3Z',
  lock: 'M6 10.5h12V20H6ZM8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6 6 18',
  'chevron-right': 'm9.5 5.5 6.5 6.5-6.5 6.5',
  'chevron-left': 'm14.5 5.5-6.5 6.5 6.5 6.5',
  'arrow-up': 'M12 19V5M6 11l6-6 6 6',
  'arrow-down': 'M12 5v14M6 13l6 6 6-6',
  play: 'M7 4.5v15l12-7.5Z',
  pause: 'M7 5h3.5v14H7ZM13.5 5H17v14h-3.5Z',
  step: 'M5 5v14l9-7ZM17 5v14',
  news: 'M4 5h13v14H6a2 2 0 0 1-2-2ZM17 9h3v8a2 2 0 0 1-2 2M7.5 9h6M7.5 12.5h6M7.5 16h4',
  target:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 12h.01',
  shield: 'M12 3 19.5 6v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6Z',
  crown: 'm4 8 4 4 4-6.5 4 6.5 4-4-1.5 10h-13ZM5.5 21h13',
  flag: 'M5 21V4M5 4.5h11l-2 4 2 4H5',
  scroll:
    'M7 4h11a2 2 0 0 1 2 2v1H9M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7M7 4a2 2 0 0 1 2 2v1M9 11h6M9 14.5h6',
  telescope:
    'm3.5 13.5 13-7 2 4-13 7ZM14 7.8l1-3.3 4 2-2 2.9M10 15.5 8 21M10 15.5 13 21',
  anchor:
    'M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM12 8v13M8 11.5h8M4 13a8 8 0 0 0 16 0',
  lantern: 'M9 3h6M12 3v2M8 8h8l1 9H7ZM8 8a4 3 0 0 1 8 0M7 17h10v3H7ZM12 11v3',
  quill: 'M20 4c-7 0-12 5-13.5 12.5L5 20M20 4c0 6-3.5 10.5-9 11.5M20 4l-7 7',
  chest:
    'M3.5 10h17v9.5h-17ZM3.5 10a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4M10.5 10v3.5h3V10',
  calendar: 'M4 5.5h16V20H4ZM4 9.5h16M8 3.5v4M16 3.5v4',
  podium:
    'M3 14h6v6H3ZM9 9h6v11H9ZM15 12h6v8h-6ZM12 3.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3Z',
  bolt: 'M13 3 5 13.5h6l-1 7.5 8-10.5h-6Z',
  refresh:
    'M20 11a8 8 0 0 0-14.5-4.5M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5M20 20v-4h-4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.5h.01',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  gift: 'M4 10h16v10H4ZM3 6.5h18V10H3ZM12 6.5V20M12 6.5C10.5 3 7 3 7 5s3 1.5 5 1.5ZM12 6.5C13.5 3 17 3 17 5s-3 1.5-5 1.5Z',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2L14.8 21h-3.6l-.3-2.4a7 7 0 0 1-2-1.2l-2 .7-2-3.4 1.7-1.2a7 7 0 0 1 0-3l-1.7-1.2 2-3.4 2 .7a7 7 0 0 1 2-1.2L11.2 3h3.6l.3 2.4a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3Z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  bot: 'M5 9h14v10H5ZM12 9V5.5M12 4h.01M9 13.5h.01M15 13.5h.01M2.5 13v2M21.5 13v2M9.5 16.5h5',
  copy: 'M9 9h11v11H9ZM5 15H4V4h11v1',
  edit: 'M4 20h4L19 9l-4-4L4 16ZM13.5 6.5l4 4',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l5 5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.5 2',
  bag: 'M5 8h14l-1 12H6ZM9 8V6.5a3 3 0 0 1 6 0V8',
} as const

export type IconName = keyof typeof paths

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
  filled?: boolean
  label?: string
}

export default function Icon({
  name,
  size = 20,
  filled = false,
  label,
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 1.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  )
}
