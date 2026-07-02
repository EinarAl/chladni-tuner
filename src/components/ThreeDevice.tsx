import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { MotionValue } from 'motion/react'
import { frequencyToNote } from '../lib/notes'
import ChladniCanvas from './ChladniCanvas'
import NoteDisplay from './NoteDisplay'
import CentMeter from './CentMeter'

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
// const screenGeo = extrudeGeo(SCREEN_W, SCREEN_H, 25, 10)
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

function ScreenHtml({ frequency }: { frequency: number | null }) {
  const note = frequencyToNote(frequency ?? 82)
  return (
    <div className="w-full h-full flex flex-col p-[4.5%] pb-0 pt-[2.8%]">
      <div className="flex-1 bg-[#0a0a14] rounded-2xl border border-white/5 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 p-4 pb-0">
          <ChladniCanvas frequency={frequency} />
        </div>
        <div className="px-4 py-3 space-y-2">
          <NoteDisplay note={note} frequency={frequency} />
          <CentMeter cents={note.cents} />
        </div>
      </div>
    </div>
  )
}

function SceneContent(props: Props) {
  const { rollX, rollY, frequency, mode, onModeChange, onStepUp, onStepDown, onOctaveUp, onOctaveDown } = props
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
        {/* <mesh geometry={screenGeo} position={[sx(26 + SCREEN_W / 2), sy(26 + SCREEN_H / 2), SURFACE_Z]}>
          <meshBasicMaterial color="#0f0f1a" side={THREE.DoubleSide} />
        </mesh> */}
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
        <Html
          transform
          center
          position={[sx(26 + SCREEN_W / 2), sy(26 + SCREEN_H / 2), SURFACE_Z + 1]}
          scale={37}
        >
          <div style={{
            width: SCREEN_W,
            height: SCREEN_H,
            background: '#0b0b18',
            borderRadius: 25,
            pointerEvents: 'none',
          }}>
            <ScreenHtml frequency={frequency} />
          </div>
        </Html>
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
      <directionalLight position={[-4, -3, 5]} intensity={0.5} color="#4477ff" />
      <directionalLight position={[0, 0, -5]} intensity={0.6} color="#ffffff" />
      <SceneContent {...props} />
    </Canvas>
  )
}
