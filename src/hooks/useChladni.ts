import { useRef, useEffect, useState } from 'react'
import { computeChladniGrid, frequencyToMode } from '../lib/chladni'
import { applyDither } from '../lib/dither'

const GRID_SIZE = 256

export function useChladni(frequency: number | null) {
  const [imageData, setImageData] = useState<ImageData | null>(null)
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
      const grid = computeChladniGrid(n, m, GRID_SIZE)
      setImageData(applyDither(grid, GRID_SIZE))
    })
  }, [frequency])

  return { imageData, gridSize: GRID_SIZE }
}
