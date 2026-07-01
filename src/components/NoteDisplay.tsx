import type { NoteResult } from '../lib/notes'

interface Props {
  note: NoteResult
  frequency: number | null
}

export default function NoteDisplay({ note, frequency }: Props) {
  const isDetected = note.name !== '--'

  return (
    <div className="flex flex-col items-center gap-1 min-h-[88px] justify-center">
      <div className="flex items-baseline gap-2">
        <span className={`text-5xl font-bold tabular-nums tracking-wider ${isDetected ? 'text-white' : 'text-neutral-600'}`}>
          {note.name}
        </span>
        <span className={`text-2xl font-semibold ${isDetected ? 'text-neutral-400' : 'text-neutral-600'}`}>
          {note.octave}
        </span>
      </div>
      <div className="flex gap-3 text-xs text-neutral-400 font-mono tracking-widest uppercase min-h-[18px]">
        <span>
          {frequency ? `${frequency.toFixed(1)} hz` : '-- hz'}
        </span>
        <span className={isDetected && Math.abs(note.cents) < 5 ? 'text-tuned' : 'text-neutral-400'}>
          {isDetected ? `${note.cents > 0 ? '+' : ''}${note.cents}` : '--'} ct
        </span>
      </div>
    </div>
  )
}
