import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { MotionValue } from 'motion/react'
import { frequencyToNote } from '../lib/notes'
import { useChladni } from '../hooks/useChladni'
import { applyAnimatedDither } from '../lib/dither'

type Mode = 'tuner' | 'sound'

interface Props {
  rollX: MotionValue<number>
  rollY: MotionValue<number>
  frequency: number | null
  mode: Mode
  onModeChange: (m: Mode) => void
  onStepUp: () => void
  onStepDown: () => void
  onOctaveUp: () => void
  onOctaveDown: () => void
}

const SW = 577, SH = 917
const BODY_Z = 0, BODY_DEPTH = 60, SURFACE_Z = BODY_Z + BODY_DEPTH

function sx(v: number) { return v - SW / 2 }
function sy(v: number) { return -(v - SH / 2) }
function clamp(v: number, a: number, b: number) { return Math.min(Math.max(v, a), b) }

function rectShape(w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2)
  const s = new THREE.Shape()
  const hw = w / 2, hh = h / 2
  s.moveTo(-hw + r, -hh)
  s.lineTo(hw - r, -hh)
  s.quadraticCurveTo(hw, -hh, hw, -hh + r)
  s.lineTo(hw, hh - r)
  s.quadraticCurveTo(hw, hh, hw - r, hh)
  s.lineTo(-hw + r, hh)
  s.quadraticCurveTo(-hw, hh, -hw, hh - r)
  s.lineTo(-hw, -hh + r)
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh)
  return s
}

function extrudeGeo(w: number, h: number, r: number, d: number) {
  return new THREE.ExtrudeGeometry(rectShape(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 4 })
}

const bodyGeo = extrudeGeo(SW, SH, 25, BODY_DEPTH)
const bigBtnGeo = extrudeGeo(73, 73, 15, 20)
const smallBtnGeo = extrudeGeo(49, 49, 10, 20)

type BtnId = 'tuner' | 'sound' | 'stepUp' | 'stepDown' | 'octUp' | 'octDown'

function Leds({ mode }: { mode: Mode }) {
  return (
    <group>
      <mesh position={[sx(135.5), sy(837.5), SURFACE_Z - 4]}>
        <sphereGeometry args={[7, 24, 16]} />
        <meshPhysicalMaterial color={mode === 'tuner' ? '#00ff88' : '#003322'} emissive="#00ff88" emissiveIntensity={mode === 'tuner' ? 0.6 : 0} metalness={0.15} roughness={0.35} />
      </mesh>
      <mesh position={[sx(441.5), sy(837.5), SURFACE_Z - 4]}>
        <sphereGeometry args={[7, 24, 16]} />
        <meshPhysicalMaterial color={mode === 'sound' ? '#00ff88' : '#003322'} emissive="#00ff88" emissiveIntensity={mode === 'sound' ? 0.6 : 0} metalness={0.15} roughness={0.35} />
      </mesh>
    </group>
  )
}

