import { useEffect, useState, useCallback } from 'react'
import { useMotionValue, useSpring } from 'motion/react'
import { usePitchDetection } from './hooks/usePitchDetection'
import { useOscillator } from './hooks/useOscillator'
import ThreeDevice from './components/ThreeDevice'

type Mode = 'tuner' | 'sound'
type Simulation = 'cos' | 'ritz-free' | 'ritz-clamped'

const SIM_OPTIONS: Simulation[] = ['cos', 'ritz-free', 'ritz-clamped']

export default function App() {
  const [mode, setMode] = useState<Mode>('tuner')
  const pitch = usePitchDetection()
  const osc = useOscillator()

  const [settingsMode, setSettingsMode] = useState(false)
  const [settingsSelection, setSettingsSelection] = useState(0)
  const [simDropdownOpen, setSimDropdownOpen] = useState(false)
  const [simDropdownSelection, setSimDropdownSelection] = useState(0)
  const [invert, setInvert] = useState(true)
  const [simulation, setSimulation] = useState<Simulation>('ritz-free')

  useEffect(() => {
    pitch.start()
    return () => pitch.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleModeChange = (newMode: Mode) => {
    setSettingsMode(false)
    setSettingsSelection(0)
    setSimDropdownOpen(false)
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

  const handleSettingsToggle = useCallback(() => {
    if (settingsMode) {
      setSettingsMode(false)
      setSettingsSelection(0)
      setSimDropdownOpen(false)
    } else {
      setSettingsMode(true)
      setSettingsSelection(0)
      setSimDropdownOpen(false)
    }
  }, [settingsMode])

  const handleSettingsSelect = useCallback(() => {
    if (simDropdownOpen) {
      const ddOptions = SIM_OPTIONS.filter(s => s !== simulation)
      setSimulation(ddOptions[simDropdownSelection])
      setSimDropdownOpen(false)
      return
    }
    if (settingsSelection === 0) {
      setSettingsMode(false)
      setSettingsSelection(0)
    } else if (settingsSelection === 1) {
      setInvert(v => !v)
    } else if (settingsSelection === 2) {
      setSimDropdownOpen(true)
      setSimDropdownSelection(0)
    }
  }, [settingsSelection, simDropdownOpen, simDropdownSelection, simulation])

  const handleSettingsUp = useCallback(() => {
    if (simDropdownOpen) {
      if (simDropdownSelection > 0) {
        setSimDropdownSelection(s => s - 1)
      } else {
        setSimDropdownOpen(false)
      }
    } else {
      setSettingsSelection(s => Math.max(0, s - 1))
    }
  }, [simDropdownOpen, simDropdownSelection])

  const handleSettingsDown = useCallback(() => {
    if (simDropdownOpen) {
      const ddOptions = SIM_OPTIONS.filter(s => s !== simulation)
      setSimDropdownSelection(s => Math.min(ddOptions.length - 1, s + 1))
    } else {
      setSettingsSelection(s => Math.min(2, s + 1))
    }
  }, [simDropdownOpen, simulation])

  const chladniFreq = mode === 'tuner' ? pitch.frequency : osc.frequency

  const rollX = useMotionValue(-8)
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
        onCentUp={mode === 'sound' ? osc.centUp : undefined}
        onCentDown={mode === 'sound' ? osc.centDown : undefined}
        onOctaveUp={osc.octaveUp}
        onOctaveDown={osc.octaveDown}
        centsOffset={mode === 'sound' ? osc.centsOffset : undefined}
        settingsMode={settingsMode}
        settingsSelection={settingsSelection}
        simDropdownOpen={simDropdownOpen}
        simDropdownSelection={simDropdownSelection}
        invert={invert}
        simulation={simulation}
        onSettingsToggle={handleSettingsToggle}
        onSettingsSelect={handleSettingsSelect}
        onSettingsUp={handleSettingsUp}
        onSettingsDown={handleSettingsDown}

      />
    </div>
  )
}
