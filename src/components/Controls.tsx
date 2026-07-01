type Mode = 'tuner' | 'sound'

interface Props {
  mode: Mode
  onModeChange: (mode: Mode) => void
  onStepUp: () => void
  onStepDown: () => void
  onOctaveUp: () => void
  onOctaveDown: () => void
}

const btn =
  'px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed'
const smallBtn =
  'px-2 py-1 rounded text-xs font-medium transition-colors duration-150 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed'

export default function Controls({ mode, onModeChange, onStepUp, onStepDown, onOctaveUp, onOctaveDown }: Props) {
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

      <span className="text-neutral-600">|</span>

      <button
        className={smallBtn}
        onClick={onOctaveDown}
        disabled={mode !== 'sound'}
      >
        ▼
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
      <button
        className={smallBtn}
        onClick={onOctaveUp}
        disabled={mode !== 'sound'}
      >
        ▲
      </button>
    </div>
  )
}
