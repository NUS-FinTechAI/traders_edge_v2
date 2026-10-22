import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getResearchMetadata,
  joinStudy,
  leaveStudy,
  type ResearchMetadata,
} from '../../services/researchService.ts'
import Button, { ButtonLink } from '../../ui/Button.tsx'
import Chip from '../../ui/Chip.tsx'
import { useToast } from '../../ui/toastContext.ts'
import useResource, { errorText } from '../../ui/useResource.ts'
import { useResearchAccess } from './useResearch.ts'
import styles from './Research.module.css'

function Study({
  metadata,
  onChange,
}: {
  metadata: ResearchMetadata
  onChange: () => void
}) {
  const navigate = useNavigate()
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  const policy = metadata.study_policy
  const active = metadata.participation_active

  async function run(command: () => Promise<unknown>, joined: boolean) {
    setBusy(true)
    try {
      await command()
      onChange()
      if (joined) void navigate('/onboarding')
      else notify('You left the study.', 'info')
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={styles.studyHead}>
        <Chip
          tone={active ? 'gain' : 'neutral'}
          icon={active ? 'check' : 'info'}
        >
          {active ? 'Taking part' : 'Not taking part'}
        </Chip>
        <span className={styles.muted}>Policy version {policy.version}</span>
      </div>
      <div className={styles.policy} tabIndex={0} aria-label="Study policy">
        {policy.text}
      </div>
      <p className={styles.muted}>
        Joining is optional and separate from analytics.{' '}
        {metadata.withdrawal_effect}
      </p>
      {active ? (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void run(leaveStudy, false)}
        >
          Leave the study
        </Button>
      ) : (
        <Button
          disabled={busy}
          onClick={() => void run(() => joinStudy(policy), true)}
        >
          I have read this and agree to take part
        </Button>
      )}
    </>
  )
}

/** Study consent on the profile, shown only while an approved study is configured, plus the researcher link. */
export default function StudyPanel() {
  const metadata = useResource(getResearchMetadata)
  const researcher = useResearchAccess()
  const available = metadata.data?.study_policy.available
  if (!available && !researcher) return null
  return (
    <section className={styles.panel} aria-labelledby="study-title">
      <h2 id="study-title" className={styles.panelTitle}>
        Research study
      </h2>
      {metadata.data && available && (
        <Study metadata={metadata.data} onChange={metadata.reload} />
      )}
      {researcher && (
        <ButtonLink to="/research" variant="secondary" icon="chart">
          Researcher dashboard
        </ButtonLink>
      )}
    </section>
  )
}
