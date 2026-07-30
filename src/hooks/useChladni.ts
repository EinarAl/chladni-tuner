import { useRef, useEffect, useState } from 'react'
import { useModesData, MODES_GRID_SIZE } from './useModesData'

type Simulation = 'cos' | 'ritz-free' | 'ritz-clamped'

function findModeIndices(freq: number, freqs: Float64Array): { k1: number; k2: number; t: number } {
  const M = freqs.length
  if (freq <= freqs[0]) return { k1: 0, k2: 0, t: 0 }
  if (freq >= freqs[M - 1]) return { k1: M - 1, k2: M - 1, t: 0 }
  for (let k = 0; k < M - 1; k++) {
    if (freq >= freqs[k] && freq < freqs[k + 1]) {
      const t = (freq - freqs[k]) / (freqs[k + 1] - freqs[k])
      return { k1: k, k2: k + 1, t }
    }
  }
  return { k1: 0, k2: 0, t: 0 }
}

function computeGrid(
  ev: Float64Array,
  phiGrid: Float64Array[],
  nBeams: number,
  gridSize: number,
): Float32Array {
  const N = nBeams
  const grid = new Float32Array(gridSize * gridSize)
  let maxVal = 0
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      let sum = 0
      for (let i = 0; i < N; i++) {
        const phix = phiGrid[i][x]
        if (phix === 0) continue
        for (let j = 0; j < N; j++) {
          sum += ev[i + j * N] * phix * phiGrid[j][y]
        }
      }
      const mag = Math.abs(sum)
      if (mag > maxVal) maxVal = mag
      grid[y * gridSize + x] = sum
    }
  }
  if (maxVal > 1e-15) {
    const scale = 1.5 / maxVal
    for (let i = 0; i < grid.length; i++) grid[i] *= scale
  }
  return grid
}

function computeCosGrid(freq: number, gridSize: number): Float32Array {
  const f = Math.max(20, Math.min(1400, freq))
  const t = (f - 20) / (1400 - 20)
  const base = 1 + t * 6
  const n = base
  const m = base + 0.618

  const grid = new Float32Array(gridSize * gridSize)
  let maxVal = 0
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const px = (x + 0.5) / gridSize * 2 - 1
      const py = (y + 0.5) / gridSize * 2 - 1
      const val = Math.cos(n * Math.PI * px) * Math.cos(m * Math.PI * py)
                - Math.cos(m * Math.PI * px) * Math.cos(n * Math.PI * py)
      const mag = Math.abs(val)
      if (mag > maxVal) maxVal = mag
      grid[y * gridSize + x] = val
    }
  }
  if (maxVal > 1e-15) {
    const scale = 1.5 / maxVal
    for (let i = 0; i < grid.length; i++) grid[i] *= scale
  }
  return grid
}

export function useChladni(frequency: number | null, simulation: Simulation) {
  const { data: modesData, isLoading } = useModesData(simulation)
  const [state, setState] = useState<{
    grid: Float32Array | null
    prevGrid: Float32Array | null
    transitionStart: number | null
  }>(() => {
    if (simulation === 'cos') {
      return { grid: computeCosGrid(200, MODES_GRID_SIZE), prevGrid: null, transitionStart: null }
    }
    return { grid: null, prevGrid: null, transitionStart: null }
  })
  const prevRef = useRef<number | null>(null)
  const frameRef = useRef(0)

  const simRef = useRef(simulation)

  useEffect(() => {
    const freq = frequency ?? 200
    const simChanged = simulation !== simRef.current
    simRef.current = simulation
    if (!simChanged && prevRef.current !== null && Math.abs(freq - prevRef.current) < 0.3) return
    prevRef.current = freq

    const id = ++frameRef.current

    queueMicrotask(() => {
      if (id !== frameRef.current) return

      let newGrid: Float32Array | null = null

      if (simulation === 'cos') {
        newGrid = computeCosGrid(freq, MODES_GRID_SIZE)
      } else if (modesData) {
        const { freqs, evec, phiGrid, nBeams, mvalid: Mvalid } = modesData
        const searchFreq = frequency ?? freqs[Math.floor(Mvalid / 2)]

        const n2 = nBeams * nBeams
        const { k1, k2, t } = findModeIndices(searchFreq, freqs)
        const ev1 = evec.subarray(k1 * n2, (k1 + 1) * n2)

        if (k1 === k2 || t < 0.001) {
          newGrid = computeGrid(ev1, phiGrid, nBeams, MODES_GRID_SIZE)
        } else {
          const ev2 = evec.subarray(k2 * n2, (k2 + 1) * n2)
          const evBlend = new Float64Array(n2)
          for (let n = 0; n < n2; n++) {
            evBlend[n] = ev1[n] * (1 - t) + ev2[n] * t
          }
          newGrid = computeGrid(evBlend, phiGrid, nBeams, MODES_GRID_SIZE)
        }
      }

      if (newGrid) {
        setState(prev => ({
          grid: newGrid,
          prevGrid: prev.grid,
          transitionStart: performance.now(),
        }))
      }
    })
  }, [frequency, modesData, simulation])

  return { ...state, gridSize: MODES_GRID_SIZE, isLoading }
}
