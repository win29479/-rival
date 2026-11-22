import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ARENA_BOUNDS, ARENA_BOXES, JUMP_PADS, type ArenaBox } from '../../shared/arena.ts'
import { useGameStore } from '../store/useGameStore.ts'
import { EffectsLayer } from './EffectsLayer.tsx'
import { PlayerController } from './PlayerController.tsx'
import { RivalAvatar } from './RivalAvatar.tsx'
import { WeaponViewmodel } from './WeaponViewmodel.tsx'
import { WorldEffectsLayer } from './WorldEffectsLayer.tsx'

function createNeonGridTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Deep obsidian arena floor base
  ctx.fillStyle = '#060c18'
  ctx.fillRect(0, 0, size, size)

  // Subtle metallic tile sheen
  ctx.fillStyle = 'rgba(14, 30, 56, 0.35)'
  ctx.fillRect(10, 10, size - 20, size - 20)

  // Inner sub-grid lines
  ctx.strokeStyle = 'rgba(0, 210, 255, 0.18)'
  ctx.lineWidth = 2
  const step = size / 4
  for (let i = 1; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(i * step, 0)
    ctx.lineTo(i * step, size)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, i * step)
    ctx.lineTo(size, i * step)
    ctx.stroke()
  }

  // Primary electric cyan Tron outer grid border
  ctx.strokeStyle = '#00d8ff'
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, size - 6, size - 6)

  // Glowing corner intersections
  ctx.fillStyle = '#7ef9ff'
  ctx.fillRect(0, 0, 14, 14)
  ctx.fillRect(size - 14, 0, 14, 14)
  ctx.fillRect(0, size - 14, 14, 14)
  ctx.fillRect(size - 14, size - 14, 14, 14)

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(13, 16)
  tex.anisotropy = 8
  return tex
}

function createEnergyGlassTexture(color: string): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = color === 'red' ? 'rgba(255, 34, 85, 0.28)' : 'rgba(0, 229, 255, 0.25)'
  ctx.fillRect(0, 0, size, size)

  // Holographic panel tiles inspired by Screenshot 4
  const step = 64
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const alpha = ((x + y) / step) % 2 === 0 ? 0.24 : 0.1
      ctx.fillStyle = color === 'red' ? `rgba(255, 46, 91, ${alpha})` : `rgba(0, 229, 255, ${alpha})`
      ctx.fillRect(x + 3, y + 3, step - 6, step - 6)
    }
  }

  ctx.strokeStyle = color === 'red' ? '#ff3b6b' : '#22f3ff'
  ctx.lineWidth = 4
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, size)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(size, i)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 1)
  return tex
}

function accentHex(accent?: ArenaBox['accent']): string {
  if (accent === 'blue') return '#00e5ff'
  if (accent === 'red') return '#ff2e5b'
  return '#38bdf8'
}

