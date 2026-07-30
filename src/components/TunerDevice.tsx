import { type ReactNode } from 'react'

interface Props {
  chladni: ReactNode
  noteDisplay: ReactNode
  centMeter: ReactNode
  controls: ReactNode
}

export default function TunerDevice({ chladni, noteDisplay, centMeter, controls }: Props) {
  return (
    <div className="w-full h-full flex flex-col p-[4.5%] pb-0 pt-[2.8%]">
      <div className="flex-1 bg-screen rounded-2xl border border-white/5 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 p-4 pb-0">
          {chladni}
        </div>
        <div className="px-4 py-3 space-y-2">
          {noteDisplay}
          {centMeter}
        </div>
      </div>

      <div className="mx-0 mt-[2.2%] h-[2px] rounded-full bg-white/5 shrink-0" />

      <div className="pt-[3.3%] pb-[5.5%] shrink-0">
        {controls}
      </div>
    </div>
  )
}
