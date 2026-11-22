import type { Team, Vec3 } from './types.ts'

export interface ArenaBox {
  id: string
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
  kind: 'wall' | 'platform' | 'pillar' | 'cover' | 'glass' | 'arch'
  accent?: 'blue' | 'red' | 'neutral'
}

export interface JumpPad {
  id: string
  x: number
  y: number
  z: number
  radius: number
  boostY: number
  accent: 'blue' | 'red' | 'neutral'
}

export const ARENA_BOUNDS = {
  halfWidth: 26, // X: -26..26 (52m wide)
  halfLength: 32, // Z: -32..32 (64m long)
  ceilingY: 16,
} as const

export const PLAYER_DIMENSIONS = {
  radius: 0.48,
  height: 1.85,
  eyeHeight: 1.56,
  headCenterY: 1.58,
  headRadius: 0.3,
  bodyMinY: 0.05,
  bodyMaxY: 1.38,
  bodyRadius: 0.44,
} as const

/**
 * Symmetric Futuristic Neon Arena:
 * - Blue Base at Z = -26 (facing +Z)
 * - Red Base at Z = +26 (facing -Z)
 * - Center elevated Math Core Platform (Y = 2.2) accessible via side ramps & jump pads
 * - Tactical energy-glass cover walls, neon pillars, and flanking lanes
 */
export const ARENA_BOXES: ArenaBox[] = [
  // Perimeter Arena Walls
  { id: 'wall-north', minX: -27, maxX: 27, minY: 0, maxY: 12, minZ: -33, maxZ: -32, kind: 'wall', accent: 'blue' },
  { id: 'wall-south', minX: -27, maxX: 27, minY: 0, maxY: 12, minZ: 32, maxZ: 33, kind: 'wall', accent: 'red' },
  { id: 'wall-west', minX: -27, maxX: -26, minY: 0, maxY: 12, minZ: -32, maxZ: 32, kind: 'wall', accent: 'neutral' },
  { id: 'wall-east', minX: 26, maxX: 27, minY: 0, maxY: 12, minZ: -32, maxZ: 32, kind: 'wall', accent: 'neutral' },

  // Central Elevated Neon Core Platform (walkable top at Y = 2.0)
  { id: 'center-deck', minX: -6.5, maxX: 6.5, minY: 0, maxY: 2.0, minZ: -5.5, maxZ: 5.5, kind: 'platform', accent: 'neutral' },
  // Stepped Ramps onto Central Deck (West & East sides)
  { id: 'ramp-w1', minX: -8.5, maxX: -6.5, minY: 0, maxY: 1.0, minZ: -3.2, maxZ: 3.2, kind: 'platform', accent: 'neutral' },
  { id: 'ramp-w2', minX: -10.5, maxX: -8.5, minY: 0, maxY: 0.48, minZ: -3.2, maxZ: 3.2, kind: 'platform', accent: 'neutral' },
  { id: 'ramp-e1', minX: 6.5, maxX: 8.5, minY: 0, maxY: 1.0, minZ: -3.2, maxZ: 3.2, kind: 'platform', accent: 'neutral' },
  { id: 'ramp-e2', minX: 8.5, maxX: 10.5, minY: 0, maxY: 0.48, minZ: -3.2, maxZ: 3.2, kind: 'platform', accent: 'neutral' },

  // Center Deck Chest-High Cover Shields (Blue & Red edges)
  { id: 'center-shield-n', minX: -3.0, maxX: 3.0, minY: 2.0, maxY: 3.3, minZ: -5.2, maxZ: -4.6, kind: 'glass', accent: 'blue' },
  { id: 'center-shield-s', minX: -3.0, maxX: 3.0, minY: 2.0, maxY: 3.3, minZ: 4.6, maxZ: 5.2, kind: 'glass', accent: 'red' },

  // Four Towering Neon Arena Pillars
  { id: 'pillar-nw', minX: -15.5, maxX: -13.0, minY: 0, maxY: 11, minZ: -14.0, maxZ: -11.5, kind: 'pillar', accent: 'blue' },
  { id: 'pillar-ne', minX: 13.0, maxX: 15.5, minY: 0, maxY: 11, minZ: -14.0, maxZ: -11.5, kind: 'pillar', accent: 'blue' },
  { id: 'pillar-sw', minX: -15.5, maxX: -13.0, minY: 0, maxY: 11, minZ: 11.5, maxZ: 14.0, kind: 'pillar', accent: 'red' },
  { id: 'pillar-se', minX: 13.0, maxX: 15.5, minY: 0, maxY: 11, minZ: 11.5, maxZ: 14.0, kind: 'pillar', accent: 'red' },

  // Blue Side Base Cover & Energy Glass Walls
  { id: 'blue-bunker-c', minX: -4.5, maxX: 4.5, minY: 0, maxY: 2.3, minZ: -18.5, maxZ: -17.3, kind: 'cover', accent: 'blue' },
  { id: 'blue-glass-l', minX: -13.0, maxX: -7.5, minY: 0, maxY: 3.2, minZ: -21.5, maxZ: -20.8, kind: 'glass', accent: 'blue' },
  { id: 'blue-glass-r', minX: 7.5, maxX: 13.0, minY: 0, maxY: 3.2, minZ: -21.5, maxZ: -20.8, kind: 'glass', accent: 'blue' },
  { id: 'blue-crate-l', minX: -20.5, maxX: -17.5, minY: 0, maxY: 2.0, minZ: -10.0, maxZ: -7.5, kind: 'cover', accent: 'blue' },
  { id: 'blue-crate-r', minX: 17.5, maxX: 20.5, minY: 0, maxY: 2.0, minZ: -10.0, maxZ: -7.5, kind: 'cover', accent: 'blue' },

  // Red Side Base Cover & Energy Glass Walls (mirror of Blue)
  { id: 'red-bunker-c', minX: -4.5, maxX: 4.5, minY: 0, maxY: 2.3, minZ: 17.3, maxZ: 18.5, kind: 'cover', accent: 'red' },
  { id: 'red-glass-l', minX: -13.0, maxX: -7.5, minY: 0, maxY: 3.2, minZ: 20.8, maxZ: 21.5, kind: 'glass', accent: 'red' },
  { id: 'red-glass-r', minX: 7.5, maxX: 13.0, minY: 0, maxY: 3.2, minZ: 20.8, maxZ: 21.5, kind: 'glass', accent: 'red' },
  { id: 'red-crate-l', minX: -20.5, maxX: -17.5, minY: 0, maxY: 2.0, minZ: 7.5, maxZ: 10.0, kind: 'cover', accent: 'red' },
  { id: 'red-crate-r', minX: 17.5, maxX: 20.5, minY: 0, maxY: 2.0, minZ: 7.5, maxZ: 10.0, kind: 'cover', accent: 'red' },

  // Side Balcony Overlooks (West & East Mid-Lane)
  { id: 'side-deck-w', minX: -25.5, maxX: -19.5, minY: 0, maxY: 3.2, minZ: -4.5, maxZ: 4.5, kind: 'platform', accent: 'neutral' },
  { id: 'side-deck-e', minX: 19.5, maxX: 25.5, minY: 0, maxY: 3.2, minZ: -4.5, maxZ: 4.5, kind: 'platform', accent: 'neutral' },
]

