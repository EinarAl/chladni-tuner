import { useRef, useEffect } from 'react'
import { useChladni } from '../hooks/useChladni'
import { applyAnimatedDither } from '../lib/dither'

const TRANSITION_MS = 600

interface Props {
  frequency: number | null
}

export default function ChladniCanvas({ frequency }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { grid, prevGrid, transitionStart, gridSize } = useChladni(frequency)
  const rafRef = useRef(0)
  const t0Ref = useRef(performance.now())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !grid) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let running = true

    const frame = () => {
      if (!running) return
      const elapsed = (performance.now() - t0Ref.current) / 1000

      let blend: number | undefined
      let noiseBoost: number | undefined

      if (prevGrid && transitionStart !== null) {
        const dt = performance.now() - transitionStart
        if (dt < TRANSITION_MS) {
          blend = dt / TRANSITION_MS
          noiseBoost = (1 - blend) * 14
        }
      }

      const imageData = applyAnimatedDither(grid, gridSize, elapsed, prevGrid, blend, noiseBoost)
      ctx.putImageData(imageData, 0, 0)
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [grid, gridSize, prevGrid, transitionStart])

  return (
    <div className="flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={gridSize}
        height={gridSize}
        className="w-full max-w-[400px] aspect-square"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}
