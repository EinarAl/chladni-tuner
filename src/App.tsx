import { useEffect, useState } from 'react'
import { usePitchDetection } from './hooks/usePitchDetection'
import { useOscillator } from './hooks/useOscillator'
import TunerDevice from './components/TunerDevice'
import ChladniCanvas from './components/ChladniCanvas'
import NoteDisplay from './components/NoteDisplay'
import CentMeter from './components/CentMeter'
import Controls from './components/Controls'

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

  const displayNote = mode === 'tuner'
    ? pitch.note
    : osc.isPlaying
      ? osc.note
      : { name: '--' as const, octave: 0, frequency: 0, cents: 0 }

  return (
    <TunerDevice
      chladni={<ChladniCanvas frequency={chladniFreq} />}
      noteDisplay={
        <NoteDisplay
          note={displayNote}
          frequency={mode === 'tuner' ? pitch.frequency : osc.frequency}
        />
      }
      centMeter={<CentMeter cents={displayNote.cents} />}
      controls={
        <Controls
          mode={mode}
          onModeChange={handleModeChange}
          onStepUp={osc.stepUp}
          onStepDown={osc.stepDown}
        />
      }
    />
  )
}
