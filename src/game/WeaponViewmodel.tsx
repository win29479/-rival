import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { WeaponId } from '../../shared/types.ts'
import { WEAPONS } from '../../shared/weapons.ts'
import { selectMyPlayer, useGameStore } from '../store/useGameStore.ts'

function PistolMesh({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, 0.02, -0.1]}>
        <boxGeometry args={[0.068, 0.072, 0.34]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh position={[0, -0.025, -0.07]}>
        <boxGeometry args={[0.056, 0.05, 0.28]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.095, 0.04]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.05, 0.13, 0.075]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>
      <mesh position={[0.037, 0.025, -0.12]}>
        <boxGeometry args={[0.008, 0.016, 0.28]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.2} />
      </mesh>
      <mesh position={[-0.037, 0.025, -0.12]}>
        <boxGeometry args={[0.008, 0.016, 0.28]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.2} />
      </mesh>
      <mesh position={[0, 0.022, -0.275]}>
        <boxGeometry args={[0.036, 0.034, 0.02]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={4} />
      </mesh>
    </group>
  )
}

function RevolverMesh({ accent }: { accent: string }) {
  return (
    <group>
      {/* Heavy elongated magnum barrel */}
      <mesh position={[0, 0.045, -0.22]}>
        <boxGeometry args={[0.054, 0.064, 0.38]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.78} roughness={0.22} />
      </mesh>
      {/* Gold/amber energy top rib */}
      <mesh position={[0, 0.082, -0.22]}>
        <boxGeometry args={[0.024, 0.014, 0.36]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.4} />
      </mesh>
      {/* Iconic spinning cylinder drum */}
      <mesh position={[0, 0.01, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.048, 0.048, 0.11, 10]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Glowing energy chambers around cylinder */}
      <mesh position={[0, 0.01, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.051, 0.051, 0.025, 10]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.6} />
      </mesh>
      {/* Angled ergonomic hand-cannon grip */}
      <mesh position={[0, -0.095, 0.045]} rotation={[0.32, 0, 0]}>
        <boxGeometry args={[0.05, 0.145, 0.072]} />
        <meshStandardMaterial color="#0f172a" roughness={0.55} />
      </mesh>
    </group>
  )
}

function SmgMesh({ accent }: { accent: string }) {
  return (
    <group>
      {/* Compact bullpup SMG chassis */}
      <mesh position={[0, 0.015, -0.13]}>
        <boxGeometry args={[0.074, 0.09, 0.38]} />
        <meshStandardMaterial color="#1e293b" metalness={0.65} roughness={0.3} />
      </mesh>
      {/* Integrated glowing suppressor tube */}
      <mesh position={[0, 0.025, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.026, 0.22, 12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Suppressor neon collar */}
      <mesh position={[0, 0.025, -0.34]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.024, 12]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.8} />
      </mesh>
      {/* Extended slanted SMG stick mag */}
      <mesh position={[0, -0.1, -0.19]} rotation={[-0.22, 0, 0]}>
        <boxGeometry args={[0.036, 0.18, 0.048]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Teal speed stripes */}
      <mesh position={[0.04, 0.03, -0.15]}>
        <boxGeometry args={[0.008, 0.018, 0.32]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.6} />
      </mesh>
      <mesh position={[-0.04, 0.03, -0.15]}>
        <boxGeometry args={[0.008, 0.018, 0.32]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.6} />
      </mesh>
    </group>
  )
}

