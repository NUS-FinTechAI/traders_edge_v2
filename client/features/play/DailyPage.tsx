import { getDaily } from '../../services/dailyService.ts'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import useResource from '../../ui/useResource.ts'
import DailyCard from './DailyCard.tsx'
import styles from './Play.module.css'

export default function DailyPage() {
  const daily = useResource(getDaily)
  return (
    <div className={styles.page}>
      <PageHeader
        back={{ to: '/play', label: 'Play' }}
        title="Daily Challenge"
        subtitle="A new rival and market every day."
      />
      <ResourceView resource={daily} label="Loading the daily…">
        {(data) => (
          <DailyCard
            daily={data}
            onChange={daily.reload}
            onReload={daily.reload}
            full
          />
        )}
      </ResourceView>
    </div>
  )
}
