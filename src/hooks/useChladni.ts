import { useRef, useEffect, useState } from 'react'
import { computeChladniGrid, frequencyToMode } from '../lib/chladni'

const GRID_SIZE = 128

export function useChladni(frequency: number | null) {
  const [state, setState] = useState<{
    grid: Float32Array | null
    prevGrid: Float32Array | null
    transitionStart: number | null
  }>({ grid: null, prevGrid: null, transitionStart: null })
  const prevRef = useRef<number | null>(null)
  const frameRef = useRef(0)

  useEffect(() => {
    const freq = frequency ?? 82

    if (prevRef.current !== null && Math.abs(freq - prevRef.current) < 0.3) return
    prevRef.current = freq

    const id = ++frameRef.current

    queueMicrotask(() => {
      if (id !== frameRef.current) return

      const { n, m } = frequencyToMode(freq)
      const newGrid = computeChladniGrid(n, m, GRID_SIZE)

      setState(prev => ({
        grid: newGrid,
        prevGrid: prev.grid,
        transitionStart: performance.now(),
      }))
    })
  }, [frequency])

  return { ...state, gridSize: GRID_SIZE }
}
