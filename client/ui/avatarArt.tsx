import type { CSSProperties, ReactElement } from 'react'
import { EmblemArt, type EmblemName } from './emblemArt.tsx'

/* Muted illustration palette for avatar portraits (flat fills, no gradients). */
const C = {
  cream: '#f2ead3',
  sand: '#d9c39a',
  tan: '#b98f62',
  brown: '#8a5a3c',
  bark: '#5e3d29',
  ink: '#1f1a16',
  grey: '#9aa3a6',
  stone: '#6c7a80',
  moss: '#3f7d5c',
  fern: '#7fa66a',
  teal: '#3a7f86',
  sea: '#4f86a3',
  gold: '#e0b654',
  amber: '#d9803f',
  rust: '#b5523f',
  rose: '#d99a8c',
  plum: '#7a62b8',
  lilac: '#a993d9',
  skin1: '#f0c9a0',
  skin2: '#c98f63',
  skin3: '#8d5a3b',
  skin4: '#e3b48a',
}

const BG = {
  forest: '#24483a',
  pine: '#1f3d33',
  lagoon: '#1f4249',
  dusk: '#3a3350',
  clay: '#4a3527',
  olive: '#3a4527',
  harbor: '#22404a',
  ember: '#4a2c24',
}

interface Art {
  bg: string
  art: ReactElement
}

const eye = (x: number, y: number, r = 2.4) => (
  <>
    <circle cx={x} cy={y} r={r} fill={C.ink} />
    <circle cx={x + r * 0.35} cy={y - r * 0.35} r={r * 0.32} fill={C.cream} />
  </>
)

