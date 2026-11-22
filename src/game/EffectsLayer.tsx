import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Vec3, WeaponId } from '../../shared/types.ts'
import { WEAPONS } from '../../shared/weapons.ts'
import { useGameStore } from '../store/useGameStore.ts'

interface BeamSegmentProps {
  origin: Vec3
  target: Vec3
  color: string
  thickness: number
  createdAt: number
}

function BeamSegment({ origin, target, color, thickness, createdAt }: BeamSegmentProps) {
  const beamRef = useRef<THREE.Mesh>(null)
  const sparkRef = useRef<THREE.Mesh>(null)

  const { midpoint, length, quaternion } = useMemo(() => {
    const start = new THREE.Vector3(origin.x, origin.y, origin.z)
    const end = new THREE.Vector3(target.x, target.y, target.z)
    const diff = new THREE.Vector3().subVectors(end, start)
    const len = Math.max(0.05, diff.length())
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      diff.clone().normalize(),
    )
    return { midpoint: mid, length: len, quaternion: q }
  }, [origin, target])

  useFrame(() => {
    const age = performance.now() - createdAt
    const life = Math.max(0, 1 - age / 210)
    if (beamRef.current) {
      beamRef.current.visible = life > 0
      const mat = beamRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = life * 0.92
      beamRef.current.scale.set(life, 1, life)
    }
    if (sparkRef.current) {
      sparkRef.current.visible = life > 0.15
      const s = 0.4 + (1 - life) * 1.4
      sparkRef.current.scale.set(s, s, s)
      const mat = sparkRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = life * 0.85
    }
  })

  return (
    <group>
      <mesh ref={beamRef} position={midpoint} quaternion={quaternion}>
        <cylinderGeometry args={[thickness, thickness, length, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={sparkRef} position={[target.x, target.y, target.z]}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  )
}

function beamThickness(weapon: WeaponId): number {
  switch (weapon) {
    case 'sniper':
      return 0.052
    case 'revolver':
      return 0.036
    case 'lmg':
      return 0.032
    case 'rifle':
    case 'burst':
      return 0.028
    case 'pistol':
      return 0.024
    case 'shotgun':
    case 'smg':
      return 0.02
  }
}

export function EffectsLayer() {
  const tracers = useGameStore((s) => s.tracers)

  return (
    <group>
      {tracers.map((t) => {
        const color =
          t.weapon === 'sniper' ||
          t.weapon === 'revolver' ||
          t.weapon === 'lmg' ||
          t.weapon === 'burst'
            ? WEAPONS[t.weapon].accentColor
            : t.shooterTeam === 'blue'
              ? '#00f0ff'
              : '#ff2e5b'
        const thickness = beamThickness(t.weapon)
        return t.endpoints.map((ep, idx) => (
          <BeamSegment
            key={`${t.id}-${idx}`}
            origin={t.origin}
            target={ep}
            color={color}
            thickness={thickness}
            createdAt={t.createdAt}
          />
        ))
      })}
    </group>
  )
}