export const JUMP_PADS: JumpPad[] = [
  { id: 'jp-w-n', x: -16.8, y: 0.08, z: -4.2, radius: 1.5, boostY: 12.2, accent: 'blue' },
  { id: 'jp-w-s', x: -16.8, y: 0.08, z: 4.2, radius: 1.5, boostY: 12.2, accent: 'red' },
  { id: 'jp-e-n', x: 16.8, y: 0.08, z: -4.2, radius: 1.5, boostY: 12.2, accent: 'blue' },
  { id: 'jp-e-s', x: 16.8, y: 0.08, z: 4.2, radius: 1.5, boostY: 12.2, accent: 'red' },
]

export const TEAM_SPAWNS: Record<Team, Array<{ position: Vec3; yaw: number }>> = {
  blue: [
    { position: { x: -8, y: 0, z: -27 }, yaw: Math.PI },
    { position: { x: 0, y: 0, z: -28 }, yaw: Math.PI },
    { position: { x: 8, y: 0, z: -27 }, yaw: Math.PI },
    { position: { x: -16, y: 0, z: -26 }, yaw: Math.PI },
  ],
  red: [
    { position: { x: -8, y: 0, z: 27 }, yaw: 0 },
    { position: { x: 0, y: 0, z: 28 }, yaw: 0 },
    { position: { x: 8, y: 0, z: 27 }, yaw: 0 },
    { position: { x: 16, y: 0, z: 26 }, yaw: 0 },
  ],
}

