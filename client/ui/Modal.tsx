import { useEffect, useId, useRef, type ReactNode } from 'react'
import Button from './Button.tsx'
import styles from './ui.module.css'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  hideTitle?: boolean
}

/** Native modal dialog: focus is trapped and Escape closes it. */
export default function Modal({
  open,
  title,
  onClose,
  children,
  wide,
  hideTitle,
}: ModalProps) {
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
      className={[styles.modal, wide && styles.modalWide]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {open && (
        <>
          <h2
            id={titleId}
            className={hideTitle ? 'visually-hidden' : styles.modalTitle}
          >
            {title}
          </h2>
          <Button
            variant="ghost"
            icon="close"
            aria-label="Close"
            className={styles.modalClose}
            onClick={onClose}
          />
          {children}
        </>
      )}
    </dialog>
  )
}
