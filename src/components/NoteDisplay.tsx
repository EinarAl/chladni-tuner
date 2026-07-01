import type { NoteResult } from '../lib/notes'

interface Props {
  note: NoteResult
  frequency: number | null
}

export default function NoteDisplay({ note, frequency }: Props) {
  const isDetected = note.name !== '--'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-baseline gap-1">
        <span className={`text-5xl font-bold tabular-nums ${isDetected ? 'text-white' : 'text-neutral-600'}`}>
          {note.name}
        </span>
        <span className={`text-2xl font-semibold ${isDetected ? 'text-neutral-400' : 'text-neutral-600'}`}>
          {note.octave}
        </span>
      </div>
      <div className="flex gap-3 text-sm text-neutral-500 font-mono">
        {frequency && (
          <span>{frequency.toFixed(1)} Hz</span>
        )}
        {isDetected && (
          <span className={Math.abs(note.cents) < 5 ? 'text-tuned' : 'text-neutral-500'}>
            {note.cents > 0 ? '+' : ''}{note.cents}¢
          </span>
        )}
      </div>
    </div>
  )
}