function ArenaBlock({
  box,
  blueGlassTex,
  redGlassTex,
}: {
  box: ArenaBox
  blueGlassTex: THREE.CanvasTexture
  redGlassTex: THREE.CanvasTexture
}) {
  const sx = box.maxX - box.minX
  const sy = box.maxY - box.minY
  const sz = box.maxZ - box.minZ
  const cx = (box.minX + box.maxX) / 2
  const cy = (box.minY + box.maxY) / 2
  const cz = (box.minZ + box.maxZ) / 2
  const glow = accentHex(box.accent)

  if (box.kind === 'glass') {
    const tex = box.accent === 'red' ? redGlassTex : blueGlassTex
    return (
      <group position={[cx, cy, cz]}>
        <mesh>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial
            map={tex}
            color={glow}
            emissive={glow}
            emissiveIntensity={1.2}
            transparent
            opacity={0.72}
            roughness={0.15}
            metalness={0.2}
          />
        </mesh>
        {/* Top neon frame bar */}
        <mesh position={[0, sy / 2 + 0.04, 0]}>
          <boxGeometry args={[sx + 0.08, 0.08, sz + 0.08]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={3.2} />
        </mesh>
      </group>
    )
  }

  if (box.kind === 'pillar') {
    return (
      <group position={[cx, cy, cz]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color="#0b1325" metalness={0.68} roughness={0.32} />
        </mesh>
        {/* Four vertical neon accent strips on pillar edges */}
        {[
          [-sx / 2 - 0.02, -sz / 2 - 0.02],
          [sx / 2 + 0.02, -sz / 2 - 0.02],
          [-sx / 2 - 0.02, sz / 2 + 0.02],
          [sx / 2 + 0.02, sz / 2 + 0.02],
        ].map(([ox, oz], idx) => (
          <mesh key={idx} position={[ox, 0, oz]}>
            <boxGeometry args={[0.12, sy - 0.4, 0.12]} />
            <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={3.4} />
          </mesh>
        ))}
        {/* Mid-band light ring */}
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[sx + 0.14, 0.18, sz + 0.14]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2.8} />
        </mesh>
      </group>
    )
  }

  if (box.kind === 'platform') {
    return (
      <group position={[cx, cy, cz]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color="#0d182d" metalness={0.62} roughness={0.34} />
        </mesh>
        {/* Top glowing cyan edge trim */}
        <mesh position={[0, sy / 2 - 0.04, sz / 2 + 0.02]}>
          <boxGeometry args={[sx, 0.1, 0.06]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={2.6} />
        </mesh>
        <mesh position={[0, sy / 2 - 0.04, -sz / 2 - 0.02]}>
          <boxGeometry args={[sx, 0.1, 0.06]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={2.6} />
        </mesh>
      </group>
    )
  }

  if (box.kind === 'wall') {
    const stripZ = box.id === 'wall-north' ? sz / 2 + 0.05 : box.id === 'wall-south' ? -sz / 2 - 0.05 : 0
    const stripX = box.id === 'wall-west' ? sx / 2 + 0.05 : box.id === 'wall-east' ? -sx / 2 - 0.05 : 0
    const isNS = box.id === 'wall-north' || box.id === 'wall-south'
    return (
      <group position={[cx, cy, cz]}>
        <mesh receiveShadow>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color="#070d1b" metalness={0.7} roughness={0.45} />
        </mesh>
        {/* Dual horizontal neon highway stripes along perimeter wall */}
        <mesh position={[stripX, -2.5, stripZ]}>
          <boxGeometry args={[isNS ? sx - 1 : 0.1, 0.18, isNS ? 0.1 : sz - 1]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={3.2} />
        </mesh>
        <mesh position={[stripX, 3.2, stripZ]}>
          <boxGeometry args={[isNS ? sx - 1 : 0.1, 0.14, isNS ? 0.1 : sz - 1]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2.2} />
        </mesh>
      </group>
    )
  }

  // Cover bunker / tactical crates
  return (
    <group position={[cx, cy, cz]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial color="#111c33" metalness={0.62} roughness={0.34} />
      </mesh>
      <mesh position={[0, sy / 2 - 0.14, 0]}>
        <boxGeometry args={[sx + 0.06, 0.1, sz + 0.06]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2.8} />
      </mesh>
    </group>
  )
}

function CenterMathCoreCrystal() {
  const crystalRef = useRef<THREE.Mesh>(null)
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 0.8
      crystalRef.current.rotation.x = Math.sin(t * 0.6) * 0.25
      crystalRef.current.position.y = 6.2 + Math.sin(t * 1.8) * 0.35
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = t * 0.7
      ring1Ref.current.rotation.x = Math.PI / 3
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.55
      ring2Ref.current.rotation.y = Math.PI / 4
    }
  })

  return (
    <group>
      <mesh ref={crystalRef} position={[0, 6.2, 0]}>
        <octahedronGeometry args={[1.15, 0]} />
        <meshStandardMaterial
          color="#00f0ff"
          emissive="#00e5ff"
          emissiveIntensity={3.0}
          wireframe={false}
          metalness={0.4}
          roughness={0.1}
        />
      </mesh>
      <mesh ref={ring1Ref} position={[0, 6.2, 0]}>
        <torusGeometry args={[2.1, 0.05, 8, 48]} />
        <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={3.0} />
      </mesh>
      <mesh ref={ring2Ref} position={[0, 6.2, 0]}>
        <torusGeometry args={[2.55, 0.045, 8, 48]} />
        <meshStandardMaterial color="#ff2e5b" emissive="#ff2e5b" emissiveIntensity={3.0} />
      </mesh>
    </group>
  )
}

function JumpPadsVisual() {
  const ringsRef = useRef<Array<THREE.Mesh | null>>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    ringsRef.current.forEach((mesh, idx) => {
      if (!mesh) return
      const phase = (t * 1.4 + idx * 0.4) % 1
      mesh.position.y = 0.12 + phase * 1.2
      const s = 1 - phase * 0.35
      mesh.scale.set(s, s, 1)
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - phase) * 0.85
    })
  })

  return (
    <group>
      {JUMP_PADS.map((pad, idx) => {
        const color = pad.accent === 'blue' ? '#00f0ff' : '#ff2e5b'
        return (
          <group key={pad.id} position={[pad.x, 0, pad.z]}>
            {/* Base pad disc */}
            <mesh position={[0, 0.06, 0]}>
              <cylinderGeometry args={[pad.radius, pad.radius + 0.2, 0.12, 24]} />
              <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.25} />
            </mesh>
            {/* Glowing core ring */}
            <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[pad.radius * 0.55, pad.radius * 0.92, 24]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4.0} side={THREE.DoubleSide} />
            </mesh>
            {/* Rising holo-boost ring */}
            <mesh
              ref={(el) => {
                ringsRef.current[idx] = el
              }}
              position={[0, 0.5, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[pad.radius * 0.65, pad.radius * 0.82, 24]} />
              <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function OverheadNeonArches() {
  const archPositions = [-20, -9, 9, 20]
  return (
    <group>
      {archPositions.map((zPos) => {
        const color = zPos < 0 ? '#00e5ff' : '#ff2e5b'
        return (
          <group key={zPos} position={[0, 11.4, zPos]}>
            {/* Overhead dark beam */}
            <mesh>
              <boxGeometry args={[ARENA_BOUNDS.halfWidth * 2, 0.65, 0.9]} />
              <meshStandardMaterial color="#091122" metalness={0.7} roughness={0.35} />
            </mesh>
            {/* Glowing underside neon tube */}
            <mesh position={[0, -0.36, 0]}>
              <boxGeometry args={[ARENA_BOUNDS.halfWidth * 1.9, 0.12, 0.22]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3.5} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function ArenaWorld() {
  const floorTex = useMemo(() => createNeonGridTexture(), [])
  const blueGlassTex = useMemo(() => createEnergyGlassTexture('blue'), [])
  const redGlassTex = useMemo(() => createEnergyGlassTexture('red'), [])

  const players = useGameStore((s) => s.room?.players)
  const myId = useGameStore((s) => s.playerId)
  const screen = useGameStore((s) => s.screen)

  const remotePlayers = useMemo(
    () => (players ? players.filter((p) => p.id !== myId) : []),
    [players, myId],
  )

  return (
    <>
      <color attach="background" args={['#040812']} />
      <fog attach="fog" args={['#040812', 26, 78]} />

      {/* Atmospheric Arena Lighting */}
      <ambientLight intensity={0.62} color="#8ab4f8" />
      <hemisphereLight args={['#38bdf8', '#090e1a', 0.55]} />
      <directionalLight position={[12, 24, 10]} intensity={0.95} color="#dbeafe" />

      {/* Blue Base vs Red Base Team Key Lights */}
      <pointLight position={[0, 8, -24]} intensity={48} distance={42} color="#00e5ff" />
      <pointLight position={[0, 8, 24]} intensity={48} distance={42} color="#ff2e5b" />
      <pointLight position={[0, 9, 0]} intensity={35} distance={34} color="#7dd3fc" />

      {/* Glowing Tron Floor Grid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_BOUNDS.halfWidth * 2, ARENA_BOUNDS.halfLength * 2]} />
        <meshStandardMaterial
          map={floorTex}
          roughness={0.35}
          metalness={0.45}
          emissive="#003d5c"
          emissiveIntensity={0.45}
        />
      </mesh>

      {/* Blue & Red Team Spawn Zone Floor Beacons */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -26.5]}>
        <planeGeometry args={[28, 7]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.12} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 26.5]}>
        <planeGeometry args={[28, 7]} />
        <meshBasicMaterial color="#ff2e5b" transparent opacity={0.12} />
      </mesh>

      {/* All Arena Geometry (Walls, Platforms, Ramps, Pillars, Energy Glass Cover) */}
      {ARENA_BOXES.map((box) => (
        <ArenaBlock
          key={box.id}
          box={box}
          blueGlassTex={blueGlassTex}
          redGlassTex={redGlassTex}
        />
      ))}

      <OverheadNeonArches />
      <CenterMathCoreCrystal />
      <JumpPadsVisual />

      {/* Remote Players in the 3D Arena */}
      {screen === 'arena' &&
        remotePlayers.map((p) => <RivalAvatar key={p.id} player={p} />)}

      {/* 3D Laser Tracers & Valorant-Style World Skill Effects */}
      {screen === 'arena' && <EffectsLayer />}
      {screen === 'arena' && <WorldEffectsLayer />}

      {/* First-Person Weapon Viewmodel & FPS Controller */}
      <WeaponViewmodel />
      <PlayerController />
    </>
  )
}

export function ArenaScene() {
  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{ fov: 75, near: 0.06, far: 180, position: [0, 10, 26] }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <ArenaWorld />
      </Canvas>
    </div>
  )
}
