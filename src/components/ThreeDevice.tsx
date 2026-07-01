import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { MotionValue } from 'motion/react'
import { useChladni } from '../hooks/useChladni'
import { applyAnimatedDither } from '../lib/dither'
import { frequencyToNote } from '../lib/notes'

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
const SCREEN_W = 527, SCREEN_H = 752

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
const screenGeo = extrudeGeo(SCREEN_W, SCREEN_H, 25, 10)
const bigBtnGeo = extrudeGeo(73, 73, 15, 20)
const smallBtnGeo = extrudeGeo(49, 49, 10, 20)

type BtnId = 'tuner' | 'sound' | 'stepUp' | 'stepDown' | 'octUp' | 'octDown'

function Leds({ mode }: { mode: Mode }) {
  return (
    <group>
      <mesh position={[sx(135.5), sy(851.5), SURFACE_Z - 4]}>
        <sphereGeometry args={[7, 24, 16]} />
        <meshPhysicalMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={mode === 'tuner' ? 0.6 : 0} metalness={0.15} roughness={0.35} />
      </mesh>
      <mesh position={[sx(441.5), sy(851.5), SURFACE_Z - 4]}>
        <sphereGeometry args={[7, 24, 16]} />
        <meshPhysicalMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={mode === 'sound' ? 0.6 : 0} metalness={0.15} roughness={0.35} />
      </mesh>
    </group>
  )
}