function RifleMesh({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, 0.01, -0.16]}>
        <boxGeometry args={[0.078, 0.095, 0.54]} />
        <meshStandardMaterial color="#1e293b" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.052, -0.18]}>
        <boxGeometry args={[0.064, 0.036, 0.48]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.45} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.022, -0.49]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.022, 0.24, 12]} />
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.098, -0.08]}>
        <boxGeometry args={[0.05, 0.048, 0.085]} />
        <meshStandardMaterial color="#0b1120" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.1, -0.08]}>
        <boxGeometry args={[0.036, 0.032, 0.01]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.8} transparent opacity={0.5} />
      </mesh>
      <mesh position={[0.041, 0.02, -0.22]}>
        <boxGeometry args={[0.008, 0.018, 0.4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.5} />
      </mesh>
      <mesh position={[-0.041, 0.02, -0.22]}>
        <boxGeometry args={[0.008, 0.018, 0.4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.5} />
      </mesh>
      <mesh position={[0, -0.09, -0.16]} rotation={[0.16, 0, 0]}>
        <boxGeometry args={[0.046, 0.14, 0.072]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  )
}

function BurstMesh({ accent }: { accent: string }) {
  return (
    <group>
      {/* Bullpup futuristic frame */}
      <mesh position={[0, 0.015, -0.15]}>
        <boxGeometry args={[0.084, 0.105, 0.52]} />
        <meshStandardMaterial color="#1e1b4b" metalness={0.65} roughness={0.28} />
      </mesh>
      {/* White angled carry-handle optic bridge */}
      <mesh position={[0, 0.095, -0.14]}>
        <boxGeometry args={[0.048, 0.04, 0.34]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.55} roughness={0.25} />
      </mesh>
      {/* Triple pulse emitter barrel tips */}
      <mesh position={[0, 0.02, -0.45]}>
        <boxGeometry args={[0.068, 0.046, 0.14]} />
        <meshStandardMaterial color="#312e81" metalness={0.75} roughness={0.25} />
      </mesh>
      {[-0.02, 0, 0.02].map((ox, idx) => (
        <mesh key={idx} position={[ox, 0.02, -0.525]}>
          <boxGeometry args={[0.012, 0.024, 0.02]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={4.2} />
        </mesh>
      ))}
      <mesh position={[0.045, 0.02, -0.2]}>
        <boxGeometry args={[0.008, 0.022, 0.38]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.6} />
      </mesh>
      <mesh position={[-0.045, 0.02, -0.2]}>
        <boxGeometry args={[0.008, 0.022, 0.38]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.6} />
      </mesh>
    </group>
  )
}

function ShotgunMesh({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, 0.01, -0.18]}>
        <boxGeometry args={[0.105, 0.11, 0.48]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.065, -0.2]}>
        <boxGeometry args={[0.09, 0.03, 0.42]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.28} />
      </mesh>
      <mesh position={[-0.026, 0.025, -0.46]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.024, 0.22, 12]} />
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0.026, 0.025, -0.46]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.024, 0.22, 12]} />
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.052, -0.32]}>
        <boxGeometry args={[0.088, 0.048, 0.22]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>
      <mesh position={[0.055, 0.015, -0.26]}>
        <boxGeometry args={[0.012, 0.026, 0.34]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.8} />
      </mesh>
      <mesh position={[-0.055, 0.015, -0.26]}>
        <boxGeometry args={[0.012, 0.026, 0.34]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.8} />
      </mesh>
    </group>
  )
}

function LmgMesh({ accent }: { accent: string }) {
  return (
    <group>
      {/* Massive Odin heavy chassis */}
      <mesh position={[0, 0.01, -0.2]}>
        <boxGeometry args={[0.125, 0.125, 0.56]} />
        <meshStandardMaterial color="#1e1b33" metalness={0.72} roughness={0.3} />
      </mesh>
      {/* Massive glowing drum ammo box underneath */}
      <mesh position={[0, -0.095, -0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.068, 0.068, 0.14, 14]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.095, -0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.072, 0.072, 0.032, 14]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.4} />
      </mesh>
      {/* Quad rotary plasma barrels */}
      {[
        [-0.028, 0.035],
        [0.028, 0.035],
        [-0.028, -0.01],
        [0.028, -0.01],
      ].map(([bx, by], idx) => (
        <mesh key={idx} position={[bx, by, -0.58]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.34, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
        </mesh>
      ))}
      {/* Barrel stabilizer glow ring */}
      <mesh position={[0, 0.012, -0.64]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.056, 0.056, 0.03, 12]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.8} />
      </mesh>
    </group>
  )
}

function SniperMesh({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, 0.01, -0.22]}>
        <boxGeometry args={[0.068, 0.085, 0.62]} />
        <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.042, -0.62]}>
        <boxGeometry args={[0.028, 0.022, 0.5]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.6} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.01, -0.62]}>
        <boxGeometry args={[0.028, 0.022, 0.5]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.6} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.016, -0.58]}>
        <boxGeometry args={[0.016, 0.018, 0.56]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={4.5} />
      </mesh>
      <mesh position={[0, 0.095, -0.14]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.026, 0.022, 0.28, 14]} />
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.095, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.018, 14]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.5} />
      </mesh>
    </group>
  )
}

function getMuzzleZ(weapon: WeaponId): number {
  switch (weapon) {
    case 'sniper':
      return -0.9
    case 'lmg':
      return -0.78
    case 'rifle':
    case 'shotgun':
      return -0.62
    case 'burst':
      return -0.56
    case 'smg':
      return -0.54
    case 'revolver':
      return -0.44
    case 'pistol':
      return -0.31
  }
}

