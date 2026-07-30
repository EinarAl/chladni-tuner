import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { MotionValue } from 'motion/react'
import { frequencyToNote } from '../lib/notes'
import { useChladni } from '../hooks/useChladni'
import { applyAnimatedDither } from '../lib/dither'

type Mode = 'tuner' | 'sound'
type Simulation = 'cos' | 'ritz-free' | 'ritz-clamped'

interface Props {
  rollX: MotionValue<number>
  rollY: MotionValue<number>
  frequency: number | null
  mode: Mode
  micDenied: boolean
  onModeChange: (m: Mode) => void
  onStepUp: () => void
  onStepDown: () => void
  onCentUp?: () => void
  onCentDown?: () => void
  onOctaveUp: () => void
  onOctaveDown: () => void
  centsOffset?: number
  settingsMode: boolean
  settingsSelection: number
  simDropdownOpen: boolean
  simDropdownSelection: number
  invert: boolean
  simulation: Simulation
  onSettingsToggle: () => void
  onSettingsSelect: () => void
  onSettingsUp: () => void
  onSettingsDown: () => void
}

const SW = 577, SH = 1201
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

function circleShape(r: number) {
  const s = new THREE.Shape()
  s.absarc(0, 0, r, 0, Math.PI * 2, false)
  return s
}

function ringSectorShape(ir: number, or: number, ts: number, tl: number) {
  const segs = 20
  const s = new THREE.Shape()
  for (let i = 0; i <= segs; i++) {
    const t = ts + (i / segs) * tl
    const x = ir * Math.cos(t), y = ir * Math.sin(t)
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y)
  }
  const end = ts + tl
  s.lineTo(or * Math.cos(end), or * Math.sin(end))
  for (let i = segs; i >= 0; i--) {
    const t = ts + (i / segs) * tl
    s.lineTo(or * Math.cos(t), or * Math.sin(t))
  }
  s.closePath()
  return s
}

const bodyGeo = extrudeGeo(SW, SH, 25, BODY_DEPTH)
const bigBtnGeo = extrudeGeo(73, 73, 15, 20)
const toggleGeo = new THREE.ExtrudeGeometry(circleShape(99.5), { depth: 20, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 4 })

const GAP = 0.025
const IR = 104, OR = 173
const arcDep = { depth: 20, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 2 }

const arcGeoNorth = new THREE.ExtrudeGeometry(ringSectorShape(IR, OR, 5 * Math.PI / 4 + GAP, Math.PI / 2 - 2 * GAP), arcDep)
const arcGeoSouth = new THREE.ExtrudeGeometry(ringSectorShape(IR, OR, Math.PI / 4 + GAP, Math.PI / 2 - 2 * GAP), arcDep)
const arcGeoEastUpper = new THREE.ExtrudeGeometry(ringSectorShape(IR, OR, GAP, Math.PI / 4 - 2 * GAP), arcDep)
const arcGeoEastLower = new THREE.ExtrudeGeometry(ringSectorShape(IR, OR, 7 * Math.PI / 4 + GAP, Math.PI / 4 - 2 * GAP), arcDep)
const arcGeoWestUpper = new THREE.ExtrudeGeometry(ringSectorShape(IR, OR, 3 * Math.PI / 4 + GAP, Math.PI / 4 - 2 * GAP), arcDep)
const arcGeoWestLower = new THREE.ExtrudeGeometry(ringSectorShape(IR, OR, Math.PI + GAP, Math.PI / 4 - 2 * GAP), arcDep)

type BtnId = 'tuner' | 'sound' | 'toggle' | 'north' | 'south' | 'eastUpper' | 'eastLower' | 'westUpper' | 'westLower'

