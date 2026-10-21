import { useState } from 'react'
import { usePlayer } from '../../app/PlayerContext.ts'
import RequirePlayer from '../../app/RequirePlayer.tsx'
import {
  getShop,
  purchase,
  type Player,
  type ShopItem,
} from '../../services/playerService.ts'
import Avatar from '../../ui/Avatar.tsx'
import Button from '../../ui/Button.tsx'
import Chip, { CurrencyChip } from '../../ui/Chip.tsx'
import Emblem from '../../ui/Emblem.tsx'
import Icon from '../../ui/Icon.tsx'
import Modal from '../../ui/Modal.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ProgressBar from '../../ui/ProgressBar.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { EmptyState, SectionHeader } from '../../ui/States.tsx'
import { formatCount, formatShortDate } from '../../ui/format.ts'
import { useToast } from '../../ui/toastContext.ts'
import useResource, { errorText } from '../../ui/useResource.ts'
import styles from './Shop.module.css'

const KIND_LABEL = { avatar: 'Avatar', title: 'Title', theme: 'Candle theme' }

function ItemArt({ item, size }: { item: ShopItem; size: number }) {
  if (item.kind === 'avatar') return <Avatar id={item.id} size={size} />
  return (
    <Emblem
      name={item.kind === 'title' ? 'scroll' : 'candles'}
      tone={item.currency === 'gems' ? 'gem' : 'gold'}
      size={size}
      shape="circle"
    />
  )
}

function Price({ item }: { item: ShopItem }) {
  return (
    <CurrencyChip
      kind={item.currency === 'gems' ? 'gems' : 'doubloons'}
      amount={item.price}
    />
  )
}

export default function ShopPage() {
  return (
    <RequirePlayer label="Opening the shop…">
      {(player) => <Shop player={player} />}
    </RequirePlayer>
  )
}

function Shop({ player }: { player: Player }) {
  const { refreshPlayer } = usePlayer()
  const notify = useToast()
  const shop = useResource(getShop)
  const [confirm, setConfirm] = useState<ShopItem | null>(null)
  const [busy, setBusy] = useState(false)

  const balance = (item: ShopItem) =>
    item.currency === 'gems' ? player.wallet.gems : player.wallet.doubloons
  const currencyName = (item: ShopItem) =>
    item.currency === 'gems' ? 'Gems' : 'Doubloons'

  async function buy(item: ShopItem) {
    setBusy(true)
    try {
      await purchase(item.id)
      notify(`${item.name} is yours!`, 'success')
      setConfirm(null)
      await refreshPlayer()
      shop.reload()
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  function buyAction(item: ShopItem) {
    if (item.owned)
      return (
        <Chip tone="gain" icon="check">
          Owned
        </Chip>
      )
    const short = balance(item) < item.price
    return (
      <Button
        variant={item.currency === 'gems' ? 'secondary' : 'gold'}
        disabled={short}
        onClick={() => setConfirm(item)}
        aria-label={`Buy ${item.name}`}
      >
        {short ? `Need ${formatCount(item.price - balance(item))} more` : 'Buy'}
      </Button>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        back={{ to: '/profile', label: 'Profile' }}
        title="Shop"
        subtitle="Cosmetics only. Nothing here changes a match."
        actions={
          <div className={styles.wallet}>
            <CurrencyChip kind="doubloons" amount={player.wallet.doubloons} />
            <CurrencyChip kind="gems" amount={player.wallet.gems} />
          </div>
        }
      />
      <ResourceView resource={shop} label="Stocking the shelves…">
        {({ items }) => {
          const weekly = items.filter((item) => item.weekly)
          const gems = items.filter((item) => !item.weekly)
          return (
            <>
              {weekly.map((item) => (
                <section
                  key={item.id}
                  className={styles.weekly}
                  aria-labelledby={`weekly-${item.id}`}
                >
                  <ItemArt item={item} size={96} />
                  <div className={styles.weeklyBody}>
                    <p className={styles.eyebrow}>This week’s reward</p>
                    <h2 id={`weekly-${item.id}`} className={styles.weeklyTitle}>
                      {item.name}
                    </h2>
                    <p className={styles.muted}>{item.description}</p>
                    <div className={styles.track}>
                      <div className={styles.trackText}>
                        <span className="num">
                          {formatCount(Math.min(balance(item), item.price))} /{' '}
                          {formatCount(item.price)} {currencyName(item)}
                        </span>
                        <span className={styles.muted}>
                          Resets{' '}
                          {formatShortDate(
                            player.wallet.doubloons_week_ends_at,
                          )}
                        </span>
                      </div>
                      <ProgressBar
                        value={Math.min(balance(item), item.price)}
                        max={item.price}
                        tone="gold"
                        label={`${item.name} progress`}
                      />
                    </div>
                    <p className={styles.hint}>
                      Win daily challenges and claim login rewards to fill the
                      track.
                    </p>
                  </div>
                  <div className={styles.weeklyAction}>
                    <Price item={item} />
                    {buyAction(item)}
                  </div>
                </section>
              ))}
              <section aria-label="Gem shop">
                <SectionHeader title="Gem shop" eyebrow="Cosmetics" />
                {gems.length ? (
                  <ul className={styles.grid}>
                    {gems.map((item) => (
                      <li
                        key={item.id}
                        className={[styles.item, item.owned && styles.owned]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <ItemArt item={item} size={72} />
                        <p className={styles.kind}>{KIND_LABEL[item.kind]}</p>
                        <h3 className={styles.itemName}>{item.name}</h3>
                        <p className={styles.itemText}>{item.description}</p>
                        <div className={styles.itemFoot}>
                          {!item.owned && <Price item={item} />}
                          {buyAction(item)}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon="gem"
                    title="The shelves are empty this week"
                  />
                )}
              </section>
              <p className={styles.note}>
                <Icon name="gem" size={16} />
                Gems come from ranked matches. No real money.
              </p>
            </>
          )
        }}
      </ResourceView>
      <Modal
        open={!!confirm}
        title="Confirm purchase"
        onClose={() => setConfirm(null)}
      >
        {confirm && (
          <div className={styles.confirm}>
            <ItemArt item={confirm} size={88} />
            <p className={styles.confirmText}>
              Buy <strong>{confirm.name}</strong> for{' '}
              <span className="num">{formatCount(confirm.price)}</span>{' '}
              {currencyName(confirm)}?
            </p>
            <p className={styles.muted}>
              You’ll have{' '}
              <span className="num">
                {formatCount(balance(confirm) - confirm.price)}
              </span>{' '}
              {currencyName(confirm)} left.
            </p>
            <div className={styles.confirmActions}>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button disabled={busy} onClick={() => void buy(confirm)}>
                {busy ? 'Buying…' : 'Buy'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