function ButtonIcon({ id, size, position }: { id: BtnId; size: number; position: [number, number, number] }) {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/icons/${id}.svg`)
      .then(r => r.text())
      .then(svg => {
        if (cancelled) return
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => {
          if (cancelled) { URL.revokeObjectURL(url); return }
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')!
          const adj: Record<string, { sc?: number; dy?: number }> = { sound: { sc: 0.7 }, octUp: { dy: 4 }, octDown: { dy: -4 } }
          const a = adj[id] ?? {}
          const iconScale = a.sc ?? 0.85
          const scale = Math.min(size / img.width, size / img.height) * iconScale
          const w = Math.round(img.width * scale)
          const h = Math.round(img.height * scale)
          const oy = Math.round((size - h) / 2) + (a.dy ?? 0)
          ctx.drawImage(img, Math.round((size - w) / 2), oy, w, h)
          URL.revokeObjectURL(url)
          const t = new THREE.CanvasTexture(canvas)
          t.needsUpdate = true
          setTex(t)
        }
        img.onerror = () => { URL.revokeObjectURL(url) }
        img.src = url
      })
    return () => { cancelled = true }
  }, [id, size])

  if (!tex) return null

  return (
    <mesh position={position}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  )
}

const TX = 1024, TY = 1460
const TOP_OFFSET = 72
const CONTENT_BTM = 1420
const CROP_RATIO = CONTENT_BTM / TY
const SCREEN_W = 527
const SCREEN_H = 752
const SCREEN_H_NEW = Math.round(SCREEN_H * CROP_RATIO)
const SEG = 25

function ScreenCanvas({ frequency }: { frequency: number | null }) {
  const t0 = useRef(performance.now())
  const note = frequencyToNote(frequency ?? 0)
  const { grid, prevGrid, transitionStart, gridSize } = useChladni(frequency)

  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = TX
    c.height = TY
    return c
  }, [])

  const tmp = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = gridSize
    c.height = gridSize
    return c
  }, [gridSize])

  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.LinearFilter
    t.colorSpace = THREE.SRGBColorSpace
    t.repeat.set(1, CROP_RATIO)
    t.needsUpdate = true
    return t
  }, [canvas])

  useFrame(() => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, TX, TY)
    ctx.fillStyle = '#0d0d1a'
    ctx.fillRect(0, 0, TX, TY)

    const cSize = Math.round(TY * 0.6)
    const cP = (TX - cSize) / 2

    if (grid) {
      const elapsed = (performance.now() - t0.current) / 1000
      let blend: number | undefined
      if (prevGrid && transitionStart !== null) {
        const dt = performance.now() - transitionStart
        if (dt < 600) {
          blend = dt / 600
        }
      }
      const img = applyAnimatedDither(grid, gridSize, elapsed, prevGrid, blend)
      if (img) {
        const tc = tmp.getContext('2d')
        if (tc) {
          tc.putImageData(img, 0, 0)
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(tmp, cP, cP + TOP_OFFSET, cSize, cSize)
        }
      }
    }

    const ok = note.name !== '--'
    const ny = cP + cSize + 50 + TOP_OFFSET

    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'

    if (ok) {
      let base = note.name
      let acc = ''
      if (note.name.length >= 2 && (note.name[1] === '#' || note.name[1] === 'b')) {
        base = note.name[0]
        acc = note.name[1]
      }
      const octStr = String(note.octave)

      ctx.font = 'bold 80px system-ui, sans-serif'
      const baseW = ctx.measureText(base).width
      ctx.font = 'bold 44px system-ui, sans-serif'
      const accW = acc ? ctx.measureText(acc).width : 0
      const octW = ctx.measureText(octStr).width

      const gap = 8
      const totalW = baseW + (acc ? accW + gap : 0) + octW + gap
      const sx = TX / 2 - totalW / 2

      ctx.font = 'bold 80px system-ui, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(base, sx, ny)

      if (acc) {
        ctx.font = 'bold 44px system-ui, sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.fillText(acc, sx + baseW + gap, ny - 6)
      }

      ctx.font = 'bold 44px system-ui, sans-serif'
      ctx.fillStyle = '#a3a3a3'
      ctx.fillText(octStr, sx + baseW + (acc ? accW + gap : 0) + gap, ny + 34)
    } else {
      ctx.font = 'bold 80px system-ui, sans-serif'
      ctx.fillStyle = '#525252'
      ctx.textAlign = 'center'
      ctx.fillText('--', TX / 2, ny)
      ctx.textAlign = 'left'
    }

    const freqStr = frequency ? `${frequency.toFixed(1)} Hz` : '-- Hz'
    const ctStr = ok ? `${note.cents > 0 ? '+' : ''}${note.cents} ct` : '-- ct'
    ctx.font = '26px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#a3a3a3'
    ctx.fillText(freqStr, TX / 2 - 80, ny + 100)
    ctx.fillStyle = ok && Math.abs(note.cents) < 5 ? '#22c55e' : '#a3a3a3'
    ctx.fillText(ctStr, TX / 2 + 80, ny + 100)

    const my = ny + 180
    const sw = Math.round(cSize / SEG)
    const mw = sw * SEG
    const mx = (TX - mw) / 2
    const ctr = Math.floor(SEG / 2)
    const cl = Math.max(-50, Math.min(50, note.cents))
    const ai = Math.round(((cl + 50) / 100) * (SEG - 1))
    const lo = Math.min(ctr, ai)
    const hi = Math.max(ctr, ai)

    for (let i = 0; i < SEG; i++) {
      const isC = i === ctr
      const isA = ok && i >= lo && i <= hi
      ctx.fillStyle = isC ? (isA ? '#ffffff' : '#737373') : isA ? '#ffffff' : '#404040'
      const centerH = 56
      const d = Math.abs(i - ctr)
      const h = d === 0 ? centerH : Math.round(52 - ((d - 1) % 3) * 8)
      const y = my + (d === 0 ? 0 : (centerH - h) / 2)
      const r = (sw - 2) / 2
      ctx.beginPath()
      ctx.roundRect(mx + i * sw, y, sw - 2, h, r)
      ctx.fill()
    }

    const tune = ok && Math.abs(note.cents) < 5
    ctx.font = '20px ui-monospace, monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#737373'
    ctx.fillText('-50', mx, my + 54)
    ctx.textAlign = 'center'
    ctx.fillStyle = tune ? '#ffffff' : '#737373'
    ctx.fillText('0', TX / 2, my + 54)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#737373'
    ctx.fillText('+50', mx + mw, my + 54)

    tex.needsUpdate = true
  })

  return (
    <mesh position={[sx(26 + SCREEN_W / 2), sy(26 + SCREEN_H_NEW / 2), SURFACE_Z + 3]}>
      <planeGeometry args={[SCREEN_W, SCREEN_H_NEW]} />
      <meshBasicMaterial map={tex} side={THREE.DoubleSide} />
    </mesh>
  )
}

function SceneContent(props: Props) {
  const { rollX, rollY, frequency, mode, onModeChange, onStepUp, onStepDown, onOctaveUp, onOctaveDown } = props
  const rotatorRef = useRef<THREE.Group>(null)
  const { viewport, gl } = useThree()
  const [pressedBtn, setPressedBtn] = useState<BtnId | null>(null)

  const scale = useMemo(() => {
    const pad = 0.40
    return Math.min(viewport.width * (1 - pad) / SW, viewport.height * (1 - pad) / SH) * 1.25
  }, [viewport.width, viewport.height])

  const buttonHitRef = useRef(false)
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 })

  useEffect(() => {
    const el = gl.domElement
    const onDown = (e: PointerEvent) => {
      if (buttonHitRef.current) { buttonHitRef.current = false; return }
      el.setPointerCapture(e.pointerId)
      dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY }
    }
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d.active) return
      if (e.buttons === 0) { d.active = false; return }
      const dx = e.clientX - d.lastX, dy = e.clientY - d.lastY
      d.lastX = e.clientX; d.lastY = e.clientY
      rollY.set(clamp(rollY.get() + dx * 0.3, -30, 30))
      rollX.set(clamp(rollX.get() + dy * 0.3, -30, 30))
    }
    const onUp = () => { dragRef.current.active = false }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onUp)
    }
  }, [gl, rollX, rollY])

  useFrame(() => {
    if (!rotatorRef.current) return
    rotatorRef.current.rotation.x = rollX.get() * (Math.PI / 180)
    rotatorRef.current.rotation.y = rollY.get() * (Math.PI / 180)
  })

  return (
    <group ref={rotatorRef}>
      <group scale={[scale, scale, scale]}>
        <mesh geometry={bodyGeo} position={[0, 0, BODY_Z]}>
          <meshPhysicalMaterial color="#1a1a2e" metalness={0.3} roughness={0.4} clearcoat={0.1} side={THREE.DoubleSide} />
        </mesh>
        <Leds mode={mode} />
        {[
          { id: 'tuner' as BtnId, geo: bigBtnGeo, pos: [sx(24 + 73 / 2), sy(801 + 73 / 2)], iconSize: 40, action: () => onModeChange('tuner') },
          { id: 'sound' as BtnId, geo: bigBtnGeo, pos: [sx(480 + 73 / 2), sy(801 + 73 / 2)], iconSize: 40, action: () => onModeChange('sound') },
          { id: 'octUp' as BtnId, geo: smallBtnGeo, pos: [sx(354 + 49 / 2), sy(812 + 49 / 2)], iconSize: 28, action: () => onOctaveUp() },
          { id: 'stepUp' as BtnId, geo: smallBtnGeo, pos: [sx(294 + 49 / 2), sy(812 + 49 / 2)], iconSize: 28, action: () => onStepUp() },
          { id: 'stepDown' as BtnId, geo: smallBtnGeo, pos: [sx(234 + 49 / 2), sy(812 + 49 / 2)], iconSize: 28, action: () => onStepDown() },
          { id: 'octDown' as BtnId, geo: smallBtnGeo, pos: [sx(174 + 49 / 2), sy(812 + 49 / 2)], iconSize: 28, action: () => onOctaveDown() },
        ].map(b => (
          <group key={b.id}>
            <mesh geometry={b.geo} position={[b.pos[0], b.pos[1], SURFACE_Z + (pressedBtn === b.id ? -3 : 0)]}
              onPointerDown={(e) => { e.stopPropagation(); buttonHitRef.current = true; setPressedBtn(b.id); b.action() }}
              onPointerUp={() => setPressedBtn(null)} onPointerLeave={() => setPressedBtn(null)}>
              <meshPhysicalMaterial color="#262626" metalness={0.1} roughness={0.5} side={THREE.DoubleSide} />
            </mesh>
            <ButtonIcon id={b.id} size={b.iconSize} position={[b.pos[0], b.pos[1], SURFACE_Z + 25 + (pressedBtn === b.id ? -3 : 0)]} />
          </group>
        ))}
        <ScreenCanvas frequency={frequency} />
      </group>
    </group>
  )
}

export default function ThreeDevice(props: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 500], fov: 50, near: 1, far: 2000 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <color attach="background" args={['#0b1a2e']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 8]} intensity={1.5} />
      <directionalLight position={[0, 0, -5]} intensity={0.6} color="#ffffff" />
      <SceneContent {...props} />
    </Canvas>
  )
}
