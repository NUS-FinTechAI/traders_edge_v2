import { useEffect, useRef, useState } from 'react'
import { Link, useLoaderData } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.ts'
import authService, { type UserProfile } from '../../services/authService.ts'
import {
  loadPlayer,
  PlayerCommands,
  playerError,
  type PlayerAction,
  type PlayerData,
  type RewardItem,
} from '../../services/playerService.ts'
import './PlayerPage.css'

function date(value: string) {
  return (
    new Date(value).toLocaleString(undefined, {
      timeZone: 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short',
    }) + ' UTC'
  )
}

function PlayerAvatar({ item, name }: { item?: RewardItem; name: string }) {
  return (
    <div
      className="player-avatar"
      role="img"
      aria-label={item ? `${item.name} avatar` : `${name} profile initial`}
    >
      {item?.id === 'avatar-compass' ? (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="24" />
          <path d="m43 21-7 15-15 7 7-15Z" />
          <path d="M32 3v9m0 40v9M3 32h9m40 0h9" />
        </svg>
      ) : item ? (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="26" />
          <path d="M12 32c12-17 28-17 40 0-12 17-28 17-40 0Z" />
          <circle cx="32" cy="32" r="7" />
        </svg>
      ) : (
        <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  )
}

function PlayerRecord({ initial }: { initial: UserProfile }) {
  const { refreshUser } = useAuth()
  const [profile, setProfile] = useState(initial)
  const [data, setData] = useState<PlayerData | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [confirmation, setConfirmation] = useState<{
    action: PlayerAction
    label: string
    detail: string
  } | null>(null)
  const [setup] = useState(() => {
    try {
      const commands = new PlayerCommands(initial.id, localStorage)
      return { commands, pending: !!commands.pending(), error: null }
    } catch (failure) {
      return { commands: null, pending: false, error: playerError(failure) }
    }
  })
  const [pending, setPending] = useState(setup.pending)
  const mounted = useRef(false)
  const inFlight = useRef(false)
  const owner = useRef({
    id: initial.id,
    getOwnerId: () => authService.getUser()?.id ?? null,
  })
  const confirmationHeading = useRef<HTMLHeadingElement>(null)
  const pendingHeading = useRef<HTMLHeadingElement>(null)
  const errorNotice = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (pending) pendingHeading.current?.focus()
    else if (confirmation) confirmationHeading.current?.focus()
    else if (error || setup.error) errorNotice.current?.focus()
  }, [pending, confirmation, error, setup.error])
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    void loadPlayer(controller.signal, undefined, owner.current).then(
      (current) => {
        if (
          !controller.signal.aborted &&
          owner.current.getOwnerId() === initial.id
        )
          setData(current)
      },
      (failure) => {
        if (!controller.signal.aborted) setError(playerError(failure))
      },
    )
    return () => {
      mounted.current = false
      controller.abort()
    }
  }, [initial.id])

  async function reload() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const [current, user] = await Promise.all([
        loadPlayer(undefined, undefined, owner.current),
        refreshUser(),
      ])
      if (
        mounted.current &&
        user?.id === initial.id &&
        owner.current.getOwnerId() === initial.id
      ) {
        setData(current)
        setProfile(user)
      }
    } catch (failure) {
      if (mounted.current) setError(playerError(failure))
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  async function act(action?: PlayerAction) {
    if (inFlight.current || !setup.commands) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    setNotice('')
    let saved = false
    try {
      if (action) await setup.commands.submit(action)
      else await setup.commands.retry()
      saved = true
      if (!mounted.current || owner.current.getOwnerId() !== initial.id) return
      setPending(false)
      setConfirmation(null)
      setNotice('Your action is saved.')
      const [current, user] = await Promise.all([
        loadPlayer(undefined, undefined, owner.current),
        refreshUser(),
      ])
      if (
        !mounted.current ||
        user?.id !== initial.id ||
        owner.current.getOwnerId() !== initial.id
      )
        return
      setData(current)
      if (user?.id === initial.id) setProfile(user)
    } catch (failure) {
      if (mounted.current) {
        setError(
          saved
            ? 'Your action is saved. Reload the player record to refresh its current totals.'
            : playerError(failure),
        )
        try {
          setPending(!!setup.commands.pending())
        } catch {
          setPending(true)
        }
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const wallet = data?.wallet.status === 'ready' ? data.wallet.data : null
  const inventory =
    data?.inventory.status === 'ready' ? data.inventory.data : null
  const blocked = busy || pending || !setup.commands
  const equipment = inventory?.equipment
  const owned = inventory?.items.filter((item) => item.status === 'owned') ?? []
  const equipped = (id: string | null | undefined) =>
    owned.find((item) => item.id === id)?.name ?? 'None selected'
  const weekly =
    data?.shop.status === 'ready'
      ? data.shop.data.items.find((item) => item.currency === 'stocks')
      : null

  function buy(item: RewardItem) {
    if (
      !item.shop_id ||
      !item.currency ||
      item.price === null ||
      item.price === undefined
    )
      return
    setConfirmation({
      action: { kind: 'purchase', itemId: item.shop_id },
      label: `Purchase ${item.name}`,
      detail: `Spend ${item.price} ${item.currency === 'stocks' ? 'Stocks' : 'premium'} from your game wallet. The item remains in your inventory after purchase.`,
    })
  }

  return (
    <main className="player-page" aria-busy={busy}>
      <Link className="player-back" to="/">
        ← Home
      </Link>
      <header>
        <p className="player-kicker">Player record</p>
        <div className="player-identity">
          <PlayerAvatar
            item={owned.find((item) => item.id === equipment?.avatar_id)}
            name={profile.display_name}
          />
          <div>
            <h1>{profile.display_name}</h1>
            <p className="player-title">
              {equipment?.title_id
                ? equipped(equipment.title_id)
                : 'Your learning journey'}
            </p>
          </div>
        </div>
        <div className="player-level">
          <strong>Level {profile.player_level}</strong>
          <span>{profile.xp % 100} / 100 XP toward the next level</span>
          <progress
            aria-label="Progress toward next player level"
            max={100}
            value={profile.xp % 100}
          />
        </div>
        <dl className="player-totals">
          <div>
            <dt>Learning XP</dt>
            <dd>{profile.learning_xp}</dd>
          </div>
          <div>
            <dt>Game XP</dt>
            <dd>{profile.game_xp}</dd>
          </div>
          <div>
            <dt>Required levels</dt>
            <dd>{profile.completed_lesson_ids.length} completed</dd>
          </div>
          <div>
            <dt>Chapter checks</dt>
            <dd>{profile.mastered_module_ids.length} passed</dd>
          </div>
        </dl>
        <p>
          Player level combines learning and game XP. It records progress, not
          trading competence.
        </p>
      </header>
      <nav className="player-sections" aria-label="Player record sections">
        <a href="#wallet">Game wallet</a>
        <a href="#collection">Collection</a>
        <a href="#shop">Shop</a>
        <a href="#reviews">Reviews</a>
      </nav>
      <button disabled={busy} onClick={() => void reload()}>
        Reload player record
      </button>
      {notice && <p role="status">{notice}</p>}
      {(error || setup.error) && (
        <p
          ref={errorNotice}
          tabIndex={-1}
          className="player-error"
          role="alert"
        >
          {error ?? setup.error}
        </p>
      )}
      {pending && (
        <section className="player-notice">
          <h2 ref={pendingHeading} tabIndex={-1}>
            Confirm your saved action
          </h2>
          <p>
            An earlier request has not been confirmed. Keep its original choice
            while checking the saved result.
          </p>
          <button disabled={busy} onClick={() => void act()}>
            Confirm saved action
          </button>
        </section>
      )}
      {confirmation && (
        <section
          className="player-notice"
          aria-labelledby="player-confirm-title"
        >
          <h2 ref={confirmationHeading} tabIndex={-1} id="player-confirm-title">
            {confirmation.label}
          </h2>
          <p>{confirmation.detail}</p>
          <div className="player-actions">
            <button
              disabled={blocked}
              onClick={() => void act(confirmation.action)}
            >
              Confirm {confirmation.label.toLowerCase()}
            </button>
            <button disabled={busy} onClick={() => setConfirmation(null)}>
              Keep my currency
            </button>
          </div>
        </section>
      )}
      {!data && !error && (
        <p role="status">Loading your wallet, collection and reviews…</p>
      )}

      <section id="wallet" className="player-section">
        <h2>Game wallet</h2>
        {wallet ? (
          <>
            <dl className="player-totals">
              <div>
                <dt>Stocks</dt>
                <dd>{wallet.stocks_balance}</dd>
              </div>
              <div>
                <dt>Premium</dt>
                <dd>{wallet.premium_balance}</dd>
              </div>
              <div>
                <dt>Login streak</dt>
                <dd>
                  {wallet.login_streak_days}{' '}
                  {wallet.login_streak_days === 1 ? 'day' : 'days'}
                </dd>
              </div>
            </dl>
            <p>
              Stocks and premium are earned game currencies. Simulated trading
              funds stay inside each challenge. There are no real-money
              purchases.
            </p>
            <p>
              Stocks expire on {date(wallet.stocks_expires_at)}. Purchased items
              remain yours.
            </p>
            {weekly && weekly.price != null && (
              <>
                <label htmlFor="weekly-progress">
                  {weekly.name}:{' '}
                  {weekly.status === 'owned'
                    ? 'Weekly title collected'
                    : `${Math.min(wallet.stocks_balance, weekly.price)} / ${weekly.price} Stocks`}
                </label>
                <progress
                  id="weekly-progress"
                  max={weekly.price}
                  value={
                    weekly.status === 'owned'
                      ? weekly.price
                      : Math.min(wallet.stocks_balance, weekly.price)
                  }
                />
              </>
            )}
            <p>
              A login claim grants {wallet.rules.login_stocks} Stocks and{' '}
              {wallet.rules.login_xp} game XP once per UTC day. The first daily
              challenge victory grants {wallet.rules.daily_victory_stocks}{' '}
              Stocks that day.
            </p>
            <button
              disabled={
                blocked ||
                wallet.login_last_day === new Date().toISOString().slice(0, 10)
              }
              onClick={() => void act({ kind: 'login' })}
            >
              {wallet.login_last_day === new Date().toISOString().slice(0, 10)
                ? 'Today’s login reward claimed'
                : 'Claim today’s login reward'}
            </button>
            {wallet.daily_cooldown_until && (
              <div className="player-notice">
                <h3>Daily challenge retry</h3>
                <p>
                  A new attempt is available after{' '}
                  {date(wallet.daily_cooldown_until)}. You may wait without
                  spending anything.
                </p>
                <button
                  disabled={
                    blocked ||
                    wallet.premium_balance < wallet.rules.refresh_premium_cost
                  }
                  onClick={() =>
                    setConfirmation({
                      action: { kind: 'refresh' },
                      label: 'Refresh daily challenge',
                      detail: `Spend ${wallet.rules.refresh_premium_cost} premium to remove the current cooldown. This does not guarantee a win or grant a reward.`,
                    })
                  }
                >
                  Review refresh · {wallet.rules.refresh_premium_cost} premium
                </button>
                {wallet.premium_balance < wallet.rules.refresh_premium_cost && (
                  <p>
                    Premium is earned through public ranked matches. Your
                    balance is below the refresh cost.
                  </p>
                )}
              </div>
            )}
          </>
        ) : data?.wallet.status === 'error' ? (
          <p role="alert">
            Wallet unavailable. {playerError(data.wallet.error)}
          </p>
        ) : (
          <p>Loading wallet…</p>
        )}
      </section>

      <section id="collection" className="player-section">
        <h2>Your collection</h2>
        {inventory ? (
          <>
            <dl>
              <div>
                <dt>Equipped avatar</dt>
                <dd>{equipped(equipment?.avatar_id)}</dd>
              </div>
              <div>
                <dt>Equipped title</dt>
                <dd>{equipped(equipment?.title_id)}</dd>
              </div>
            </dl>
            <div className="player-actions">
              {equipment?.avatar_id && (
                <button
                  disabled={blocked}
                  onClick={() =>
                    void act({ kind: 'equip', slot: 'avatar_id', itemId: null })
                  }
                >
                  Unequip avatar
                </button>
              )}
              {equipment?.title_id && (
                <button
                  disabled={blocked}
                  onClick={() =>
                    void act({ kind: 'equip', slot: 'title_id', itemId: null })
                  }
                >
                  Unequip title
                </button>
              )}
            </div>
            <ul className="player-items">
              {inventory.items.map((item) => (
                <li key={item.id}>
                  <div>
                    <h3>{item.name}</h3>
                    <p className="player-item-state">
                      {item.kind} ·{' '}
                      {item.status === 'eligible'
                        ? 'Ready to claim'
                        : item.status === 'owned'
                          ? 'Owned'
                          : 'Locked'}
                    </p>
                    <p>{String(item.criteria.description ?? '')}</p>
                  </div>
                  {item.status === 'eligible' && (
                    <button
                      disabled={blocked}
                      onClick={() =>
                        void act({ kind: 'claim', itemId: item.id })
                      }
                    >
                      Claim {item.name}
                    </button>
                  )}
                  {item.status === 'owned' &&
                    (item.kind === 'avatar' || item.kind === 'title') && (
                      <button
                        disabled={
                          blocked ||
                          equipment?.[
                            item.kind === 'avatar' ? 'avatar_id' : 'title_id'
                          ] === item.id
                        }
                        onClick={() =>
                          void act({
                            kind: 'equip',
                            slot:
                              item.kind === 'avatar' ? 'avatar_id' : 'title_id',
                            itemId: item.id,
                          })
                        }
                      >
                        {equipment?.[
                          item.kind === 'avatar' ? 'avatar_id' : 'title_id'
                        ] === item.id
                          ? 'Equipped'
                          : `Equip ${item.kind}`}
                      </button>
                    )}
                </li>
              ))}
            </ul>
          </>
        ) : data?.inventory.status === 'error' ? (
          <p role="alert">
            Collection unavailable. {playerError(data.inventory.error)}
          </p>
        ) : (
          <p>Loading collection…</p>
        )}
      </section>

      <section id="shop" className="player-section">
        <h2>Collectible shop</h2>
        <p>
          Spend earned game currency on titles and avatars. Purchases do not
          grant XP or learning progress.
        </p>
        {data?.shop.status === 'ready' ? (
          <ul className="player-items">
            {data.shop.data.items.map((item) => (
              <li key={item.id}>
                <div>
                  <h3>{item.name}</h3>
                  <p>
                    {item.price}{' '}
                    {item.currency === 'stocks' ? 'Stocks' : 'premium'} ·{' '}
                    {item.kind}
                  </p>
                  {item.week && <p>Weekly edition · {item.week}</p>}
                </div>
                <button
                  disabled={
                    blocked ||
                    !wallet ||
                    item.status === 'owned' ||
                    (item.price != null &&
                      (item.currency === 'stocks'
                        ? wallet.stocks_balance
                        : wallet.premium_balance) < item.price)
                  }
                  onClick={() => buy(item)}
                >
                  {item.status === 'owned' ? 'Owned' : `Review ${item.name}`}
                </button>
              </li>
            ))}
          </ul>
        ) : data?.shop.status === 'error' ? (
          <p role="alert">Shop unavailable. {playerError(data.shop.error)}</p>
        ) : (
          <p>Loading shop…</p>
        )}
      </section>

      <section id="reviews" className="player-section">
        <h2>Learning reviews</h2>
        <p>
          Return to saved lesson questions when their review is due. Reviews do
          not affect your login streak.
        </p>
        {data?.reviews.status === 'ready' ? (
          data.reviews.data.reviews.length ? (
            <ul className="player-items">
              {data.reviews.data.reviews.map((review) => (
                <li key={review.id}>
                  <div>
                    <h3>{review.title}</h3>
                    <p>
                      {review.completed
                        ? 'Review passed'
                        : review.due
                          ? 'Ready to review'
                          : `Available ${date(review.due_at)}`}
                    </p>
                  </div>
                  {review.interactive_required &&
                    (review.active_run_id ||
                      (!review.completed && review.due)) && (
                      <Link
                        className="player-button"
                        to={
                          review.active_run_id
                            ? `/adventure/runs/${encodeURIComponent(review.active_run_id)}`
                            : `/adventure/start/review/${encodeURIComponent(review.id)}`
                        }
                      >
                        {review.active_run_id
                          ? 'Resume review'
                          : 'Start review'}
                      </Link>
                    )}
                  {review.completed && review.run_id && (
                    <Link
                      className="player-button"
                      to={`/adventure/runs/${encodeURIComponent(review.run_id)}`}
                    >
                      View review result
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>Complete a required lesson to schedule your first review.</p>
          )
        ) : data?.reviews.status === 'error' ? (
          <p role="alert">
            Reviews unavailable. {playerError(data.reviews.error)}
          </p>
        ) : (
          <p>Loading reviews…</p>
        )}
      </section>
      <Link className="player-button" to="/adventure">
        Return to your chapter map
      </Link>
    </main>
  )
}

export default function PlayerPage() {
  const user = useLoaderData<UserProfile>()
  const auth = useAuth()
  if (auth.status === 'loading')
    return (
      <main className="player-page">
        <p role="status">Checking the current player…</p>
      </main>
    )
  if (auth.user?.id !== user.id)
    return (
      <main className="player-page">
        <h1>Open your current player record</h1>
        <p>
          The signed-in player changed. Saved actions remain with their original
          profile.
        </p>
        <Link
          className="player-button"
          to={auth.user ? '/' : '/login?returnTo=%2Fplayer'}
        >
          {auth.user
            ? 'Return to current player’s home'
            : 'Sign in to continue'}
        </Link>
      </main>
    )
  return <PlayerRecord key={user.id} initial={user} />
}
