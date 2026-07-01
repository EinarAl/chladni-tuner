import { motion } from 'motion/react'
import type { ReactNode } from 'react'

interface Props {
  chladni: ReactNode
  noteDisplay: ReactNode
  centMeter: ReactNode
  controls: ReactNode
}

export default function TunerDevice({ chladni, noteDisplay, centMeter, controls }: Props) {
  return (
    <div className="min-h-dvh bg-neutral-950 flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-md bg-device rounded-3xl shadow-2xl shadow-black/60 border border-white/5 overflow-hidden"
        style={{ perspective: 800, transformStyle: 'preserve-3d' }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="p-4 pb-2">
          <div className="bg-screen rounded-2xl border border-white/5 p-4 shadow-inner shadow-black/50">
            {chladni}
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          {noteDisplay}
          {centMeter}
        </div>

        <div className="px-4 pb-5 pt-2 border-t border-white/5">
          {controls}
        </div>
      </motion.div>
    </div>
  )
}
