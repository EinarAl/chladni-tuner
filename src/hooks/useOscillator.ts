import { useRef, useState, useCallback } from 'react'
import { halfStepUp, halfStepDown, frequencyToNote } from '../lib/notes'

const MIN_FREQ = 20
const MAX_FREQ = 2093

export function useOscillator() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [baseFrequency, setBaseFrequency] = useState(440)
  const [centsOffset, setCentsOffset] = useState(0)
  const [displayCents, setDisplayCents] = useState<number | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const oscRef = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const animRef = useRef<number | null>(null)
  const baseRef = useRef(440)
  const centAccelRef = useRef({ lastTime: 0, steps: 0 })

  const actualFrequency = baseFrequency * 2 ** (centsOffset / 1200)
  const visualCents = displayCents ?? centsOffset

  const setOscFreq = useCallback((freq: number) => {
    if (oscRef.current && ctxRef.current) {
      const now = ctxRef.current.currentTime
      oscRef.current.frequency.setTargetAtTime(freq, now, 0.02)
    }
  }, [])

  const start = useCallback((freq: number) => {
    const ctx = new AudioContext()
    ctxRef.current = ctx
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = Math.max(MIN_FREQ, Math.min(MAX_FREQ, freq))
    oscRef.current = osc
    const gain = ctx.createGain()
    gain.gain.value = 0.25
    gainRef.current = gain
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()

    const n = frequencyToNote(osc.frequency.value)
    const base = n.frequency
    const cents = n.cents
    setBaseFrequency(base)
    baseRef.current = base
    setCentsOffset(cents)
    setDisplayCents(null)
    setIsPlaying(true)
  }, [])

  const stop = useCallback(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current)
    try { oscRef.current?.stop() } catch {}
    oscRef.current?.disconnect()
    gainRef.current?.disconnect()
    ctxRef.current?.close()
    oscRef.current = null
    gainRef.current = null
    ctxRef.current = null
    setIsPlaying(false)
  }, [])

  const updateOscFromBase = useCallback((base: number, cents: number) => {
    const clamped = Math.max(MIN_FREQ, Math.min(MAX_FREQ, base * 2 ** (cents / 1200)))
    setOscFreq(clamped)
  }, [setOscFreq])

  const setCentsFromDrag = useCallback((cents: number) => {
    let newCents = cents
    let base = baseRef.current

    if (newCents > 50) {
      const steps = Math.floor((newCents + 50) / 100)
      for (let i = 0; i < steps; i++) {
        const next = halfStepUp(base)
        if (next > MAX_FREQ) break
        base = next
        newCents -= 100
      }
    } else if (newCents < -50) {
      const steps = Math.floor((-newCents + 50) / 100)
      for (let i = 0; i < steps; i++) {
        const prev = halfStepDown(base)
        if (prev < MIN_FREQ) break
        base = prev
        newCents += 100
      }
    }

    if (base !== baseRef.current) {
      baseRef.current = base
      setBaseFrequency(base)
    }
    setCentsOffset(newCents)
    setDisplayCents(newCents)
    updateOscFromBase(base, newCents)
  }, [updateOscFromBase])

  const animateToCenter = useCallback((onDone: () => void) => {
    const start = centsOffset
    const duration = 200
    const t0 = performance.now()

    const tick = (now: number) => {
      const t = Math.min((now - t0) / duration, 1)
      const eased = 1 - (1 - t) ** 3
      const cur = start * (1 - eased)
      setDisplayCents(cur)
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick)
      } else {
        setDisplayCents(null)
        setCentsOffset(0)
        onDone()
      }
    }
    animRef.current = requestAnimationFrame(tick)
  }, [centsOffset])

  const doStepUp = useCallback(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current)
    const base = baseRef.current
    if (centsOffset === 0) {
      const next = halfStepUp(base)
      if (next <= MAX_FREQ) {
        baseRef.current = next
        setBaseFrequency(next)
        setOscFreq(next)
      }
      return
    }
    animateToCenter(() => {
      const next = halfStepUp(baseRef.current)
      if (next <= MAX_FREQ) {
        baseRef.current = next
        setBaseFrequency(next)
        setOscFreq(next)
      }
    })
  }, [centsOffset, animateToCenter, setOscFreq])

  const doStepDown = useCallback(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current)
    const base = baseRef.current
    if (centsOffset === 0) {
      const prev = halfStepDown(base)
      if (prev >= MIN_FREQ) {
        baseRef.current = prev
        setBaseFrequency(prev)
        setOscFreq(prev)
      }
      return
    }
    animateToCenter(() => {
      const prev = halfStepDown(baseRef.current)
      if (prev >= MIN_FREQ) {
        baseRef.current = prev
        setBaseFrequency(prev)
        setOscFreq(prev)
      }
    })
  }, [centsOffset, animateToCenter, setOscFreq])

  const doOctaveUp = useCallback(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current)
    const base = baseRef.current
    if (centsOffset === 0) {
      const next = base * 2
      if (next <= MAX_FREQ) {
        baseRef.current = next
        setBaseFrequency(next)
        setOscFreq(next)
      }
      return
    }
    animateToCenter(() => {
      const next = baseRef.current * 2
      if (next <= MAX_FREQ) {
        baseRef.current = next
        setBaseFrequency(next)
        setOscFreq(next)
      }
    })
  }, [centsOffset, animateToCenter, setOscFreq])

  const doOctaveDown = useCallback(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current)
    const base = baseRef.current
    if (centsOffset === 0) {
      const prev = base / 2
      if (prev >= MIN_FREQ) {
        baseRef.current = prev
        setBaseFrequency(prev)
        setOscFreq(prev)
      }
      return
    }
    animateToCenter(() => {
      const prev = baseRef.current / 2
      if (prev >= MIN_FREQ) {
        baseRef.current = prev
        setBaseFrequency(prev)
        setOscFreq(prev)
      }
    })
  }, [centsOffset, animateToCenter, setOscFreq])

  const getCentStep = useCallback(() => {
    const now = performance.now()
    const accel = centAccelRef.current
    const elapsed = now - accel.lastTime
    if (elapsed > 500) {
      accel.steps = 0
    }
    accel.lastTime = now
    const mult = accel.steps >= 4 ? 4 : accel.steps >= 2 ? 2 : 1
    accel.steps++
    return mult
  }, [])

  const centUp = useCallback(() => {
    const step = getCentStep()
    setCentsFromDrag(centsOffset + step)
  }, [centsOffset, setCentsFromDrag, getCentStep])

  const centDown = useCallback(() => {
    const step = getCentStep()
    setCentsFromDrag(centsOffset - step)
  }, [centsOffset, setCentsFromDrag, getCentStep])

  return {
    isPlaying,
    frequency: actualFrequency,
    centsOffset: visualCents,
    start, stop,
    setCentsFromDrag,
    centUp, centDown,
    stepUp: doStepUp,
    stepDown: doStepDown,
    octaveUp: doOctaveUp,
    octaveDown: doOctaveDown,
  }
}
