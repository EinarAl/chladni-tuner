import { useRef, useEffect } from 'react'
import { useChladni } from '../hooks/useChladni'

interface Props {
  frequency: number | null
}

export default function ChladniCanvas({ frequency }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { imageData, gridSize } = useChladni(frequency)

  useEffect(() => {
    if (!imageData || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    ctx.putImageData(imageData, 0, 0)
  }, [imageData])

  return (
    <canvas
      ref={canvasRef}
      width={gridSize}
      height={gridSize}
      className="w-full max-w-[400px] aspect-square"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
