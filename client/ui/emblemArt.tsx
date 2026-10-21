import type { ReactElement } from 'react'

/*
 * Flat emblem drawings on a 64 × 64 grid. Colours come from four custom
 * properties set by the caller: --e-main, --e-accent, --e-dark and --e-light.
 */
const M = 'var(--e-main)'
const A = 'var(--e-accent)'
const D = 'var(--e-dark)'
const L = 'var(--e-light)'

const line = {
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const art = {
  compass: (
    <>
      <circle cx="32" cy="32" r="25" fill={M} />
      <circle cx="32" cy="32" r="18" fill={D} />
      <path d="M32 8v5M32 51v5M8 32h5M51 32h5" stroke={D} strokeWidth="3" />
      <path d="M32 15 38.5 32h-13Z" fill={L} />
      <path d="M32 49 25.5 32h13Z" fill={M} />
      <circle cx="32" cy="32" r="3.2" fill={A} />
    </>
  ),
  map: (
    <>
      <path d="M8 16 23 11l18 6 15-5v36l-15 5-18-6-15 5Z" fill={L} />
      <path d="M23 11l18 6v36l-18-6Z" fill={M} />
      <path
        d="M13 43c6-9 11-1 16-9s10-6 13-10"
        stroke={D}
        strokeWidth="2.5"
        strokeDasharray="3 4"
        {...line}
      />
      <path d="m43 16 7 7M50 16l-7 7" stroke={A} strokeWidth="3.2" {...line} />
    </>
  ),
  swords: (
    <>
      <path d="M14 12 43 41M50 12 21 41" stroke={L} strokeWidth="6" {...line} />
      <path d="M36 48 48 36M16 36l12 12" stroke={M} strokeWidth="5" {...line} />
      <path d="m44 44 7 7M20 44l-7 7" stroke={M} strokeWidth="5" {...line} />
      <circle cx="53" cy="53" r="3.5" fill={A} />
      <circle cx="11" cy="53" r="3.5" fill={A} />
    </>
  ),
  scroll: (
    <>
      <rect x="15" y="13" width="34" height="38" rx="3" fill={L} />
      <rect x="10" y="9" width="44" height="9" rx="4.5" fill={M} />
      <rect x="10" y="46" width="44" height="9" rx="4.5" fill={M} />
      <path
        d="M21 26h22M21 32h22M21 38h14"
        stroke={D}
        strokeWidth="2.6"
        {...line}
      />
    </>
  ),
  candles: (
    <>
      <path
        d="M17 12v40M32 8v34M47 18v38"
        stroke={L}
        strokeWidth="2.5"
        {...line}
      />
      <rect x="12" y="20" width="10" height="22" rx="2" fill="var(--gain)" />
      <rect x="27" y="15" width="10" height="16" rx="2" fill="var(--loss)" />
      <rect x="42" y="26" width="10" height="22" rx="2" fill="var(--gain)" />
    </>
  ),
  chest: (
    <>
      <path d="M11 30v-6c0-6 4-10 10-10h22c6 0 10 4 10 10v6Z" fill={M} />
      <rect x="11" y="30" width="42" height="22" rx="2.5" fill={M} />
      <rect x="11" y="28" width="42" height="5" fill={D} />
      <rect x="19" y="14" width="4" height="38" fill={A} />
      <rect x="41" y="14" width="4" height="38" fill={A} />
      <rect x="27.5" y="25" width="9" height="12" rx="2" fill={L} />
      <circle cx="32" cy="30" r="1.8" fill={D} />
    </>
  ),
  'chest-open': (
    <>
      <path d="M13 22 17 8h30l4 14Z" fill={M} />
      <path d="M17 8h30" stroke={A} strokeWidth="3" {...line} />
      <rect x="11" y="28" width="42" height="24" rx="2.5" fill={M} />
      <rect x="11" y="28" width="42" height="5" fill={D} />
      <circle cx="24" cy="27" r="4" fill={A} />
      <circle cx="33" cy="25" r="4.5" fill={L} />
      <circle cx="41" cy="27" r="3.5" fill={A} />
      <rect x="19" y="28" width="4" height="24" fill={A} />
      <rect x="41" y="28" width="4" height="24" fill={A} />
    </>
  ),
  crown: (
    <>
      <path d="M10 22 21 33l11-19 11 19 11-11-4 25H14Z" fill={M} />
      <rect x="14" y="43" width="36" height="9" rx="2" fill={A} />
      <circle cx="10" cy="21" r="3.6" fill={L} />
      <circle cx="32" cy="13" r="3.6" fill={L} />
      <circle cx="54" cy="21" r="3.6" fill={L} />
      <circle cx="32" cy="47.5" r="2.6" fill={D} />
    </>
  ),
  flag: (
    <>
      <rect x="14" y="8" width="4.5" height="46" rx="2.2" fill={L} />
      <rect x="9" y="51" width="15" height="5" rx="2.5" fill={A} />
      <path d="M18.5 12H51l-7 10 7 10H18.5Z" fill={M} />
      <circle cx="31" cy="22" r="4.5" fill={L} />
    </>
  ),
  telescope: (
    <>
      <path d="M8 31 43 14l5 9-35 17Z" fill={M} />
      <path d="m43 14 9-4 5 9-9 4Z" fill={A} />
      <path
        d="M28 31 20 55M28 31l8 24M28 31v24"
        stroke={L}
        strokeWidth="3"
        {...line}
      />
      <circle cx="28" cy="30" r="3.5" fill={D} />
    </>
  ),
  anchor: (
    <>
      <circle cx="32" cy="12" r="5" stroke={L} strokeWidth="4" fill="none" />
      <rect x="29.5" y="16" width="5" height="35" rx="2" fill={L} />
      <rect x="19" y="22" width="26" height="5" rx="2.5" fill={M} />
      <path
        d="M13 36c1 11 8 16 19 16s18-5 19-16"
        stroke={L}
        strokeWidth="5"
        {...line}
      />
      <path d="m8 39 5-9 5 9ZM46 39l5-9 5 9Z" fill={M} />
    </>
  ),
  lantern: (
    <>
      <path d="M24 14c3-8 13-8 16 0" stroke={L} strokeWidth="3" {...line} />
      <path d="M19 19h26l-4-6H23Z" fill={M} />
      <rect x="21" y="19" width="22" height="26" rx="3" fill={L} />
      <path d="M32 25c4 5 4 9 0 13-4-4-4-8 0-13Z" fill={A} />
      <rect x="21" y="19" width="22" height="3" fill={M} />
      <rect x="17" y="45" width="30" height="7" rx="2.5" fill={M} />
    </>
  ),
  quill: (
    <>
      <rect x="12" y="42" width="22" height="13" rx="3" fill={M} />
      <rect x="15.5" y="38" width="15" height="5" rx="2" fill={A} />
      <path d="M25 40C29 24 39 12 55 8c-2 15-10 27-27 33Z" fill={L} />
      <path d="M24 42 47 16" stroke={D} strokeWidth="2.2" {...line} />
    </>
  ),
  book: (
    <>
      <path d="M8 15c8-3 16-2 23 3v35c-7-5-15-6-23-3Z" fill={L} />
      <path d="M56 15c-8-3-16-2-23 3v35c7-5 15-6 23-3Z" fill={L} />
      <path
        d="M5 18v37c9-4 18-3 27 2 9-5 18-6 27-2V18"
        stroke={M}
        strokeWidth="3"
        {...line}
      />
      <path
        d="M39 27a5 5 0 1 1 6.5 4.8c-1.5.6-2.3 1.6-2.3 3.4"
        stroke={M}
        strokeWidth="3"
        {...line}
      />
      <circle cx="43.2" cy="41" r="2" fill={M} />
      <path
        d="M14 26h11M14 32h11M14 38h8"
        stroke={D}
        strokeWidth="2.2"
        {...line}
      />
    </>
  ),
  users: (
    <>
      <circle cx="41" cy="21" r="8.5" fill={M} />
      <path d="M27 50a14 14 0 0 1 28 0Z" fill={M} />
      <circle cx="25" cy="26" r="9.5" fill={L} />
      <path d="M8 57a17 17 0 0 1 34 0Z" fill={L} />
    </>
  ),
  infinity: (
    <>
      <path
        d="M21 21c-13 0-13 22 0 22 9 0 13-22 22-22 13 0 13 22 0 22-9 0-13-22-22-22Z"
        stroke={M}
        strokeWidth="6.5"
        {...line}
      />
      <circle cx="21" cy="32" r="3" fill={A} />
      <circle cx="43" cy="32" r="3" fill={L} />
    </>
  ),
  trophy: (
    <>
      <path
        d="M20 23H12v1a9 9 0 0 0 9 9M44 23h8v1a9 9 0 0 1-9 9"
        stroke={M}
        strokeWidth="3.5"
        {...line}
      />
      <path d="M19 11h26v15a13 13 0 0 1-26 0Z" fill={M} />
      <rect x="29" y="38" width="6" height="8" fill={M} />
      <rect x="20" y="45" width="24" height="8" rx="2" fill={A} />
      <path
        d="m32 16 2.4 4.8 5.2.8-3.8 3.6.9 5.2-4.7-2.5-4.7 2.5.9-5.2-3.8-3.6 5.2-.8Z"
        fill={L}
      />
    </>
  ),
  shield: (
    <>
      <path d="M32 7 53 14v16c0 13-9 21-21 26-12-5-21-13-21-26V14Z" fill={M} />
      <path
        d="M22 27c3-6 7-8 10-8s7 2 10 8"
        stroke={D}
        strokeWidth="3"
        {...line}
      />
      <path
        d="M24 27v18M32 22v26M40 27v18"
        stroke={D}
        strokeWidth="3"
        {...line}
      />
    </>
  ),
  calendar: (
    <>
      <rect x="10" y="14" width="44" height="40" rx="5" fill={L} />
      <path d="M10 19a5 5 0 0 1 5-5h34a5 5 0 0 1 5 5v8H10Z" fill={M} />
      <rect x="20" y="8" width="4.5" height="11" rx="2.2" fill={A} />
      <rect x="39.5" y="8" width="4.5" height="11" rx="2.2" fill={A} />
      <path d="m22 39 7 7 13-13" stroke={M} strokeWidth="4" {...line} />
    </>
  ),
  gem: (
    <>
      <path d="M20 13h24l11 13-23 27L9 26Z" fill={M} />
      <path
        d="M9 26h46M20 13l6 13 6 27 6-27 6-13"
        stroke={L}
        strokeWidth="2"
        opacity="0.75"
        {...line}
      />
    </>
  ),
  coin: (
    <>
      <circle cx="32" cy="32" r="23" fill={M} />
      <circle
        cx="32"
        cy="32"
        r="16.5"
        stroke={D}
        strokeWidth="2.5"
        fill="none"
      />
      <path
        d="m32 21 3.2 6.6 7.2 1-5.2 5 1.3 7.2-6.5-3.4-6.5 3.4 1.3-7.2-5.2-5 7.2-1Z"
        fill={D}
      />
    </>
  ),
  podium: (
    <>
      <rect x="24" y="24" width="16" height="31" rx="2" fill={M} />
      <rect x="8" y="34" width="16" height="21" rx="2" fill={L} />
      <rect x="40" y="40" width="16" height="15" rx="2" fill={A} />
      <path
        d="m32 8 2.3 4.6 5 .8-3.6 3.5.8 5-4.5-2.4-4.5 2.4.8-5-3.6-3.5 5-.8Z"
        fill={A}
      />
    </>
  ),
  medal: (
    <>
      <path d="M21 6h9l7 18h-9Z" fill="var(--info)" />
      <path d="M43 6h-9l-7 18h9Z" fill="var(--loss)" />
      <circle cx="32" cy="39" r="17" fill={M} />
      <circle
        cx="32"
        cy="39"
        r="11.5"
        stroke={D}
        strokeWidth="2.2"
        fill="none"
      />
      <path
        d="m32 31 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8Z"
        fill={L}
      />
    </>
  ),
  star: (
    <path
      d="m32 7 7.6 15.4 17 2.5-12.3 12 2.9 16.9L32 45.8l-15.2 8 2.9-16.9-12.3-12 17-2.5Z"
      fill={M}
    />
  ),
  lock: (
    <>
      <path
        d="M22 28v-6a10 10 0 0 1 20 0v6"
        stroke={L}
        strokeWidth="5"
        {...line}
      />
      <rect x="15" y="27" width="34" height="26" rx="5" fill={M} />
      <circle cx="32" cy="38" r="3.5" fill={D} />
      <rect x="30.5" y="39" width="3" height="7" rx="1.5" fill={D} />
    </>
  ),
  target: (
    <>
      <circle cx="30" cy="34" r="22" fill={M} />
      <circle cx="30" cy="34" r="15" fill={L} />
      <circle cx="30" cy="34" r="8" fill={M} />
      <path d="M30 34 52 12" stroke={D} strokeWidth="3" {...line} />
      <path d="m46 10 6 2 2 6" stroke={D} strokeWidth="3" {...line} />
    </>
  ),
  bolt: <path d="M36 6 14 36h15l-4 22 25-32H35Z" fill={M} />,
  flame: (
    <>
      <path
        d="M32 57c-11 0-18-7-18-17 0-12 11-17 12-30 7 4 11 12 11 18 3-2 4.5-5.5 5-9 4.5 4.5 7 11.5 7 18.5C49 48 42 57 32 57Z"
        fill={M}
      />
      <path
        d="M32 57c-5 0-8-3.5-8-8 0-6 6-8 6-14 4 3 9 7 9 13 0 5-3 9-7 9Z"
        fill={A}
      />
    </>
  ),
} satisfies Record<string, ReactElement>

export type EmblemName = keyof typeof art

export function EmblemArt({ name }: { name: EmblemName }) {
  return art[name]
}
