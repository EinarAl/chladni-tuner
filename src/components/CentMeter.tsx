interface Props {
  cents: number
}

const SEGMENTS = 25
const SEG_WIDTH = 8
const CENTER = Math.floor(SEGMENTS / 2)

export default function CentMeter({ cents }: Props) {
  const clamped = Math.max(-50, Math.min(50, cents))
  const inTune = Math.abs(cents) < 5
  const activeIndex = Math.round(((clamped + 50) / 100) * (SEGMENTS - 1))
  const lo = Math.min(CENTER, activeIndex)
  const hi = Math.max(CENTER, activeIndex)

  return (
    <div className="w-full mx-auto">
      <div className="relative flex items-center justify-center gap-[2px] h-7">
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const isCenter = i === CENTER
          const isActive = i >= lo && i <= hi
          const fill = isCenter ? (isActive ? 'bg-white' : 'bg-neutral-500') : isActive ? 'bg-white' : 'bg-neutral-700'
          return (
            <div
              key={i}
              className={`rounded-sm transition-all duration-75 ${fill}`}
              style={{ width: SEG_WIDTH, height: isCenter ? 22 : Math.round(8 + (i % 3) * 3) }}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-neutral-500 mt-1 font-mono tracking-wider">
        <span>-50</span>
        <span className={inTune ? 'text-white font-medium' : ''}>0</span>
        <span>+50</span>
      </div>
    </div>
  )
}
