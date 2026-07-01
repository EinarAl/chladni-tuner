import { useEffect } from 'react'
import { useOscillator } from './hooks/useOscillator'
import ChladniCanvas from './components/ChladniCanvas'
import Controls from './components/Controls'

export default function App() {
  const osc = useOscillator()

  useEffect(() => {
    osc.start(440)
    return () => osc.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 bg-black p-4">
      <ChladniCanvas frequency={osc.frequency} />
      <Controls onStepUp={osc.stepUp} onStepDown={osc.stepDown} />
    </div>
  )
}
