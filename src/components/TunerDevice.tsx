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
        className="w-full max-w-sm bg-device rounded-3xl shadow-2xl shadow-black/60 border border-white/5"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="p-4 pb-2">
          <div className="relative bg-screen rounded-2xl border border-white/5 shadow-inner shadow-black/50 overflow-hidden">
            <div className="p-4 pb-0">
              {chladni}
            </div>
            <div className="px-4 py-3 space-y-2">
              {noteDisplay}
              {centMeter}
            </div>
          </div>
        </div>

        <div className="px-4 pb-5 pt-3 border-t border-white/5">
          {controls}
        </div>
      </motion.div>
    </div>
  )
}
