import type { EmblemName } from './emblemArt.tsx'

const BADGE_ART: [RegExp, EmblemName][] = [
  [/step/, 'flag'],
  [/plan/, 'scroll'],
  [/learn/, 'bolt'],
  [/chart/, 'candles'],
  [/risk/, 'shield'],
  [/snip/, 'target'],
  [/fee/, 'coin'],
  [/cool|calm/, 'anchor'],
  [/patien/, 'lantern'],
  [/explor/, 'compass'],
  [/gate/, 'shield'],
  [/boss|slay/, 'crown'],
  [/streak/, 'flame'],
  [/quiz/, 'book'],
  [/rank/, 'trophy'],
  [/calibr/, 'telescope'],
]

export function badgeArt(id: string): EmblemName {
  return BADGE_ART.find(([pattern]) => pattern.test(id))?.[1] ?? 'medal'
}
