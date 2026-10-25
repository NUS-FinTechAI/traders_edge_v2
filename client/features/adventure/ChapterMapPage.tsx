import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.ts'
import { usePlayer } from '../../app/PlayerContext.ts'
import { unreadUnlocks } from '../../app/unlockNotifications.ts'
import { useToast } from '../../ui/toastContext.ts'
import NotificationDot from '../../ui/NotificationDot.tsx'
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
import useResource, { errorText } from '../../ui/useResource.ts'
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

/** The caption under a node; its accessible name starts with the same words. */
function nodeTitle(node: MapNode): string {
  if (node.kind === 'preview') return 'Preview Battle'
  if (node.kind === 'boss') return 'Chapter Boss'
  if (node.kind === 'reward') return node.reward?.name ?? node.title
  return node.title
}

function nodeLabel(node: MapNode, levelNumber: number | null): string {
  const parts = [nodeTitle(node)]
  if (node.kind === 'boss') parts[0] = `Chapter Boss: ${node.title}`
  // Server titles usually already read "Level 2: …"; only add the number when missing.
  if (node.kind === 'level' && levelNumber && !/^level\s+\d/i.test(node.title))
    parts.push(`level ${levelNumber}`)
  if (node.kind === 'reward') parts.push('reward')
  parts.push(STATE_TEXT[node.state].toLowerCase())
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
        name={node.state === 'done' ? 'chest-open' : 'chest'}
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

  function getDisplayedStatus(node: MapNode) {
    const kind = node.kind
    const status = node.state
    if (kind === 'preview' && status !== 'done') {
      return 'Your Starting Point'
    }

    if (kind === 'reward') {
      return status === 'done' ? 'Claimed' : 'Reward'
    }

    if (status === 'open') {
      return kind === 'boss' ? node.title : 'Play'
    }

    // Do not display anything for locked or completed nodes
    return ''
  }

  const reached = (index: number) =>
    layout.placed[index].node.state !== 'locked'
  const boss = layout.placed.find((place) => place.node.kind === 'boss')

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
        {boss && (
          <g className={styles.xMark}>
            <path
              d={`M${boss.x - 44} ${boss.y - 44}L${boss.x + 44} ${boss.y + 44}M${boss.x + 44} ${boss.y - 44}L${boss.x - 44} ${boss.y + 44}`}
            />
          </g>
        )}
      </svg>
      <span className={styles.compass} aria-hidden="true">
        <Emblem name="compass" size={56} tone="gold" shape="circle" />
      </span>
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
                <span className={styles.caption} aria-hidden="true">
                  {node.stars && (
                    <Stars
                      normal={node.stars.normal}
                      special={node.stars.special}
                      size={16}
                    />
                  )}
                  <span className={styles.nodeTitle}>{nodeTitle(node)}</span>
                  <span className={styles.nodeSub}>
                    {getDisplayedStatus(node)}
                  </span>
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
  const { player, markUnlocksSeen } = usePlayer()
  const newKeywords = unreadUnlocks(player, 'archive', 'keywords').length > 0
  const notify = useToast()
  const attempted = useRef(new Set<string>())
  const [search, setSearch] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(
    search.get('node'),
  )
  const resource = useResource(
    (signal) => loadMap(chapterId, signal),
    [chapterId, status],
  )
  const { playNow, busy } = usePlayNow(`/adventure/${chapterId}`)
  const unread = unreadUnlocks(player, 'campaign', 'chapters').some(
    (item) => item.item_id === chapterId,
  )
  const loadedChapter =
    resource.status === 'ready' ? resource.data?.chapter : undefined
  useEffect(() => {
    if (
      !player ||
      !unread ||
      !loadedChapter ||
      loadedChapter.state === 'locked'
    )
      return
    const requestKey = JSON.stringify([player.id, loadedChapter.id])
    if (attempted.current.has(requestKey)) return
    attempted.current.add(requestKey)
    void markUnlocksSeen([
      { category: 'campaign', item_id: loadedChapter.id },
    ]).catch((error: unknown) => notify(errorText(error), 'error'))
  }, [player, unread, loadedChapter, markUnlocksSeen, notify])

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
                <ButtonLink
                  to="/archive"
                  variant="secondary"
                  icon="book"
                  className={styles.archiveLink}
                >
                  Archive
                  {newKeywords && (
                    <NotificationDot label="New archive keywords" />
                  )}
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