export function WeaponViewmodel() {
  const { camera } = useThree()
  const rootRef = useRef<THREE.Group>(null)
  const weaponPivotRef = useRef<THREE.Group>(null)
  const muzzleRef = useRef<THREE.Mesh>(null)
  const bobPhaseRef = useRef(0)
  const prevPosRef = useRef(new THREE.Vector3())
  const adsLerpRef = useRef(0)

  const weapon: WeaponId | null = useGameStore((s) => selectMyPlayer(s)?.weapon ?? null)
  const alive = useGameStore((s) => selectMyPlayer(s)?.alive ?? false)
  const phase = useGameStore((s) => s.room?.phase ?? 'lobby')
  const isAdsZoom = useGameStore((s) => s.isAdsZoom)

  useFrame((_, rawDelta) => {
    const root = rootRef.current
    const pivot = weaponPivotRef.current
    if (!root || !pivot) return

    const dt = Math.min(rawDelta, 0.05)
    const state = useGameStore.getState()
    const me = selectMyPlayer(state)

    const hideForScope = state.isAdsZoom && me?.weapon === 'sniper'
    root.visible = Boolean(me?.weapon && me.alive && state.room?.phase === 'playing' && !hideForScope)
    if (!root.visible) return

    root.position.copy(camera.position)
    root.quaternion.copy(camera.quaternion)

    const moveDist = Math.hypot(
      camera.position.x - prevPosRef.current.x,
      camera.position.z - prevPosRef.current.z,
    )
    prevPosRef.current.copy(camera.position)
    const speedNorm = Math.min(1, moveDist / Math.max(0.001, dt * 8))
    bobPhaseRef.current += dt * (4 + speedNorm * 8)

    const targetAds = state.isAdsZoom ? 1 : 0
    adsLerpRef.current += (targetAds - adsLerpRef.current) * Math.min(1, dt * 14)

    const msSinceShot = performance.now() - state.lastShotVisualAt
    const recoil = msSinceShot < 160 ? Math.pow(1 - msSinceShot / 160, 2) : 0

    const nowServer = Date.now() + state.clockOffsetMs
    const isReloading = Boolean(me?.reloadingUntil && nowServer < me.reloadingUntil)
    const reloadTilt = isReloading ? -0.58 : 0
    const reloadDrop = isReloading ? -0.1 : 0

    const baseX = THREE.MathUtils.lerp(0.24, 0.0, adsLerpRef.current)
    const baseY = THREE.MathUtils.lerp(-0.21, -0.145, adsLerpRef.current)
    const baseZ = THREE.MathUtils.lerp(-0.38, -0.32, adsLerpRef.current)

    const bobX = Math.cos(bobPhaseRef.current) * 0.008 * speedNorm * (1 - adsLerpRef.current * 0.8)
    const bobY = Math.abs(Math.sin(bobPhaseRef.current)) * 0.01 * speedNorm * (1 - adsLerpRef.current * 0.8)

    pivot.position.set(baseX + bobX, baseY - bobY + reloadDrop + recoil * 0.018, baseZ + recoil * 0.075)
    pivot.rotation.set(recoil * 0.16 + reloadTilt, isReloading ? 0.35 : 0, isReloading ? -0.25 : 0)

    if (muzzleRef.current) {
      const flashVisible = msSinceShot < 65
      muzzleRef.current.visible = flashVisible
      if (flashVisible) {
        const s = 0.8 + (1 - msSinceShot / 65) * 0.7
        muzzleRef.current.scale.set(s, s, s)
        muzzleRef.current.rotation.z = msSinceShot * 0.25
      }
    }
  })

  if (!weapon || !alive || phase !== 'playing') return null
  const spec = WEAPONS[weapon]
  const muzzleZ = getMuzzleZ(weapon)

  return (
    <group ref={rootRef} visible={!isAdsZoom || weapon !== 'sniper'}>
      <pointLight position={[0.15, 0.25, -0.15]} intensity={2.0} distance={2.8} color="#dbeafe" />
      <group ref={weaponPivotRef}>
        {weapon === 'pistol' && <PistolMesh accent={spec.accentColor} />}
        {weapon === 'revolver' && <RevolverMesh accent={spec.accentColor} />}
        {weapon === 'smg' && <SmgMesh accent={spec.accentColor} />}
        {weapon === 'rifle' && <RifleMesh accent={spec.accentColor} />}
        {weapon === 'burst' && <BurstMesh accent={spec.accentColor} />}
        {weapon === 'shotgun' && <ShotgunMesh accent={spec.accentColor} />}
        {weapon === 'lmg' && <LmgMesh accent={spec.accentColor} />}
        {weapon === 'sniper' && <SniperMesh accent={spec.accentColor} />}

        <mesh ref={muzzleRef} position={[0, 0.025, muzzleZ]} visible={false}>
          <octahedronGeometry args={[0.078, 0]} />
          <meshBasicMaterial color={spec.accentColor} transparent opacity={0.92} />
        </mesh>
      </group>
    </group>
  )
}
