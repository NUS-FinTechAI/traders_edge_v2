import { useRef, useState, type KeyboardEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.ts'
import {
  getChapterMap,
  type ChapterMap,
  type MapNode,
} from '../../services/campaignService.ts'
import { HttpError } from '../../services/httpService.ts'
import Button, { ButtonLink } from '../../ui/Button.tsx'
import Chip from '../../ui/Chip.tsx'
import Emblem from '../../ui/Emblem.tsx'
import Icon from '../../ui/Icon.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ProgressBar from '../../ui/ProgressBar.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import Stars from '../../ui/Stars.tsx'
import { EmptyState } from '../../ui/States.tsx'
import { useMediaQuery } from '../../ui/hooks.ts'
import useResource from '../../ui/useResource.ts'
import usePlayNow from '../home/usePlayNow.ts'
import { layoutMap } from './mapLayout.ts'
import NodePopup from './NodePopup.tsx'
import RewardArt from './RewardArt.tsx'
import StarLegend from './StarLegend.tsx'
import styles from './ChapterMap.module.css'

async function loadMap(
  chapterId: string,
  signal: AbortSignal,
): Promise<ChapterMap | null> {
  try {
    return await getChapterMap(chapterId, signal)
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) return null
    throw error
  }
}

const STATE_TEXT = { locked: 'Locked', open: 'Open', done: 'Done' } as const

function nodeLabel(node: MapNode, levelNumber: number | null): string {
  const parts = [
    node.kind === 'level' ? `Level ${levelNumber}: ${node.title}` : node.title,
    STATE_TEXT[node.state],
  ]
  if (node.stars)
    parts.push(
      `${Number(node.stars.normal) + Number(node.stars.special)} of 2 stars`,
    )
  return parts.join(', ')
}

function Medallion({
  node,
  levelNumber,
}: {
  node: MapNode
  levelNumber: number | null
}) {
  if (node.kind === 'reward' && node.reward)
    return (
      <RewardArt
        reward={node.reward}
        size={52}
        earned={node.state === 'done'}
      />
    )
  if (node.kind === 'preview')
    return (
      <Emblem
        name="swords"
        size={64}
        shape="circle"
        tone={node.state === 'locked' ? 'neutral' : 'info'}
      />
    )
  if (node.kind === 'boss')
    return (
      <Emblem
        name="crown"
        size={80}
        shape="circle"
        tone={
          node.state === 'done'
            ? 'green'
            : node.state === 'locked'
              ? 'neutral'
              : 'gold'
        }
      />
    )
  return (
    <span className={styles.number} aria-hidden="true">
      {levelNumber}
    </span>
  )
}