function ButtonIcon({ id, size, position }: { id: BtnId; size: number; position: [number, number, number] }) {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    let cancelled = false
    const iconMap: Record<string, string> = {
      tuner: 'tuner', sound: 'sound',
      north: 'arrow-up', south: 'arrow-down',
      eastUpper: 'stepUp', westUpper: 'stepDown',
      eastLower: 'plus', westLower: 'minus',
      toggle: 'settings',
    }
    const iconId = iconMap[id] ?? id
    fetch(`/icons/${iconId}.svg`)
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
          const adj: Record<string, { sc?: number; dy?: number }> = { sound: { sc: 0.7 }, north: { sc: 0.6 }, south: { sc: 0.6 } }
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
const CTR = Math.floor(SEG / 2)

const CENT_SIZE = Math.round(TY * 0.6)
const CENT_CP = (TX - CENT_SIZE) / 2
const CHLADNI_TOP = CENT_CP + TOP_OFFSET
const CENT_NY = CENT_CP + CENT_SIZE + 50 + TOP_OFFSET
const CENT_MY = CENT_NY + 180
const CENT_SW = Math.round(CENT_SIZE / SEG)
const CENT_MW = CENT_SW * SEG
const CENT_MX = (TX - CENT_MW) / 2

const SIMULATION_LABELS: Record<Simulation, string> = {
  'cos': 'Cos Approximation',
  'ritz-free': 'Ritz Free-Edge',
  'ritz-clamped': 'Ritz Clamped',
}
const SIM_OPTIONS: Simulation[] = ['cos', 'ritz-free', 'ritz-clamped']

function ScreenCanvas({ frequency, centsOffset, settingsMode, settingsSelection, simDropdownOpen, simDropdownSelection, invert, simulation }: {
  frequency: number | null
  centsOffset?: number
  settingsMode: boolean
  settingsSelection: number
  simDropdownOpen: boolean
  simDropdownSelection: number
  invert: boolean
  simulation: Simulation
}) {
  const t0 = useRef(performance.now())
  const centsRef = useRef(centsOffset)
  centsRef.current = centsOffset
  const note = frequencyToNote(frequency ?? 0)
  const { grid, prevGrid, transitionStart, gridSize, isLoading } = useChladni(frequency, simulation)

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

    if (settingsMode) {
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'

      ctx.font = 'bold 48px system-ui, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.fillText('SETTINGS', TX / 2, CHLADNI_TOP)
      ctx.textAlign = 'left'

      const items: { label: string; type: string }[] = [
        { label: 'Back', type: 'back' },
        { label: `Invert Chladni: ${invert ? 'ON' : 'OFF'}`, type: 'invert' },
        { label: `Simulation: ${SIMULATION_LABELS[simulation]}`, type: 'simulation' },
      ]

      const itemY = CHLADNI_TOP + 120
      const itemH = 64
      const itemX = 120
      const itemW = TX - 240

      let drawIdx = 0
      for (let i = 0; i < items.length; i++) {
        const y = itemY + drawIdx * itemH

        const isSel = !simDropdownOpen && settingsSelection === i
        ctx.fillStyle = isSel ? '#ffffff' : 'transparent'
        ctx.beginPath()
        ctx.roundRect(itemX, y, itemW, itemH - 4, 10)
        ctx.fill()

        ctx.font = 'bold 36px system-ui, sans-serif'
        ctx.fillStyle = isSel ? '#0d0d1a' : '#ffffff'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(items[i].label, itemX + 16, y + (itemH - 4) / 2)
        drawIdx++
      }

      const ddOptions = SIM_OPTIONS.filter(s => s !== simulation)

      if (simDropdownOpen) {
        const ddY = itemY + 2 * itemH + itemH + 20
        for (let i = 0; i < ddOptions.length; i++) {
          const y = ddY + i * itemH
          const isSel = simDropdownSelection === i
          ctx.fillStyle = isSel ? '#ffffff' : 'transparent'
          ctx.beginPath()
          ctx.roundRect(itemX + 32, y, itemW - 32, itemH - 4, 8)
          ctx.fill()

          ctx.font = '28px system-ui, sans-serif'
          ctx.fillStyle = isSel ? '#0d0d1a' : '#a3a3a3'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(SIMULATION_LABELS[ddOptions[i]], itemX + 48, y + (itemH - 4) / 2)
        }
      }

      tex.needsUpdate = true
      return
    }

    if (isLoading) {
      const pulse = Math.sin(performance.now() / 500) * 0.3 + 0.7
      ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`
      ctx.font = 'bold 90px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('LOADING', TX / 2, TY / 2)
      ctx.font = '24px ui-monospace, monospace'
      ctx.fillStyle = `rgba(163, 163, 163, ${pulse * 0.6})`
      ctx.fillText('computing modes...', TX / 2, TY / 2 + 70)
      tex.needsUpdate = true
      return
    }

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
      const img = applyAnimatedDither(grid, gridSize, elapsed, prevGrid, blend, 0, invert)
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
      const sx2 = TX / 2 - totalW / 2

      ctx.font = 'bold 80px system-ui, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(base, sx2, ny)

      if (acc) {
        ctx.font = 'bold 44px system-ui, sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.fillText(acc, sx2 + baseW + gap, ny - 6)
      }

      ctx.font = 'bold 44px system-ui, sans-serif'
      ctx.fillStyle = '#a3a3a3'
      ctx.fillText(octStr, sx2 + baseW + (acc ? accW + gap : 0) + gap, ny + 34)
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

    const cl = Math.max(-50, Math.min(50, centsRef.current ?? note.cents))
    const ai = Math.round(((cl + 50) / 100) * (SEG - 1))
    const lo = Math.min(CTR, ai)
    const hi = Math.max(CTR, ai)

    for (let i = 0; i < SEG; i++) {
      const isC = i === CTR
      const isA = ok && i >= lo && i <= hi
      ctx.fillStyle = isC ? (isA ? '#ffffff' : '#737373') : isA ? '#ffffff' : '#404040'
      const centerH = 56
      const d = Math.abs(i - CTR)
      const h = d === 0 ? centerH : Math.round(52 - ((d - 1) % 3) * 8)
      const y = CENT_MY + (d === 0 ? 0 : (centerH - h) / 2)
      const r = (CENT_SW - 2) / 2
      ctx.beginPath()
      ctx.roundRect(CENT_MX + i * CENT_SW, y, CENT_SW - 2, h, r)
      ctx.fill()
    }

    const tune = ok && Math.abs(note.cents) < 5
    ctx.font = '20px ui-monospace, monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#737373'
    ctx.fillText('-50', CENT_MX, CENT_MY + 54)
    ctx.textAlign = 'center'
    ctx.fillStyle = tune ? '#ffffff' : '#737373'
    ctx.fillText('0', TX / 2, CENT_MY + 54)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#737373'
    ctx.fillText('+50', CENT_MX + CENT_MW, CENT_MY + 54)

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
  const { rollX, rollY, frequency, mode, micDenied, onModeChange, onStepUp, onStepDown, onCentUp, onCentDown, onOctaveUp, onOctaveDown, centsOffset,   settingsMode, settingsSelection, simDropdownOpen, simDropdownSelection, invert, simulation, onSettingsToggle, onSettingsSelect, onSettingsUp, onSettingsDown } = props
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
      if (!dragRef.current.active) return
      if (e.buttons === 0) { dragRef.current.active = false; return }
      const dx = e.clientX - dragRef.current.lastX, dy = e.clientY - dragRef.current.lastY
      dragRef.current.lastX = e.clientX; dragRef.current.lastY = e.clientY
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

  const handleAction = useCallback((btnId: BtnId) => {
    if (settingsMode) {
      switch (btnId) {
        case 'toggle': onSettingsSelect(); return
        case 'north': onSettingsUp(); return
        case 'south': onSettingsDown(); return
        case 'tuner': onModeChange('tuner'); return
        case 'sound': onModeChange('sound'); return
      }
      return
    }
    switch (btnId) {
      case 'tuner': onModeChange('tuner'); return
      case 'sound': onModeChange('sound'); return
      case 'westUpper': onStepDown(); return
      case 'eastUpper': onStepUp(); return
      case 'westLower': onCentDown?.(); return
      case 'eastLower': onCentUp?.(); return
      case 'north': onOctaveUp(); return
      case 'south': onOctaveDown(); return
      case 'toggle': onSettingsToggle(); return
    }
  }, [settingsMode, onSettingsSelect, onSettingsUp, onSettingsDown, onModeChange, onStepDown, onStepUp, onCentDown, onCentUp, onOctaveUp, onOctaveDown, onSettingsToggle])

  const MID_R = (IR + OR) / 2

  const arcs: { id: BtnId; geo: THREE.BufferGeometry; icon: string; iconS: number; ix: number; iy: number }[] = [
    { id: 'north', geo: arcGeoSouth, icon: 'arrow-up', iconS: 44, ix: 0, iy: MID_R },
    { id: 'south', geo: arcGeoNorth, icon: 'arrow-down', iconS: 44, ix: 0, iy: -MID_R },
    { id: 'eastUpper', geo: arcGeoEastUpper, icon: 'stepUp', iconS: 30, ix: MID_R * Math.cos(Math.PI / 8), iy: MID_R * Math.sin(Math.PI / 8) },
    { id: 'eastLower', geo: arcGeoEastLower, icon: 'plus', iconS: 30, ix: MID_R * Math.cos(15 * Math.PI / 8), iy: MID_R * Math.sin(15 * Math.PI / 8) },
    { id: 'westUpper', geo: arcGeoWestUpper, icon: 'stepDown', iconS: 30, ix: MID_R * Math.cos(7 * Math.PI / 8), iy: MID_R * Math.sin(7 * Math.PI / 8) },
    { id: 'westLower', geo: arcGeoWestLower, icon: 'minus', iconS: 30, ix: MID_R * Math.cos(9 * Math.PI / 8), iy: MID_R * Math.sin(9 * Math.PI / 8) },
  ]

  const modeBtns: { id: BtnId; pos: [number, number] }[] = [
    { id: 'tuner', pos: [sx(24 + 73 / 2), sy(815 + 73 / 2)] },
    { id: 'sound', pos: [sx(480 + 73 / 2), sy(815 + 73 / 2)] },
  ]

  return (
    <group ref={rotatorRef}>
      <group scale={[scale, scale, scale]}>
        <mesh geometry={bodyGeo} position={[0, 0, BODY_Z]}>
          <meshPhysicalMaterial color="#1a1a2e" metalness={0.3} roughness={0.4} clearcoat={0.1} side={THREE.DoubleSide} />
        </mesh>

        {modeBtns.map(b => (
          <group key={b.id}>
            <mesh geometry={bigBtnGeo} position={[b.pos[0], b.pos[1], SURFACE_Z + (pressedBtn === b.id ? -3 : 0)]}
              onPointerDown={(e) => { e.stopPropagation(); buttonHitRef.current = true; setPressedBtn(b.id); handleAction(b.id) }}
              onPointerUp={() => setPressedBtn(null)} onPointerLeave={() => setPressedBtn(null)}>
              <meshPhysicalMaterial color="#262626" metalness={0.1} roughness={0.5} side={THREE.DoubleSide} />
            </mesh>
            <ButtonIcon id={b.id} size={40} position={[b.pos[0], b.pos[1], SURFACE_Z + 25 + (pressedBtn === b.id ? -3 : 0)]} />
            <mesh position={[b.pos[0], b.pos[1] - 27.5, SURFACE_Z + 21 + (pressedBtn === b.id ? -3 : 0)]}>
              <sphereGeometry args={[4, 16, 12]} />
              {(() => {
                const isActive = !settingsMode && mode === b.id
                const isTunerMicDenied = isActive && b.id === 'tuner' && micDenied
                const ledColor = isTunerMicDenied ? '#ff3355' : isActive ? '#00ff88' : '#1a1a2e'
                return (
                  <meshPhysicalMaterial
                    color={ledColor}
                    emissive={ledColor}
                    emissiveIntensity={!isTunerMicDenied && !isActive ? 0 : 0.6}
                    metalness={0.15} roughness={0.35}
                  />
                )
              })()}
            </mesh>
          </group>
        ))}

        <group position={[sx(290), sy(984), SURFACE_Z]}>
          {arcs.map(a => (
            <group key={a.id}>
              <mesh geometry={a.geo} position={[0, 0, pressedBtn === a.id ? -3 : 0]}
                onPointerDown={(e) => { e.stopPropagation(); buttonHitRef.current = true; setPressedBtn(a.id); handleAction(a.id) }}
                onPointerUp={() => setPressedBtn(null)} onPointerLeave={() => setPressedBtn(null)}>
                <meshPhysicalMaterial color="#262626" metalness={0.1} roughness={0.5} side={THREE.DoubleSide} />
              </mesh>
              <ButtonIcon id={a.id} size={a.iconS} position={[a.ix, a.iy, 25 + (pressedBtn === a.id ? -3 : 0)]} />
            </group>
          ))}

          <mesh geometry={toggleGeo} position={[0, 0, pressedBtn === 'toggle' ? -3 : 0]}
            onPointerDown={(e) => { e.stopPropagation(); buttonHitRef.current = true; setPressedBtn('toggle'); handleAction('toggle') }}
            onPointerUp={() => setPressedBtn(null)} onPointerLeave={() => setPressedBtn(null)}>
            <meshPhysicalMaterial color="#262626" metalness={0.1} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
          <ButtonIcon id="toggle" size={72} position={[0, 0, 25 + (pressedBtn === 'toggle' ? -3 : 0)]} />
        </group>

        <mesh position={[sx(60), sy(875), SURFACE_Z + 3]}>
          <sphereGeometry args={[3, 12, 8]} />
          <meshPhysicalMaterial color="#DBD761" emissive="#DBD761" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[sx(517), sy(873), SURFACE_Z + 3]}>
          <sphereGeometry args={[3, 12, 8]} />
          <meshPhysicalMaterial color="#DBD761" emissive="#DBD761" emissiveIntensity={0.4} />
        </mesh>

        <ScreenCanvas
          frequency={frequency}
          centsOffset={centsOffset}
          settingsMode={settingsMode}
          settingsSelection={settingsSelection}
          simDropdownOpen={simDropdownOpen}
          simDropdownSelection={simDropdownSelection}
          invert={invert}
          simulation={simulation}
        />
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
      <directionalLight position={[0, 6, 6]} intensity={1.2} />
      <directionalLight position={[0, 0, -5]} intensity={0.6} color="#ffffff" />
      <SceneContent {...props} />
    </Canvas>
  )
}
