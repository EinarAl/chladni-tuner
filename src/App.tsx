import { useEffect, useState } from 'react'
import { useMotionValue, useSpring } from 'motion/react'
import { usePitchDetection } from './hooks/usePitchDetection'
import { useOscillator } from './hooks/useOscillator'
import ThreeDevice from './components/ThreeDevice'

type Mode = 'tuner' | 'sound'

export default function App() {
  const [mode, setMode] = useState<Mode>('tuner')
  const pitch = usePitchDetection()
  const osc = useOscillator()

  useEffect(() => {
    pitch.start()
    return () => pitch.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleModeChange = (newMode: Mode) => {
    if (newMode === mode) return
    setMode(newMode)
    if (newMode === 'tuner') {
      osc.stop()
      pitch.start()
    } else {
      pitch.stop()
      osc.start(440)
    }
  }

  const chladniFreq = mode === 'tuner' ? pitch.frequency : osc.frequency

  const rollX = useMotionValue(0)
  const rollY = useMotionValue(0)
  const smoothRollX = useSpring(rollX, { stiffness: 150, damping: 20 })
  const smoothRollY = useSpring(rollY, { stiffness: 150, damping: 20 })

  return (
    <div className="h-dvh w-full bg-[#0b1a2e]">
      <ThreeDevice
        rollX={smoothRollX}
        rollY={smoothRollY}
        frequency={chladniFreq}
        mode={mode}
        onModeChange={handleModeChange}
        onStepUp={osc.stepUp}
        onStepDown={osc.stepDown}
        onOctaveUp={osc.octaveUp}
        onOctaveDown={osc.octaveDown}
      />
    </div>
  )
}
