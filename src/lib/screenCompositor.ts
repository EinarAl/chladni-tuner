import { applyAnimatedDither } from './dither'
import { frequencyToNote } from './notes'

const W = 527
const H = 752
const CHLADNI_SIZE = 256
const CHLADNI_X = (W - CHLADNI_SIZE) / 2
const CHLADNI_Y = 20
const SEGMENTS = 25
const SEG_GAP = 3
const SEG_W = 12
const CENTER = Math.floor(SEGMENTS / 2)

export function createScreenCompositor() {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const reuse = new ImageData(CHLADNI_SIZE, CHLADNI_SIZE)

  function drawChladni(
    grid: Float32Array,
    gridSize: number,
    time: number,
    prevGrid?: Float32Array | null,
    blend?: number,
    noiseBoost?: number,
  ) {
    const src = applyAnimatedDither(grid, gridSize, time, prevGrid, blend, noiseBoost)
    reuse.data.set(src.data)
    ctx.putImageData(reuse, CHLADNI_X, CHLADNI_Y)
  }

  function drawNote(noteName: string, octave: number, freqHz: number, cents: number) {
    const detected = noteName !== '--'

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const baseY = CHLADNI_Y + CHLADNI_SIZE + 50

    ctx.font = 'bold 42px system-ui, sans-serif'
    ctx.fillStyle = detected ? '#ffffff' : '#525252'
    ctx.fillText(noteName, W / 2 - 40, baseY)

    ctx.font = '22px system-ui, sans-serif'
    ctx.fillStyle = detected ? '#a3a3a3' : '#525252'
    ctx.fillText(String(octave), W / 2 + 60, baseY)

    ctx.font = '13px ui-monospace, monospace'
    ctx.fillStyle = '#737373'
    ctx.fillText(freqHz > 0 ? `${freqHz.toFixed(1)} hz` : '-- hz', W / 2, baseY + 32)

    const inTune = detected && Math.abs(cents) < 5
    ctx.fillStyle = inTune ? '#00ff88' : '#737373'
    ctx.fillText(detected ? `${cents > 0 ? '+' : ''}${cents} ct` : '-- ct', W / 2, baseY + 50)
  }

  function drawCentMeter(cents: number) {
    const clamped = Math.max(-50, Math.min(50, cents))
    const activeIndex = Math.round(((clamped + 50) / 100) * (SEGMENTS - 1))
    const lo = Math.min(CENTER, activeIndex)
    const hi = Math.max(CENTER, activeIndex)

    const barY = H - 70
    const totalW = SEGMENTS * SEG_W + (SEGMENTS - 1) * SEG_GAP
    const startX = (W - totalW) / 2

    for (let i = 0; i < SEGMENTS; i++) {
      const isCenter = i === CENTER
      const isActive = i >= lo && i <= hi
      const color = isCenter ? (isActive ? '#ffffff' : '#555555') : isActive ? '#ffffff' : '#333333'
      const h = isCenter ? 28 : Math.round(12 + (i % 3) * 4)

      ctx.fillStyle = color
      ctx.fillRect(startX + i * (SEG_W + SEG_GAP), barY - h / 2, SEG_W, h)
    }

    ctx.font = '10px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#555555'
    ctx.fillText('-50', startX, barY + 24)
    ctx.fillText('0', W / 2, barY + 24)
    ctx.fillText('+50', startX + totalW, barY + 24)
  }

  let lastNoteName = ''
  let lastOctave = 0
  let lastFreqHz = 0
  let lastCents = 0

  function compose(
    grid: Float32Array | null,
    gridSize: number,
    time: number,
    frequency: number | null,
    prevGrid?: Float32Array | null,
    blend?: number,
    noiseBoost?: number,
  ) {
    ctx.fillStyle = '#0f0f1a'
    ctx.fillRect(0, 0, W, H)

    if (grid) {
      drawChladni(grid, gridSize, time, prevGrid, blend, noiseBoost)
    }

    const note = frequencyToNote(frequency ?? 82)

    if (note.name !== lastNoteName || note.octave !== lastOctave || note.frequency !== lastFreqHz || note.cents !== lastCents) {
      lastNoteName = note.name
      lastOctave = note.octave
      lastFreqHz = note.frequency
      lastCents = note.cents
    }

    drawNote(lastNoteName, lastOctave, lastFreqHz, lastCents)
    drawCentMeter(lastCents)
  }

  return { canvas, compose }
}
