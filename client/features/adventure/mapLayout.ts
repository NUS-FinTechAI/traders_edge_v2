export interface Point {
  x: number
  y: number
}

export interface PlacedNode<T> extends Point {
  node: T
  /** Path position of the main node a reward branches from. */
  branchFrom: Point | null
}

export interface MapLayout<T> {
  width: number
  height: number
  placed: PlacedNode<T>[]
  /** Trail curves between consecutive main nodes; `to` is the placed index. */
  trail: { d: string; to: number }[]
  /** Short straight branches to reward nodes; `to` is the placed index. */
  branches: { d: string; to: number }[]
}

const VERTICAL = { width: 360, start: 70, step: 190, near: 110, far: 250 }
const HORIZONTAL = { height: 400, start: 90, step: 160, near: 110, far: 280 }

/**
 * Lay out a chapter path. Main nodes zigzag along the path axis; a reward
 * node sits on the opposite side of its level, joined by a short branch.
 */
export function layoutMap<T extends { kind: string }>(
  nodes: T[],
  horizontal: boolean,
): MapLayout<T> {
  const mains = nodes.filter((node) => node.kind !== 'reward').length
  const config = horizontal ? HORIZONTAL : VERTICAL
  const along = (index: number) => config.start + index * config.step
  const across = (index: number, reward: boolean) =>
    (index % 2 === 0) !== reward ? config.near : config.far
  const point = (a: number, b: number): Point =>
    horizontal ? { x: a, y: b } : { x: b, y: a }

  const placed: PlacedNode<T>[] = []
  const trail: MapLayout<T>['trail'] = []
  const branches: MapLayout<T>['branches'] = []
  let main = -1
  let previous: Point | null = null

  for (const node of nodes) {
    if (node.kind === 'reward' && previous) {
      const at = point(along(main), across(main, true))
      const shifted = horizontal ? at : { ...at, x: rewardX(at.x) }
      placed.push({ node, ...shifted, branchFrom: previous })
      branches.push({
        d: branch(previous, shifted, horizontal),
        to: placed.length - 1,
      })
      continue
    }
    main += 1
    const at = point(along(main), across(main, false))
    if (previous)
      trail.push({ d: curve(previous, at, horizontal), to: placed.length })
    placed.push({ node, ...at, branchFrom: null })
    previous = at
  }

  const length = config.start * 2 + Math.max(0, mains - 1) * config.step
  return horizontal
    ? { width: length, height: HORIZONTAL.height, placed, trail, branches }
    : {
        width: VERTICAL.width,
        height: length + 60,
        placed,
        trail,
        branches,
      }
}

/** Space under a node's centre taken by its stars and label. */
const LABEL_CLEARANCE = 88
const MEDALLION_CLEARANCE = 36

/**
 * Branch to a reward. Vertically stacked nodes would cross the upper node's
 * label, so the line runs from below that label to the lower medallion.
 */
function branch(from: Point, to: Point, horizontal: boolean): string {
  if (!horizontal) return `M${from.x} ${from.y}L${to.x} ${to.y}`
  const [upper, lower] = from.y < to.y ? [from, to] : [to, from]
  return `M${upper.x} ${upper.y + LABEL_CLEARANCE}L${lower.x} ${lower.y - MEDALLION_CLEARANCE}`
}

/** Keep vertical reward nodes clear of the edge on narrow screens. */
function rewardX(x: number): number {
  return x < VERTICAL.width / 2 ? x - 20 : x + 20
}

function curve(from: Point, to: Point, horizontal: boolean): string {
  if (horizontal) {
    const mid = (to.x - from.x) / 2
    return `M${from.x} ${from.y}C${from.x + mid} ${from.y} ${to.x - mid} ${to.y} ${to.x} ${to.y}`
  }
  // Leave from below the upper label so the trail never crosses text.
  const start = from.y + LABEL_CLEARANCE
  const end = to.y - MEDALLION_CLEARANCE - 6
  const mid = (end - start) / 2
  return `M${from.x} ${start}C${from.x} ${start + mid} ${to.x} ${end - mid} ${to.x} ${end}`
}
