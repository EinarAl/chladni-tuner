import { useEffect, useState } from 'react'
import { beamVal, beamValClamped } from '../lib/beam'

export const MODES_GRID_SIZE = 128

export interface ModesData {
  mvalid: number
  nBeams: number
  freqs: Float64Array
  amps: Float64Array
  evec: Float64Array
  phiGrid: Float64Array[]
}

type Simulation = 'cos' | 'ritz-free' | 'ritz-clamped'

const cache = new Map<string, ModesData>()
const loading = new Map<string, Promise<ModesData | null>>()

async function loadModes(filename: string, clamped: boolean): Promise<ModesData | null> {
  const res = await fetch(filename)
  if (!res.ok) {
    console.warn(`Failed to load ${filename}`)
    return null
  }
  const buf = await res.arrayBuffer()

  const header = new DataView(buf, 0, 16)
  const mvalid = header.getUint32(4, true)
  const gridSize = header.getUint32(8, true)
  const nBeams = header.getUint32(12, true)

  const freqs = new Float64Array(buf, 16, mvalid)
  const amps = new Float64Array(buf, 16 + mvalid * 8, mvalid)
  const evec = new Float64Array(buf, 16 + mvalid * 16, mvalid * nBeams * nBeams)

  const fn = clamped ? beamValClamped : beamVal
  const phiGrid: Float64Array[] = []
  for (let i = 0; i < nBeams; i++) {
    const row = new Float64Array(gridSize)
    for (let gx = 0; gx < gridSize; gx++) {
      row[gx] = fn(i, (gx + 0.5) / gridSize)
    }
    phiGrid.push(row)
  }

  const data: ModesData = { mvalid, nBeams, freqs, amps, evec, phiGrid }
  cache.set(filename, data)
  return data
}

export function useModesData(sim: Simulation): { data: ModesData | null; isLoading: boolean } {
  const [state, setState] = useState<{ data: ModesData | null; isLoading: boolean }>(() => {
    if (sim === 'cos') return { data: null, isLoading: false }
    const filename = sim === 'ritz-clamped' ? `${import.meta.env.BASE_URL}modes_clamped.bin` : `${import.meta.env.BASE_URL}modes.bin`
    const cached = cache.get(filename)
    return { data: cached ?? null, isLoading: !cached }
  })

  useEffect(() => {
    if (sim === 'cos') {
      setState({ data: null, isLoading: false })
      return
    }
    const clamped = sim === 'ritz-clamped'
    const filename = clamped ? `${import.meta.env.BASE_URL}modes_clamped.bin` : `${import.meta.env.BASE_URL}modes.bin`
    const cached = cache.get(filename)
    if (cached) {
      setState({ data: cached, isLoading: false })
      return
    }
    if (!loading.has(filename)) {
      loading.set(filename, loadModes(filename, clamped))
    }
    setState(prev => ({ ...prev, isLoading: true }))
    loading.get(filename)!.then(d => {
      setState({ data: d, isLoading: false })
    })
  }, [sim])

  return state
}
