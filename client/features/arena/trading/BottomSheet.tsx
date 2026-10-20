import { useEffect, useId, useRef, type ReactNode } from 'react'
import Button from '../../../ui/Button.tsx'
import styles from './Trading.module.css'

interface BottomSheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** Modal sheet anchored to the bottom edge; the native dialog traps focus. */
export default function BottomSheet({
  open,
  title,
  onClose,
  children,
}: BottomSheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {open && (
        <div className={styles.sheetBody}>
          <div className={styles.sheetHead}>
            <span className={styles.sheetGrip} aria-hidden="true" />
            <h2 id={titleId} className="visually-hidden">
              {title}
            </h2>
            <Button
              variant="ghost"
              icon="close"
              aria-label="Close"
              className={styles.sheetClose}
              onClick={onClose}
            />
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
