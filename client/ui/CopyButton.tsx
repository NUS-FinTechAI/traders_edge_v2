import Button from './Button.tsx'
import { useToast } from './toastContext.ts'

export default function CopyButton({
  text,
  label = 'Copy code',
}: {
  text: string
  label?: string
}) {
  const notify = useToast()
  return (
    <Button
      variant="secondary"
      icon="copy"
      onClick={() => {
        const fallback = () =>
          notify(`Copying isn’t available here. The code is ${text}.`, 'info')
        if (!navigator.clipboard?.writeText) {
          fallback()
          return
        }
        navigator.clipboard
          .writeText(text)
          .then(() => notify('Copied', 'success'), fallback)
      }}
    >
      {label}
    </Button>
  )
}
