import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useRef, type ReactNode } from 'react'

interface Props {
  chladni: ReactNode
  noteDisplay: ReactNode
  centMeter: ReactNode
  controls: ReactNode
}

export default function TunerDevice({ chladni, noteDisplay, centMeter, controls }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springConfig = { stiffness: 150, damping: 20 }
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), springConfig)
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6, 6]), springConfig)

  function handleMouseMove(e: React.MouseEvent) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    mouseX.set(x)
    mouseY.set(y)
  }

  function handleMouseLeave() {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <div className="min-h-dvh bg-neutral-950 flex items-center justify-center p-4" style={{ perspective: 800 }}>
      <motion.div
        ref={ref}
        className="relative w-full max-w-sm"
        style={{
          transformStyle: 'preserve-3d',
          rotateX,
          rotateY,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="absolute inset-0 rounded-3xl"
          style={{
            transform: 'translateZ(-24px)',
            background: '#0d0d1e',
            border: '1px solid rgba(255,255,255,0.03)',
          }}
        />

        <div
          className="bg-device rounded-3xl shadow-2xl shadow-black/60 border border-white/5 relative"
          style={{
            transform: 'translateZ(2px)',
            transformStyle: 'preserve-3d',
            boxShadow:
              '0 -1px 0 rgba(255,255,255,0.08) inset, 0 2px 0 rgba(0,0,0,0.4) inset, 0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div className="p-4 pb-2">
            <div
              className="relative bg-screen rounded-2xl border border-white/5 overflow-hidden"
              style={{
                transform: 'translateZ(-2px)',
                boxShadow:
                  '0 4px 12px rgba(0,0,0,0.6) inset, 0 -1px 0 rgba(255,255,255,0.05) inset, 0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              <div className="p-4 pb-0">
                {chladni}
              </div>
              <div className="px-4 py-3 space-y-2">
                {noteDisplay}
                {centMeter}
              </div>
            </div>
          </div>

          <div
            className="mx-4 h-1 rounded-full"
            style={{
              transform: 'translateZ(3px)',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(0,0,0,0.15))',
              boxShadow: '0 -1px 0 rgba(255,255,255,0.08), 0 1px 0 rgba(0,0,0,0.3)',
            }}
          />

          <div className="px-4 pb-5 pt-3">
            {controls}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
