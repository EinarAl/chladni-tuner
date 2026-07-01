interface Props {
  cents: number
}

export default function CentMeter({ cents }: Props) {
  const clamped = Math.max(-50, Math.min(50, cents))
  const position = ((clamped + 50) / 100) * 100
  const inTune = Math.abs(cents) < 5

  return (
    <div className="w-full max-w-[400px] mx-auto px-4">
      <div className="relative h-8 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="absolute top-1 bottom-1 w-2 rounded-full bg-needle transition-all duration-75"
          style={{ left: `calc(${position}% - 4px)` }}
        />
        <div className={`absolute top-0.5 bottom-0.5 left-1/2 w-8 -translate-x-1/2 rounded border transition-colors duration-150 ${
          inTune ? 'bg-tuned/20 border-tuned' : 'bg-transparent border-neutral-600'
        }`} />
      </div>
      <div className="flex justify-between text-xs text-neutral-600 mt-1 px-1">
        <span>-50</span>
        <span className={inTune ? 'text-tuned font-medium' : ''}>0</span>
        <span>+50</span>
      </div>
    </div>
  )
}
