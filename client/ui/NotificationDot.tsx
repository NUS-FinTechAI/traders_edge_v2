import { useEffect, useRef } from 'react'
import styles from './NotificationDot.module.css'

/** Static unread indicator, with a text equivalent for assistive technology. */
export default function NotificationDot({
  label = 'New content',
  onVisible,
}: {
  label?: string
  onVisible?: () => void
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!onVisible || !ref.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some(
            (entry) => entry.isIntersecting && entry.intersectionRatio === 1,
          )
        ) {
          onVisible()
          observer.disconnect()
        }
      },
      { threshold: 1 },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [onVisible])
  return <span ref={ref} className={styles.dot} role="img" aria-label={label} />
}