export function getSpawnForTeam(team: Team, slotIndex: number): { position: Vec3; yaw: number } {
  const spawns = TEAM_SPAWNS[team]
  const pick = spawns[Math.abs(slotIndex) % spawns.length]
  return {
    position: { ...pick.position },
    yaw: pick.yaw,
  }
}

export function clampPositionToArena(pos: Vec3): Vec3 {
  const r = PLAYER_DIMENSIONS.radius
  return {
    x: Math.max(-ARENA_BOUNDS.halfWidth + r, Math.min(ARENA_BOUNDS.halfWidth - r, pos.x)),
    y: Math.max(0, Math.min(ARENA_BOUNDS.ceilingY, pos.y)),
    z: Math.max(-ARENA_BOUNDS.halfLength + r, Math.min(ARENA_BOUNDS.halfLength - r, pos.z)),
  }
}

/**
 * Resolves horizontal XZ circle-vs-AABB collisions and computes walkable ground height.
 * Allows smooth stepping up ledges <= 0.65m (ramps & stairs).
 */
export function resolvePlayerMovement(
  current: Vec3,
  desired: Vec3,
  velocityY: number,
  extraBoxes: ArenaBox[] = [],
): { position: Vec3; velocityY: number; grounded: boolean; hitJumpPad: boolean } {
  const r = PLAYER_DIMENSIONS.radius
  const stepHeight = 0.65
  let x = desired.x
  let y = desired.y
  let z = desired.z
  let vy = velocityY
  const allBoxes = extraBoxes.length > 0 ? [...ARENA_BOXES, ...extraBoxes] : ARENA_BOXES

  // 1. Resolve horizontal overlaps against boxes we cannot step onto
  for (const box of allBoxes) {
    // Only collide horizontally if player vertical body overlaps box vertical extent
    const playerBottom = current.y
    const playerTop = current.y + PLAYER_DIMENSIONS.height
    if (playerTop <= box.minY + 0.05) continue
    if (playerBottom >= box.maxY - stepHeight) continue

    const closestX = Math.max(box.minX, Math.min(x, box.maxX))
    const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ))
    const dx = x - closestX
    const dz = z - closestZ
    const distSq = dx * dx + dz * dz

    if (distSq < r * r) {
      const dist = Math.sqrt(distSq)
      if (dist > 0.0001) {
        const push = r - dist
        x += (dx / dist) * push
        z += (dz / dist) * push
      } else {
        // Inside box center fallback: push along smallest overlap axis
        const penLeft = Math.abs(x - box.minX)
        const penRight = Math.abs(box.maxX - x)
        const penBack = Math.abs(z - box.minZ)
        const penFront = Math.abs(box.maxZ - z)
        const m = Math.min(penLeft, penRight, penBack, penFront)
        if (m === penLeft) x = box.minX - r
        else if (m === penRight) x = box.maxX + r
        else if (m === penBack) z = box.minZ - r
        else z = box.maxZ + r
      }
    }
  }

  // Clamp inside arena bounds
  x = Math.max(-ARENA_BOUNDS.halfWidth + r, Math.min(ARENA_BOUNDS.halfWidth - r, x))
  z = Math.max(-ARENA_BOUNDS.halfLength + r, Math.min(ARENA_BOUNDS.halfLength - r, z))

  // 2. Find highest supporting surface under (x, z)
  let groundY = 0
  for (const box of allBoxes) {
    if (x + r * 0.75 > box.minX && x - r * 0.75 < box.maxX && z + r * 0.75 > box.minZ && z - r * 0.75 < box.maxZ) {
      if (current.y + stepHeight >= box.maxY && box.maxY > groundY) {
        groundY = box.maxY
      }
    }
  }

  let grounded = false
  if (y <= groundY) {
    y = groundY
    if (vy < 0) vy = 0
    grounded = true
  }

  // 3. Jump pad boost check
  let hitJumpPad = false
  if (y <= 0.35) {
    for (const pad of JUMP_PADS) {
      const dx = x - pad.x
      const dz = z - pad.z
      if (dx * dx + dz * dz <= pad.radius * pad.radius) {
        vy = pad.boostY
        grounded = false
        hitJumpPad = true
        break
      }
    }
  }

  return { position: { x, y, z }, velocityY: vy, grounded, hitJumpPad }
}

