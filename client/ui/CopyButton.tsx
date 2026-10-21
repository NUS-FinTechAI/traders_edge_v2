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
        navigator.clipboard.writeText(text).then(
          () => notify('Copied', 'success'),
          () => notify('Copy failed. Select the code and copy it.', 'error'),
        )
      }}
    >
      {label}
    </Button>
  )
}
