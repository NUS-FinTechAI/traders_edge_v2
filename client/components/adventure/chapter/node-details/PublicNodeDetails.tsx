import { Link } from 'react-router-dom'
import type { PublicAdventureChapter } from '../../../../services/adventureService.ts'
import { NodeDialog } from './NodeDetails.tsx'
import './PublicNodeDetails.css'

export default function PublicNodeDetails({
  chapter,
  selected,
  signIn,
  close,
}: {
  chapter: PublicAdventureChapter
  selected: string
  signIn: string
  close: () => void
}) {
  const level = chapter.levels.find((item) => item.id === selected)
  const title =
    level?.title ??
    {
      entry: 'Entry boss',
      exit: 'Chapter boss',
      diagnostic: 'Introductory assessment',
      assessment: 'Chapter learning check',
    }[selected]
  return (
    <NodeDialog close={close}>
      <div className="public-node-details">
        <p className="adventure-eyebrow">Preview</p>
        <h2 id="stop-title">{title}</h2>
        {level ? (
          <>
            <p>{level.objective}</p>
            <h3>Required missions</h3>
            <p>
              {level.required_steps} required{' '}
              {level.required_steps === 1 ? 'step' : 'steps'}. Complete the
              required missions to earn a normal star.
            </p>
            {level.bonus_steps > 0 && (
              <>
                <h3>Optional bonus</h3>
                <p>
                  {level.bonus_steps} bonus{' '}
                  {level.bonus_steps === 1 ? 'step' : 'steps'}. Complete the
                  bonus missions to earn a special star.
                </p>
              </>
            )}
          </>
        ) : selected === 'entry' || selected === 'exit' ? (
          <>
            {selected === 'entry' && (
              <p>
                New to trading? Learn the chapters in order before trying an
                early boss fight. Passing this entry boss unlocks this chapter.
              </p>
            )}
            {selected === 'exit' && (
              <p>
                Apply this chapter’s concepts after completing its required
                levels.
              </p>
            )}
            <p>
              Compete against AI. Results rank participants by net portfolio
              profit. Profit is a game outcome, not proof of learning.
            </p>
          </>
        ) : (
          <p>
            {selected === 'diagnostic'
              ? 'Check your starting knowledge before the chapter’s missions.'
              : 'Check your understanding after completing the required missions. This is separate from the boss result.'}
          </p>
        )}
        <p>
          Sign in to play lessons and bonus missions when their prerequisites
          are complete. Boss fights, chapter learning checks and the simulation
          interface are coming in later increments.
        </p>
        <Link className="adventure-button" to={signIn}>
          Sign in to play
        </Link>
      </div>
    </NodeDialog>
  )
}