/** Ray vs AABB intersection (slab method). Returns distance t >= 0 or null. */
export function rayIntersectsBox(origin: Vec3, dir: Vec3, box: ArenaBox, maxDist: number): number | null {
  let tmin = 0
  let tmax = maxDist

  const axes: Array<[number, number, number, number]> = [
    [origin.x, dir.x, box.minX, box.maxX],
    [origin.y, dir.y, box.minY, box.maxY],
    [origin.z, dir.z, box.minZ, box.maxZ],
  ]

  for (const [o, d, bmin, bmax] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < bmin || o > bmax) return null
    } else {
      let t1 = (bmin - o) / d
      let t2 = (bmax - o) / d
      if (t1 > t2) {
        const tmp = t1
        t1 = t2
        t2 = tmp
      }
      tmin = Math.max(tmin, t1)
      tmax = Math.min(tmax, t2)
      if (tmin > tmax) return null
    }
  }

  return tmin >= 0 && tmin <= maxDist ? tmin : null
}

/** Finds closest obstacle distance along a ray (walls, floors, cover, dynamic barrier walls). */
export function raycastArenaObstacles(
  origin: Vec3,
  dir: Vec3,
  maxDist: number,
  extraBoxes: ArenaBox[] = [],
): number {
  let closest = maxDist

  // Floor plane (y = 0)
  if (dir.y < -1e-6 && origin.y > 0) {
    const tFloor = -origin.y / dir.y
    if (tFloor >= 0 && tFloor < closest) {
      closest = tFloor
    }
  }

  for (const box of ARENA_BOXES) {
    const t = rayIntersectsBox(origin, dir, box, closest)
    if (t !== null && t < closest) {
      closest = t
    }
  }

  for (const box of extraBoxes) {
    const t = rayIntersectsBox(origin, dir, box, closest)
    if (t !== null && t < closest) {
      closest = t
    }
  }

  return closest
}

/** Ray vs Sphere intersection. Returns closest positive t or null. */
export function rayIntersectsSphere(
  origin: Vec3,
  dir: Vec3,
  center: Vec3,
  radius: number,
  maxDist: number,
): number | null {
  const ocX = origin.x - center.x
  const ocY = origin.y - center.y
  const ocZ = origin.z - center.z
  const b = ocX * dir.x + ocY * dir.y + ocZ * dir.z
  const c = ocX * ocX + ocY * ocY + ocZ * ocZ - radius * radius
  const disc = b * b - c
  if (disc < 0) return null
  const sqrtD = Math.sqrt(disc)
  const t = -b - sqrtD
  if (t >= 0 && t <= maxDist) return t
  const t2 = -b + sqrtD
  if (t2 >= 0 && t2 <= maxDist) return t2
  return null
}

/**
 * Ray vs vertical player hitbox (separate Head sphere + Body bounding cylinder/box)
 * Used server-side for authoritative headshot & bodyshot hit detection.
 */
export function raycastPlayerHitbox(
  origin: Vec3,
  dir: Vec3,
  targetPos: Vec3,
  maxDist: number,
): { distance: number; headshot: boolean } | null {
  // 1. Check Head Sphere (slightly generous for smooth online FPS feel)
  const headCenter: Vec3 = {
    x: targetPos.x,
    y: targetPos.y + PLAYER_DIMENSIONS.headCenterY,
    z: targetPos.z,
  }
  const headT = rayIntersectsSphere(origin, dir, headCenter, PLAYER_DIMENSIONS.headRadius + 0.06, maxDist)

  // 2. Check Body AABB
  const r = PLAYER_DIMENSIONS.bodyRadius + 0.08
  const bodyBox: ArenaBox = {
    id: 'body',
    minX: targetPos.x - r,
    maxX: targetPos.x + r,
    minY: targetPos.y + PLAYER_DIMENSIONS.bodyMinY,
    maxY: targetPos.y + PLAYER_DIMENSIONS.bodyMaxY,
    minZ: targetPos.z - r,
    maxZ: targetPos.z + r,
    kind: 'cover',
  }
  const bodyT = rayIntersectsBox(origin, dir, bodyBox, maxDist)

  if (headT !== null && (bodyT === null || headT <= bodyT + 0.15)) {
    return { distance: headT, headshot: true }
  }
  if (bodyT !== null) {
    return { distance: bodyT, headshot: false }
  }
  return null
}

export function normalizeVec3(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z)
  if (len < 1e-8) return { x: 0, y: 0, z: -1 }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}