function SceneContent({
  rollX, rollY, mode, onModeChange, onStepUp, onStepDown, onOctaveUp, onOctaveDown,
  grid, frequency,
  pixels, texture,
}: Props & {
  grid: Float32Array | null
  frequency: number | null
  pixels: Uint8Array
  texture: THREE.DataTexture
}) {
  const rotatorRef = useRef<THREE.Group>(null)
  const { viewport, gl } = useThree()
  const [pressedBtn, setPressedBtn] = useState<BtnId | null>(null)

  const scale = useMemo(() => {
    const pad = 0.20
    return Math.min(viewport.width * (1 - pad) / SW, viewport.height * (1 - pad) / SH)
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
    try {
      if (!rotatorRef.current) return
      rotatorRef.current.rotation.x = rollX.get() * (Math.PI / 180)
      rotatorRef.current.rotation.y = rollY.get() * (Math.PI / 180)

      // Fill background
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 10; pixels[i+1] = 10; pixels[i+2] = 20; pixels[i+3] = 255
      }

      // Chladni
      if (grid) {
        const dithered = applyAnimatedDither(grid, 256, performance.now() / 1000)
        const ox = (SCREEN_W - 256) / 2, oy = 20
        for (let y = 0; y < 256; y++) {
          const dy = oy + y
          if (dy < 0 || dy >= SCREEN_H) continue
          for (let x = 0; x < 256; x++) {
            const dx = ox + x
            if (dx < 0 || dx >= SCREEN_W) continue
            const si = (y * 256 + x) * 4
            const di = (dy * SCREEN_W + dx) * 4
            const v = dithered.data[si]
            pixels[di] = v; pixels[di+1] = v; pixels[di+2] = v; pixels[di+3] = 255
          }
        }
      }

      // Note info
      const note = frequencyToNote(frequency ?? 82)
      const baseY = 20 + 256 + 50
      const noteStr = `${note.name} ${note.octave}`
      const freqStr = note.frequency > 0 ? `${note.frequency.toFixed(1)} hz` : '-- hz'
      const centStr = note.name !== '--' ? `${note.cents > 0 ? '+' : ''}${note.cents} ct` : '-- ct'

      // Simple text rasterization via temp canvas
      const tc = document.createElement('canvas')
      tc.width = SCREEN_W; tc.height = SCREEN_H
      const tctx = tc.getContext('2d')!

      tctx.font = 'bold 42px system-ui, sans-serif'
      tctx.fillStyle = '#ffffff'
      tctx.textAlign = 'center'
      tctx.textBaseline = 'middle'
      tctx.fillText(noteStr, SCREEN_W / 2, baseY)

      tctx.font = '13px ui-monospace, monospace'
      tctx.fillStyle = '#a3a3a3'
      tctx.fillText(freqStr, SCREEN_W / 2, baseY + 40)

      tctx.fillStyle = '#00ff88'
      tctx.fillText(centStr, SCREEN_W / 2, baseY + 60)

      // Cent meter
      const centerIdx = 12
      const clamped = Math.max(-50, Math.min(50, note.cents))
      const activeIdx = Math.round(((clamped + 50) / 100) * 24)
      const lo = Math.min(centerIdx, activeIdx)
      const hi = Math.max(centerIdx, activeIdx)
      const barY = SCREEN_H - 70
      const segs = 25, gap = 3, segW = 12
      const totalW = segs * segW + (segs - 1) * gap
      const startX = (SCREEN_W - totalW) / 2
      for (let i = 0; i < segs; i++) {
        const on = i >= lo && i <= hi
        const isC = i === centerIdx
        const h = isC ? 28 : Math.round(12 + (i % 3) * 4)
        const color = isC ? (on ? '#ffffff' : '#555555') : on ? '#ffffff' : '#333333'
        tctx.fillStyle = color
        tctx.fillRect(startX + i * (segW + gap), barY - h / 2, segW, h)
      }

      // Labels
      tctx.font = '10px ui-monospace, monospace'
      tctx.fillStyle = '#555555'
      tctx.textAlign = 'center'
      tctx.textBaseline = 'top'
      tctx.fillText('-50', startX, barY + 24)
      tctx.fillText('0', SCREEN_W / 2, barY + 24)
      tctx.fillText('+50', startX + totalW, barY + 24)

      // Copy text canvas pixels into texture array (alpha blend)
      const srcData = tctx.getImageData(0, 0, SCREEN_W, SCREEN_H).data
      for (let i = 3; i < srcData.length; i += 4) {
        if (srcData[i] > 128) {
          pixels[i - 3] = srcData[i - 3]
          pixels[i - 2] = srcData[i - 2]
          pixels[i - 1] = srcData[i - 1]
          pixels[i] = 255
        }
      }

      texture.needsUpdate = true
    } catch (e) {
      console.error('useFrame error:', e)
    }
  })

  return (
    <group ref={rotatorRef}>
      <group scale={[scale, scale, scale]}>
        <mesh geometry={bodyGeo} position={[0, 0, BODY_Z]}>
          <meshPhysicalMaterial color="#1a1a2e" metalness={0.3} roughness={0.4} clearcoat={0.1} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={screenGeo} position={[sx(26 + SCREEN_W / 2), sy(26 + SCREEN_H / 2), SURFACE_Z - 9.9]}>
          <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
        </mesh>
        <Leds mode={mode} />
        {[
          { id: 'tuner' as BtnId, geo: bigBtnGeo, pos: [sx(24 + 73 / 2), sy(815 + 73 / 2)], action: () => onModeChange('tuner') },
          { id: 'sound' as BtnId, geo: bigBtnGeo, pos: [sx(480 + 73 / 2), sy(815 + 73 / 2)], action: () => onModeChange('sound') },
          { id: 'octUp' as BtnId, geo: smallBtnGeo, pos: [sx(354 + 49 / 2), sy(826 + 49 / 2)], action: () => onOctaveUp() },
          { id: 'stepUp' as BtnId, geo: smallBtnGeo, pos: [sx(294 + 49 / 2), sy(826 + 49 / 2)], action: () => onStepUp() },
          { id: 'stepDown' as BtnId, geo: smallBtnGeo, pos: [sx(234 + 49 / 2), sy(826 + 49 / 2)], action: () => onStepDown() },
          { id: 'octDown' as BtnId, geo: smallBtnGeo, pos: [sx(174 + 49 / 2), sy(826 + 49 / 2)], action: () => onOctaveDown() },
        ].map(b => (
          <mesh key={b.id} geometry={b.geo} position={[b.pos[0], b.pos[1], SURFACE_Z + (pressedBtn === b.id ? -3 : 0)]}
            onPointerDown={(e) => { e.stopPropagation(); buttonHitRef.current = true; setPressedBtn(b.id); b.action() }}
            onPointerUp={() => setPressedBtn(null)} onPointerLeave={() => setPressedBtn(null)}>
            <meshPhysicalMaterial color="#262626" metalness={0.1} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function ThreeDevice(props: Props) {
  const { grid } = useChladni(props.frequency)

  const [pixels] = useState(() => new Uint8Array(SCREEN_W * SCREEN_H * 4))
  const [screenTex] = useState(() => {
    const t = new THREE.DataTexture(pixels, SCREEN_W, SCREEN_H, THREE.RGBAFormat)
    t.colorSpace = THREE.SRGBColorSpace
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
    t.generateMipmaps = false
    return t
  })

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
      <directionalLight position={[-4, -3, 5]} intensity={0.5} color="#4477ff" />
      <directionalLight position={[0, 0, -5]} intensity={0.6} color="#ffffff" />
      <SceneContent
        {...props}
        grid={grid}
        pixels={pixels}
        texture={screenTex}
      />
    </Canvas>
  )
}
