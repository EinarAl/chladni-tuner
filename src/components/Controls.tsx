type Mode = 'tuner' | 'sound'

interface Props {
  mode: Mode
  onModeChange: (mode: Mode) => void
  onStepUp: () => void
  onStepDown: () => void
}

const btn =
  'px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed'

export default function Controls({ mode, onModeChange, onStepUp, onStepDown }: Props) {
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      <button
        className={`${btn} ${mode === 'tuner' ? 'bg-accent text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
        onClick={() => onModeChange('tuner')}
      >
        TUNER
      </button>
      <button
        className={`${btn} ${mode === 'sound' ? 'bg-accent text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
        onClick={() => onModeChange('sound')}
      >
        SOUND
      </button>
      <button
        className={`${btn} bg-neutral-800 text-neutral-400 hover:bg-neutral-700`}
        onClick={onStepDown}
        disabled={mode !== 'sound'}
      >
        −
      </button>
      <button
        className={`${btn} bg-neutral-800 text-neutral-400 hover:bg-neutral-700`}
        onClick={onStepUp}
        disabled={mode !== 'sound'}
      >
        +
      </button>
    </div>
  )
}
