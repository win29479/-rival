import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { WorldEffect } from '../../shared/types.ts'
import { useGameStore } from '../store/useGameStore.ts'

function BarrierEffect({ effect }: { effect: WorldEffect }) {
  const b = effect.box
  if (!b) return null
  const sx = b.maxX - b.minX
  const sy = b.maxY - b.minY
  const sz = b.maxZ - b.minZ
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const cz = (b.minZ + b.maxZ) / 2

  return (
    <group position={[cx, cy, cz]}>
      {/* Main energy barrier slab */}
      <mesh>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial
          color="#10f59b"
          emissive="#10f59b"
          emissiveIntensity={1.6}
          transparent
          opacity={0.62}
          roughness={0.15}
        />
      </mesh>
      {/* Top & bottom bright neon frame bars */}
      <mesh position={[0, sy / 2 - 0.06, 0]}>
        <boxGeometry args={[sx + 0.08, 0.14, sz + 0.08]} />
        <meshStandardMaterial color="#6ee7b7" emissive="#10f59b" emissiveIntensity={3.8} />
      </mesh>
      <mesh position={[0, -sy / 2 + 0.06, 0]}>
        <boxGeometry args={[sx + 0.08, 0.12, sz + 0.08]} />
        <meshStandardMaterial color="#6ee7b7" emissive="#10f59b" emissiveIntensity={3.2} />
      </mesh>
    </group>
  )
}

function SmokeEffect({ effect }: { effect: WorldEffect }) {
  const outerRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (outerRef.current) {
      outerRef.current.rotation.y = t * 0.35
      outerRef.current.rotation.x = Math.sin(t * 0.25) * 0.15
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -t * 0.55
    }
  })

  return (
    <group position={[effect.position.x, effect.position.y, effect.position.z]}>
      {/* Dense opaque inner smoke core blocking enemy sightlines */}
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[effect.radius * 0.88, 2]} />
        <meshStandardMaterial
          color="#1e1033"
          emissive="#581c87"
          emissiveIntensity={0.85}
          transparent
          opacity={0.93}
          roughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Glowing violet cyber haze shell */}
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[effect.radius, 2]} />
        <meshBasicMaterial
          color="#a855f7"
          transparent
          opacity={0.28}
          wireframe
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function SonarEffect({ effect }: { effect: WorldEffect }) {
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const mesh = ringRef.current
    if (!mesh) return
    const nowServer = Date.now() + useGameStore.getState().clockOffsetMs
    const duration = Math.max(1, effect.expiresAt - effect.createdAt)
    const progress = Math.max(0, Math.min(1, (nowServer - effect.createdAt) / duration))
    const r = Math.max(0.5, progress * effect.radius)
    mesh.scale.set(r, r, r)
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.opacity = (1 - progress) * 0.65
  })

  return (
    <mesh
      ref={ringRef}
      position={[effect.position.x, effect.position.y, effect.position.z]}
    >
      <sphereGeometry args={[1, 24, 16]} />
      <meshBasicMaterial
        color="#fb923c"
        transparent
        opacity={0.5}
        wireframe
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

function OrbitalEffect({ effect }: { effect: WorldEffect }) {
  const beamRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const nowServer = Date.now() + useGameStore.getState().clockOffsetMs
    const detonated = Boolean(effect.detonated || (effect.detonateAt && nowServer >= effect.detonateAt))

    if (ringRef.current) {
      ringRef.current.rotation.z = clock.elapsedTime * 3.0
    }
    if (beamRef.current) {
      beamRef.current.visible = detonated
      if (detonated && effect.detonateAt) {
        const postLife = Math.max(
          0,
          1 - (nowServer - effect.detonateAt) / Math.max(1, effect.expiresAt - effect.detonateAt),
        )
        const s = 0.5 + postLife * 0.85
        beamRef.current.scale.set(s, 1, s)
        const mat = beamRef.current.material as THREE.MeshBasicMaterial
        mat.opacity = postLife * 0.85
      }
    }
  })

  return (
    <group position={[effect.position.x, 0.08, effect.position.z]}>
      {/* Ground target lock warning ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[effect.radius * 0.78, effect.radius, 36]} />
        <meshBasicMaterial
          color="#e879f9"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Towering Orbital Ion Sky-Beam */}
      <mesh ref={beamRef} position={[0, 12, 0]} visible={false}>
        <cylinderGeometry args={[effect.radius * 0.75, effect.radius * 0.9, 24, 24]} />
        <meshBasicMaterial
          color="#f0abfc"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function ExplosionEffect({ effect }: { effect: WorldEffect }) {
  const coreRef = useRef<THREE.Mesh>(null)
  const shockRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const nowServer = Date.now() + useGameStore.getState().clockOffsetMs
    const duration = Math.max(1, effect.expiresAt - effect.createdAt)
    const p = Math.max(0, Math.min(1, (nowServer - effect.createdAt) / duration))
    if (coreRef.current) {
      const s = 0.4 + Math.sin(p * Math.PI) * effect.radius * 0.75
      coreRef.current.scale.set(s, s, s)
      ;(coreRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.85
    }
    if (shockRef.current) {
      const r = 0.6 + p * effect.radius * 1.15
      shockRef.current.scale.set(r, r, 1)
      ;(shockRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.9
    }
  })

  return (
    <group position={[effect.position.x, effect.position.y, effect.position.z]}>
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 18, 14]} />
        <meshBasicMaterial
          color={effect.color}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={shockRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.75, 1.0, 28]} />
        <meshBasicMaterial
          color="#fef08a"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function FlashOrbEffect({ effect }: { effect: WorldEffect }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (!ref.current) return
    const nowServer = Date.now() + useGameStore.getState().clockOffsetMs
    const duration = Math.max(1, effect.expiresAt - effect.createdAt)
    const p = Math.max(0, Math.min(1, (nowServer - effect.createdAt) / duration))
    const s = 0.5 + p * 3.8
    ref.current.scale.set(s, s, s)
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.95
  })

  return (
    <mesh ref={ref} position={[effect.position.x, effect.position.y, effect.position.z]}>
      <octahedronGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#e0f2fe"
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

export function WorldEffectsLayer() {
  const effects = useGameStore((s) => s.room?.worldEffects)
  if (!effects || effects.length === 0) return null

  return (
    <group>
      {effects.map((eff) => {
        switch (eff.kind) {
          case 'barrier':
            return <BarrierEffect key={eff.id} effect={eff} />
          case 'smoke':
            return <SmokeEffect key={eff.id} effect={eff} />
          case 'sonar':
            return <SonarEffect key={eff.id} effect={eff} />
          case 'orbital':
            return <OrbitalEffect key={eff.id} effect={eff} />
          case 'explosion':
            return <ExplosionEffect key={eff.id} effect={eff} />
          case 'flash':
            return <FlashOrbEffect key={eff.id} effect={eff} />
        }
      })}
    </group>
  )
}
