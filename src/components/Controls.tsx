interface Props {
  onStepUp: () => void
  onStepDown: () => void
}

const btn =
  'px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 bg-neutral-800 text-neutral-400 hover:bg-neutral-700'

export default function Controls({ onStepUp, onStepDown }: Props) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button className={btn} onClick={onStepDown}>
        −
      </button>
      <button className={btn} onClick={onStepUp}>
        +
      </button>
    </div>
  )
}