function ChapterPath({
  map,
  onOpen,
}: {
  map: ChapterMap
  onOpen: (node: MapNode) => void
}) {
  const horizontal = useMediaQuery('(min-width: 1100px)')
  const layout = layoutMap(map.nodes, horizontal)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = map.nodes.find(
    (node) => node.kind !== 'reward' && node.state === 'open',
  )
  const levelNumbers = new Map<string, number>()
  map.nodes
    .filter((node) => node.kind === 'level')
    .forEach((node, index) => levelNumbers.set(node.id, index + 1))

  function onKeyDown(event: KeyboardEvent, index: number) {
    const keys: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
      Home: -Infinity,
      End: Infinity,
    }
    const step = keys[event.key]
    if (step === undefined) return
    event.preventDefault()
    const last = layout.placed.length - 1
    const next = Math.min(last, Math.max(0, index + step))
    refs.current[next]?.focus()
  }

  const reached = (index: number) =>
    layout.placed[index].node.state !== 'locked'

  return (
    <div
      className={horizontal ? styles.pathWide : styles.pathTall}
      style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
    >
      <svg
        className={styles.trail}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        aria-hidden="true"
        focusable="false"
      >
        {layout.trail.map((segment) => (
          <path
            key={segment.d}
            d={segment.d}
            className={reached(segment.to) ? styles.trailOn : styles.trailOff}
          />
        ))}
        {layout.branches.map((branch) => (
          <path
            key={branch.d}
            d={branch.d}
            className={`${styles.branch} ${reached(branch.to) ? styles.trailOn : styles.trailOff}`}
          />
        ))}
      </svg>
      <ol className={styles.nodes} aria-label="Chapter path">
        {layout.placed.map((place, index) => {
          const node = place.node
          const levelNumber = levelNumbers.get(node.id) ?? null
          const isCurrent = node === current
          return (
            <li
              key={node.id}
              className={[
                styles.node,
                styles[node.kind],
                styles[node.state],
              ].join(' ')}
              style={{
                left: `${(place.x / layout.width) * 100}%`,
                top: `${(place.y / layout.height) * 100}%`,
              }}
            >
              {isCurrent && (
                <span className={styles.here} aria-hidden="true">
                  <Icon name="flag" size={14} />
                  Next
                </span>
              )}
              <button
                ref={(element) => {
                  refs.current[index] = element
                }}
                type="button"
                className={styles.nodeButton}
                aria-label={nodeLabel(node, levelNumber)}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onOpen(node)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                <span className={styles.medallion}>
                  <Medallion node={node} levelNumber={levelNumber} />
                  {node.state !== 'open' && (
                    <span className={styles.stateMark} aria-hidden="true">
                      <Icon
                        name={node.state === 'done' ? 'check' : 'lock'}
                        size={14}
                      />
                    </span>
                  )}
                </span>
                {node.stars && (
                  <Stars
                    normal={node.stars.normal}
                    special={node.stars.special}
                    size={16}
                  />
                )}
                <span className={styles.nodeTitle} aria-hidden="true">
                  {node.kind === 'preview'
                    ? 'Preview Battle'
                    : node.kind === 'boss'
                      ? 'Chapter Boss'
                      : node.kind === 'reward'
                        ? (node.reward?.name ?? node.title)
                        : node.title}
                </span>
                <span className={styles.nodeSub} aria-hidden="true">
                  {node.kind === 'preview'
                    ? 'Your starting point'
                    : node.kind === 'reward'
                      ? node.state === 'done'
                        ? 'Claimed'
                        : 'Reward'
                      : node.state === 'locked'
                        ? 'Locked'
                        : node.state === 'done'
                          ? 'Done'
                          : node.kind === 'boss'
                            ? node.title
                            : 'Play'}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function ChapterMapPage() {
  const { chapterId = '' } = useParams()
  const { status } = useAuth()
  const [search, setSearch] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(
    search.get('node'),
  )
  const resource = useResource(
    (signal) => loadMap(chapterId, signal),
    [chapterId, status],
  )
  const { playNow, busy } = usePlayNow(`/adventure/${chapterId}`)

  function close() {
    setSelectedId(null)
    if (search.has('node')) setSearch({}, { replace: true })
  }

  return (
    <ResourceView resource={resource} label="Unrolling the map…">
      {(map) => {
        if (!map)
          return (
            <EmptyState
              icon="map"
              title="Your map is waiting"
              action={
                <Button
                  icon="play"
                  disabled={busy}
                  onClick={() => void playNow()}
                >
                  Play now
                </Button>
              }
            >
              Start playing to open the chapter map and save your stars.
            </EmptyState>
          )
        const { chapter } = map
        const selected =
          map.nodes.find((node) => node.id === selectedId) ?? null
        return (
          <div>
            <PageHeader
              back={{ to: '/adventure', label: 'Adventure' }}
              eyebrow={`Chapter ${chapter.number} · ${chapter.region}`}
              title={chapter.title}
              actions={
                <ButtonLink to="/archive" variant="secondary" icon="book">
                  Archive
                </ButtonLink>
              }
            />
            <div className={styles.summary}>
              <Chip tone="gold" icon="star">
                <span className="num">
                  {chapter.stars} / {chapter.stars_total}
                </span>
              </Chip>
              <ProgressBar
                value={chapter.stars}
                max={chapter.stars_total}
                tone="gold"
                label="Chapter stars"
                valueText={`${chapter.stars} of ${chapter.stars_total} stars`}
                className={styles.summaryBar}
              />
              <StarLegend />
            </div>
            <ChapterPath map={map} onOpen={(node) => setSelectedId(node.id)} />
            <NodePopup map={map} node={selected} onClose={close} />
          </div>
        )
      }}
    </ResourceView>
  )
}
