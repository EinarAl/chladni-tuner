import { motion } from 'motion/react'

type Mode = 'tuner' | 'sound'

interface Props {
  mode: Mode
  onModeChange: (mode: Mode) => void
  onStepUp: () => void
  onStepDown: () => void
  onOctaveUp: () => void
  onOctaveDown: () => void
}

const btnShadow =
  '0 -2px 0 rgba(0,0,0,0.3) inset, 0 2px 0 rgba(255,255,255,0.06) inset, 0 4px 8px rgba(0,0,0,0.4)'
const modeBtn =
  'flex items-center justify-center w-12 h-12 rounded-xl text-sm font-medium transition-colors duration-150 bg-neutral-800 hover:bg-neutral-700 cursor-pointer'
const disabled = 'disabled:opacity-30 disabled:cursor-not-allowed'
const stepBtn =
  'flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium transition-colors duration-150 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 cursor-pointer disabled:cursor-not-allowed'

function TuningFork({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={active ? '#fff' : '#a3a3a3'} strokeWidth="2" strokeLinecap="round">
      <path d="M6 3v8a4 4 0 0 0 8 0V3" />
      <path d="M10 14V3" />
      <path d="M14 5.5H6" />
    </svg>
  )
}

function Speaker({ active }: { active: boolean }) {
  const c = active ? '#fff' : '#a3a3a3'
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="7" width="4" height="10" rx="1" />
      <path d="M8 7l5-4v18l-5-4" />
      <path d="M17 9a4 4 0 0 1 0 6" />
      <path d="M20 7a7 7 0 0 1 0 10" />
    </svg>
  )
}

export default function Controls({ mode, onModeChange, onStepUp, onStepDown, onOctaveUp, onOctaveDown }: Props) {
  return (
    <div className="flex items-center justify-between gap-2">
      <motion.button
        className={`${modeBtn} ${disabled}`}
        style={{ transform: 'translateZ(6px)', boxShadow: btnShadow }}
        whileTap={{ scale: 0.93 }}
        onClick={() => onModeChange('tuner')}
      >
        <TuningFork active={mode === 'tuner'} />
      </motion.button>

      <div className={`w-2 h-2 rounded-full transition-all duration-200 ${mode === 'tuner' ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : 'bg-neutral-700'}`} />

      <div className="flex items-center gap-2">
        <motion.button className={stepBtn} style={{ transform: 'translateZ(6px)', boxShadow: btnShadow }} whileTap={{ scale: 0.93 }} onClick={onOctaveDown} disabled={mode !== 'sound'}>▼</motion.button>
        <motion.button className={stepBtn} style={{ transform: 'translateZ(6px)', boxShadow: btnShadow }} whileTap={{ scale: 0.93 }} onClick={onStepDown} disabled={mode !== 'sound'}>−</motion.button>
        <motion.button className={stepBtn} style={{ transform: 'translateZ(6px)', boxShadow: btnShadow }} whileTap={{ scale: 0.93 }} onClick={onStepUp} disabled={mode !== 'sound'}>+</motion.button>
        <motion.button className={stepBtn} style={{ transform: 'translateZ(6px)', boxShadow: btnShadow }} whileTap={{ scale: 0.93 }} onClick={onOctaveUp} disabled={mode !== 'sound'}>▲</motion.button>
      </div>

      <div className={`w-2 h-2 rounded-full transition-all duration-200 ${mode === 'sound' ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : 'bg-neutral-700'}`} />

      <motion.button
        className={`${modeBtn} ${disabled}`}
        style={{ transform: 'translateZ(6px)', boxShadow: btnShadow }}
        whileTap={{ scale: 0.93 }}
        onClick={() => onModeChange('sound')}
      >
        <Speaker active={mode === 'sound'} />
      </motion.button>
    </div>
  )
}