const animals: Record<string, Art> = {
  bull: {
    bg: BG.forest,
    art: (
      <>
        <path d="M19 25c-8 0-11-6-9-13 2 5 6 7 11 7Z" fill={C.cream} />
        <path d="M45 25c8 0 11-6 9-13-2 5-6 7-11 7Z" fill={C.cream} />
        <ellipse cx="15" cy="30" rx="5" ry="3.5" fill={C.brown} />
        <ellipse cx="49" cy="30" rx="5" ry="3.5" fill={C.brown} />
        <rect x="18" y="19" width="28" height="34" rx="13" fill={C.brown} />
        <ellipse cx="32" cy="45" rx="11.5" ry="8" fill={C.sand} />
        <circle cx="28" cy="45" r="1.8" fill={C.bark} />
        <circle cx="36" cy="45" r="1.8" fill={C.bark} />
        {eye(26, 33)}
        {eye(38, 33)}
        <path
          d="M27 52c2 3 8 3 10 0"
          stroke={C.gold}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  },
  bear: {
    bg: BG.lagoon,
    art: (
      <>
        <circle cx="19" cy="20" r="7" fill={C.brown} />
        <circle cx="45" cy="20" r="7" fill={C.brown} />
        <circle cx="19" cy="20" r="3.5" fill={C.tan} />
        <circle cx="45" cy="20" r="3.5" fill={C.tan} />
        <circle cx="32" cy="36" r="18" fill={C.brown} />
        <ellipse cx="32" cy="43" rx="9" ry="7" fill={C.sand} />
        <ellipse cx="32" cy="40" rx="3.5" ry="2.4" fill={C.ink} />
        <path
          d="M29 46c1.5 1.5 4.5 1.5 6 0"
          stroke={C.ink}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
        {eye(25, 33)}
        {eye(39, 33)}
      </>
    ),
  },
  owl: {
    bg: BG.dusk,
    art: (
      <>
        <path d="M16 22 14 10l10 7ZM48 22l2-12-10 7Z" fill={C.bark} />
        <ellipse cx="32" cy="38" rx="18" ry="20" fill={C.bark} />
        <ellipse cx="32" cy="46" rx="10" ry="10" fill={C.tan} />
        <circle cx="25" cy="32" r="8" fill={C.cream} />
        <circle cx="39" cy="32" r="8" fill={C.cream} />
        {eye(25, 32, 3.6)}
        {eye(39, 32, 3.6)}
        <path d="M29 38h6l-3 5Z" fill={C.gold} />
      </>
    ),
  },
  fox: {
    bg: BG.pine,
    art: (
      <>
        <path d="M13 12 26 27 15 32Z" fill={C.amber} />
        <path d="M51 12 38 27l11 5Z" fill={C.amber} />
        <path d="M16 17l6 9-5 3Z" fill={C.bark} />
        <path d="M48 17l-6 9 5 3Z" fill={C.bark} />
        <path d="M14 27 24 25h16l10 2-4 14-14 12-14-12Z" fill={C.amber} />
        <path d="M17 39 32 53l15-14-8 2-7 5-7-5Z" fill={C.cream} />
        <circle cx="32" cy="49" r="2.6" fill={C.ink} />
        {eye(25, 36)}
        {eye(39, 36)}
      </>
    ),
  },
  eagle: {
    bg: BG.harbor,
    art: (
      <>
        <path d="M8 64c3-15 12-20 24-20s21 5 24 20Z" fill={C.bark} />
        <ellipse cx="32" cy="31" rx="15" ry="17" fill={C.cream} />
        <path
          d="M22 26c3-2 6-2 8 0M34 26c2-2 5-2 8 0"
          stroke={C.stone}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        {eye(26, 30)}
        {eye(38, 30)}
        <path d="M26 36h12l-4 9c-1 2-3 2-4 0Z" fill={C.gold} />
      </>
    ),
  },
  whale: {
    bg: BG.lagoon,
    art: (
      <>
        <path
          d="M28 18c0-4 2-6 4-8M32 18v-9M36 18c0-4-2-6-4-8"
          stroke={C.cream}
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M48 36c4-6 9-8 12-7-1 4-4 7-8 8 4 1 7 4 8 8-3 1-8-1-12-7Z"
          fill={C.sea}
        />
        <ellipse cx="30" cy="38" rx="21" ry="15" fill={C.sea} />
        <path
          d="M11 41c5 8 13 12 21 12s15-4 18-10c-7 3-26 3-39-2Z"
          fill={C.cream}
        />
        {eye(21, 35)}
        <path
          d="M14 42c3 1 6 1 9 0"
          stroke={C.ink}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  },
  tortoise: {
    bg: BG.olive,
    art: (
      <>
        <rect x="16" y="43" width="6" height="9" rx="3" fill={C.fern} />
        <rect x="36" y="43" width="6" height="9" rx="3" fill={C.fern} />
        <circle cx="50" cy="38" r="7" fill={C.fern} />
        {eye(52, 36, 1.8)}
        <path d="M9 45a20 19 0 0 1 40 0Z" fill={C.moss} />
        <path
          d="M19 45v-7l10-6 10 6v7M29 32v-6"
          stroke={C.fern}
          strokeWidth="2"
          fill="none"
          strokeLinejoin="round"
        />
        <rect x="8" y="44" width="42" height="4" rx="2" fill={C.tan} />
      </>
    ),
  },
  hare: {
    bg: BG.forest,
    art: (
      <>
        <ellipse cx="25" cy="17" rx="5" ry="14" fill={C.grey} />
        <ellipse cx="39" cy="17" rx="5" ry="14" fill={C.grey} />
        <ellipse cx="25" cy="18" rx="2.3" ry="10" fill={C.rose} />
        <ellipse cx="39" cy="18" rx="2.3" ry="10" fill={C.rose} />
        <circle cx="32" cy="40" r="15" fill={C.grey} />
        <ellipse cx="32" cy="46" rx="7" ry="5" fill={C.cream} />
        <path d="M30 43h4l-2 2.5Z" fill={C.rose} />
        <path
          d="M18 45h8M38 45h8"
          stroke={C.cream}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        {eye(26, 37)}
        {eye(38, 37)}
      </>
    ),
  },
  shark: {
    bg: BG.harbor,
    art: (
      <>
        <path d="M30 22 36 8l8 16Z" fill={C.stone} />
        <ellipse cx="32" cy="38" rx="22" ry="15" fill={C.stone} />
        <path
          d="M12 42c6 7 13 10 20 10s14-3 20-10c-12 3-28 3-40 0Z"
          fill={C.cream}
        />
        <path
          d="M44 33v6M48 33v6"
          stroke={C.ink}
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        {eye(22, 35)}
        <path
          d="M14 43c5 3 11 3 17 1"
          stroke={C.ink}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  },
  parrot: {
    bg: BG.pine,
    art: (
      <>
        <path d="M26 16c0-6 4-9 8-9-1 3 0 6 2 8Z" fill={C.moss} />
        <path d="M30 17c2-5 7-7 11-6-2 2-3 5-3 8Z" fill={C.sea} />
        <circle cx="32" cy="34" r="17" fill={C.rust} />
        <ellipse cx="27" cy="31" rx="7" ry="6" fill={C.cream} />
        {eye(27, 31, 2.6)}
        <path d="M36 30c8 0 12 5 11 12-3-3-6-4-10-3Z" fill={C.gold} />
        <path d="M37 39c3 0 6 1 7 4-3 0-5 0-7-1Z" fill={C.bark} />
        <path
          d="M16 46c6 8 26 8 32 0"
          stroke={C.sea}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  },
  octopus: {
    bg: BG.dusk,
    art: (
      <>
        <path
          d="M17 40c-2 6-6 9-9 9M25 42c0 6-2 10-5 12M39 42c0 6 2 10 5 12M47 40c2 6 6 9 9 9"
          stroke={C.lilac}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M14 36a18 20 0 0 1 36 0v4H14Z" fill={C.lilac} />
        <circle cx="25" cy="33" r="5" fill={C.cream} />
        <circle cx="39" cy="33" r="5" fill={C.cream} />
        {eye(25, 34, 2.4)}
        {eye(39, 34, 2.4)}
        <circle cx="32" cy="20" r="2" fill={C.plum} />
        <circle cx="24" cy="23" r="1.5" fill={C.plum} />
        <circle cx="40" cy="23" r="1.5" fill={C.plum} />
        <path
          d="M29 41c2 1.5 4 1.5 6 0"
          stroke={C.ink}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  },
  lion: {
    bg: BG.clay,
    art: (
      <>
        <circle cx="32" cy="34" r="22" fill={C.amber} />
        <circle cx="14" cy="24" r="6" fill={C.amber} />
        <circle cx="50" cy="24" r="6" fill={C.amber} />
        <circle cx="12" cy="40" r="6" fill={C.amber} />
        <circle cx="52" cy="40" r="6" fill={C.amber} />
        <circle cx="21" cy="20" r="3.5" fill={C.sand} />
        <circle cx="43" cy="20" r="3.5" fill={C.sand} />
        <circle cx="32" cy="35" r="14.5" fill={C.sand} />
        <ellipse cx="32" cy="42" rx="7.5" ry="5.5" fill={C.cream} />
        <path d="M29 38h6l-3 3Z" fill={C.bark} />
        {eye(26, 32)}
        {eye(38, 32)}
      </>
    ),
  },
}

const GUIDES: {
  emblem: EmblemName
  bg: string
  main: string
  aliases: string[]
}[] = [
  {
    emblem: 'compass',
    bg: BG.harbor,
    main: C.gold,
    aliases: ['harbor', 'basics'],
  },
  { emblem: 'scroll', bg: BG.clay, main: C.amber, aliases: ['order', 'bay'] },
  {
    emblem: 'telescope',
    bg: BG.lagoon,
    main: C.sea,
    aliases: ['chart', 'cliff'],
  },
  { emblem: 'anchor', bg: BG.pine, main: C.teal, aliases: ['risk', 'reef'] },
  {
    emblem: 'lantern',
    bg: BG.ember,
    main: C.gold,
    aliases: ['indicator', 'isle'],
  },
  { emblem: 'quill', bg: BG.dusk, main: C.lilac, aliases: ['news', 'coast'] },
  {
    emblem: 'flag',
    bg: BG.olive,
    main: C.rust,
    aliases: ['strategy', 'summit'],
  },
  {
    emblem: 'crown',
    bg: BG.forest,
    main: C.gold,
    aliases: ['mindset', 'peak', 'psych'],
  },
]

function guideArt(index: number): Art {
  const guide = GUIDES[index]
  const vars = {
    '--e-main': guide.main,
    '--e-accent': C.tan,
    '--e-dark': C.ink,
    '--e-light': C.cream,
  } as CSSProperties
  return {
    bg: guide.bg,
    art: (
      <g style={vars} transform="translate(12 12) scale(0.625)">
        <EmblemArt name={guide.emblem} />
      </g>
    ),
  }
}

const face = (skin: string, y = 36) => (
  <>
    <circle cx="32" cy={y} r="15" fill={skin} />
    {eye(26.5, y - 1, 2.1)}
    {eye(37.5, y - 1, 2.1)}
    <path
      d={`M27 ${y + 6}c3 3 7 3 10 0`}
      stroke={C.ink}
      strokeWidth="1.8"
      fill="none"
      strokeLinecap="round"
    />
  </>
)

const starters: Art[] = [
  {
    bg: BG.harbor,
    art: (
      <>
        <path d="M14 64c2-9 9-13 18-13s16 4 18 13Z" fill={C.sea} />
        {face(C.skin1)}
        <path
          d="M12 26c6-4 14-12 20-12s14 8 20 12c-6 2-13 3-20 3s-14-1-20-3Z"
          fill={C.bark}
        />
        <circle cx="32" cy="20" r="3" fill={C.gold} />
      </>
    ),
  },
  {
    bg: BG.olive,
    art: (
      <>
        <path d="M14 64c2-9 9-13 18-13s16 4 18 13Z" fill={C.moss} />
        {face(C.skin2)}
        <ellipse cx="32" cy="25" rx="23" ry="5" fill={C.tan} />
        <path d="M20 25c0-8 5-13 12-13s12 5 12 13Z" fill={C.sand} />
        <rect x="20" y="21" width="24" height="3.5" fill={C.bark} />
      </>
    ),
  },
  {
    bg: BG.ember,
    art: (
      <>
        <path d="M14 64c2-9 9-13 18-13s16 4 18 13Z" fill={C.cream} />
        <path d="M20 58h24" stroke={C.rust} strokeWidth="3" />
        {face(C.skin3)}
        <path
          d="M17 31c0-9 7-14 15-14s15 5 15 14c-5-2-10-3-15-3s-10 1-15 3Z"
          fill={C.rust}
        />
        <path d="M46 28l7 3-6 4Z" fill={C.rust} />
        <circle cx="24" cy="23" r="1.6" fill={C.cream} />
        <circle cx="34" cy="21" r="1.6" fill={C.cream} />
      </>
    ),
  },
  {
    bg: BG.dusk,
    art: (
      <>
        <path d="M14 64c2-9 9-13 18-13s16 4 18 13Z" fill={C.plum} />
        {face(C.skin4)}
        <circle
          cx="26.5"
          cy="35"
          r="4.6"
          stroke={C.ink}
          strokeWidth="1.6"
          fill="none"
        />
        <circle
          cx="37.5"
          cy="35"
          r="4.6"
          stroke={C.ink}
          strokeWidth="1.6"
          fill="none"
        />
        <path d="M31 35h2" stroke={C.ink} strokeWidth="1.6" />
        <path d="M17 27c1-8 7-12 15-12s14 4 15 12Z" fill={C.ink} />
        <path d="M12 23 32 15l20 8-20 6Z" fill={C.bark} />
        <path
          d="M48 24v9"
          stroke={C.gold}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </>
    ),
  },
]

/** Map-reward avatars whose ids do not name their animal. */
const REWARD_ANIMALS: Record<string, string> = {
  'ch1-explorer': 'parrot',
  'ch3-lookout': 'owl',
  'ch5-signalist': 'fox',
  'ch8-stoic': 'tortoise',
}

/** Artwork for an avatar id such as `bull`, `avatar-fox` or `avatar-guide-3`. */
export function avatarArt(id: string): Art | null {
  const key = id.toLowerCase().replace(/^avatar-/, '')
  if (animals[key]) return animals[key]
  if (REWARD_ANIMALS[key]) return animals[REWARD_ANIMALS[key]]
  const guide = /^guide-(\d+)$/.exec(key)
  if (guide) {
    const index = Number(guide[1]) - 1
    return index >= 0 && index < GUIDES.length ? guideArt(index) : null
  }
  if (key.startsWith('guide-')) {
    const index = GUIDES.findIndex((entry) =>
      entry.aliases.some((alias) => key.includes(alias)),
    )
    return index >= 0 ? guideArt(index) : null
  }
  const starter = /^starter-(\d+)$/.exec(key)
  if (starter) return starters[Number(starter[1]) - 1] ?? null
  return null
}
