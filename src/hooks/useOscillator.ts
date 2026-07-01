import { useRef, useState, useCallback } from 'react'
import { halfStepUp, halfStepDown, frequencyToNote, type NoteResult } from '../lib/notes'

export function useOscillator() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [frequency, setFrequency] = useState(440)
  const [note, setNote] = useState<NoteResult>({ name: 'A', octave: 4, frequency: 440, cents: 0 })
  const ctxRef = useRef<AudioContext | null>(null)
  const oscRef = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)

  const start = useCallback((freq: number) => {
    const ctx = new AudioContext()
    ctxRef.current = ctx

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    oscRef.current = osc

    const gain = ctx.createGain()
    gain.gain.value = 0.25
    gainRef.current = gain

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()

    setFrequency(freq)
    setNote(frequencyToNote(freq))
    setIsPlaying(true)
  }, [])

  const stop = useCallback(() => {
    try { oscRef.current?.stop() } catch {}
    oscRef.current?.disconnect()
    gainRef.current?.disconnect()
    ctxRef.current?.close()
    oscRef.current = null
    gainRef.current = null
    ctxRef.current = null
    setIsPlaying(false)
  }, [])

  const setFreq = useCallback((freq: number) => {
    if (oscRef.current && ctxRef.current) {
      const now = ctxRef.current.currentTime
      oscRef.current.frequency.setTargetAtTime(freq, now, 0.02)
    }
    setFrequency(freq)
    setNote(frequencyToNote(freq))
  }, [])

  const stepUp = useCallback(() => {
    setFreq(halfStepUp(frequency))
  }, [frequency, setFreq])

  const stepDown = useCallback(() => {
    setFreq(halfStepDown(frequency))
  }, [frequency, setFreq])

  return { isPlaying, frequency, note, start, stop, setFrequency: setFreq, stepUp, stepDown }
}
