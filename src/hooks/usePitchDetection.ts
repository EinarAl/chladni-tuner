import { useRef, useState, useCallback } from 'react'
import { yinPitchDetection } from '../lib/yin'
import { frequencyToNote, type NoteResult } from '../lib/notes'

export interface PitchDetectionState {
  isListening: boolean
  frequency: number | null
  note: NoteResult
  micDenied: boolean
}

export function usePitchDetection() {
  const [state, setState] = useState<PitchDetectionState>({
    isListening: false,
    frequency: null,
    note: { name: '--', octave: 0, frequency: 0, cents: 0 },
    micDenied: false,
  })

  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)

  const analyze = useCallback(() => {
    if (!analyserRef.current || !ctxRef.current) return

    const buffer = new Float32Array(analyserRef.current.fftSize)
    analyserRef.current.getFloatTimeDomainData(buffer)

    let sumSq = 0
    for (let i = 0; i < buffer.length; i++) {
      sumSq += buffer[i] * buffer[i]
    }
    const rms = Math.sqrt(sumSq / buffer.length)

    if (rms < 0.008) {
      setState(prev => ({ ...prev, frequency: null }))
    } else {
      const freq = yinPitchDetection(buffer, ctxRef.current.sampleRate)
      if (freq && freq > 60 && freq < 1800) {
        const note = frequencyToNote(freq)
        setState(prev => ({ ...prev, frequency: freq, note }))
      } else {
        setState(prev => ({ ...prev, frequency: null }))
      }
    }

    rafRef.current = requestAnimationFrame(analyze)
  }, [])

  const start = useCallback(async () => {
    if (ctxRef.current) return

    const ctx = new AudioContext()
    ctxRef.current = ctx

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser

      source.connect(analyser)
      setState(prev => ({ ...prev, isListening: true, micDenied: false }))
      rafRef.current = requestAnimationFrame(analyze)
    } catch {
      setState(prev => ({ ...prev, isListening: false, micDenied: true }))
      ctx.close()
      ctxRef.current = null
    }
  }, [analyze])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    sourceRef.current?.disconnect()
    streamRef.current?.getTracks().forEach(t => t.stop())
    ctxRef.current?.close()
    sourceRef.current = null
    streamRef.current = null
    analyserRef.current = null
    ctxRef.current = null
    setState({
      isListening: false,
      frequency: null,
      note: { name: '--', octave: 0, frequency: 0, cents: 0 },
      micDenied: false,
    })
  }, [])

  return { ...state, start, stop }
}
