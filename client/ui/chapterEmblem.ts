import type { EmblemName } from './emblemArt.tsx'

const CHAPTER_EMBLEMS: EmblemName[] = [
  'compass',
  'scroll',
  'telescope',
  'anchor',
  'lantern',
  'quill',
  'flag',
  'crown',
]

/** The chapter's emblem from its content `icon`, falling back by number. */
export function chapterEmblem(icon: string, number: number): EmblemName {
  const known = CHAPTER_EMBLEMS.find((name) => name === icon)
  return known ?? CHAPTER_EMBLEMS[(Math.max(1, number) - 1) % 8]
}
