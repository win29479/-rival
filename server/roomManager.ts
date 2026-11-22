import crypto from 'node:crypto'
import { AGENT_IDS, AGENTS, ULT_MAX_POINTS } from '../shared/agents.ts'
import {
  clampPositionToArena,
  getSpawnForTeam,
  normalizeVec3,
  PLAYER_DIMENSIONS,
  raycastArenaObstacles,
  raycastPlayerHitbox,
  type ArenaBox,
} from '../shared/arena.ts'
import { pickNextQuestion, QUESTION_BY_ID, toPublicQuestion } from '../shared/questions.ts'
import {
  MATCH_CONFIG,
  SCORING,
  type AgentId,
  type AnswerResultPayload,
  type DamageTakenPayload,
  type Difficulty,
  type HitConfirmPayload,
  type KillFeedItem,
  type MatchPhase,
  type MatchSummary,
  type PlayerPublicState,
  type PublicMathQuestion,
  type RoomSnapshot,
  type ScoreboardEntry,
  type ShotEvent,
  type SkillCastPayload,
  type SkillSlot,
  type Team,
  type Vec3,
  type WeaponId,
  type WorldEffect,
} from '../shared/types.ts'
import { rollRandomWeapon, WEAPONS } from '../shared/weapons.ts'

export interface InternalPlayer extends PlayerPublicState {
  sessionToken: string
  lastShotAt: number
  lastMoveAt: number
  activeQuestionId: string | null
  attemptedQuestionIds: Set<string>
  disconnectedAt: number | null
}

export interface InternalRoom {
  roomCode: string
  hostId: string
  phase: MatchPhase
  createdAt: number
  countdownEndsAt: number | null
  matchStartedAt: number | null
  matchEndsAt: number | null
  players: Map<string, InternalPlayer>
  killFeed: KillFeedItem[]
  worldEffects: WorldEffect[]
  summary: MatchSummary | null
  spawnCounter: { blue: number; red: number }
}

export interface CombatHitRecord {
  victimId: string
  confirm: HitConfirmPayload
  damageTaken: DamageTakenPayload
  killEvent?: KillFeedItem
}

export interface ShootOutcome {
  shot: ShotEvent
  hits: CombatHitRecord[]
}

export interface SkillOutcome {
  cast: SkillCastPayload
  hits: CombatHitRecord[]
  scoreboardChanged: boolean
  roomStateChanged: boolean
}

export interface TickTransition {
  roomCode: string
  type:
    | 'PHASE_PLAYING'
    | 'RESPAWNED'
    | 'RELOADED'
    | 'EFFECTS_UPDATED'
    | 'ORBITAL_DETONATED'
    | 'MATCH_FINISHED'
    | 'ROOM_CLEANED'
  summary?: MatchSummary
  hits?: CombatHitRecord[]
  attackerId?: string
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateRoomCode(existing: Map<string, InternalRoom>): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = ''
    const bytes = crypto.randomBytes(6)
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
    }
    if (!existing.has(code)) return code
  }
  return `M${Date.now().toString(36).slice(-5).toUpperCase()}`
}

function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/[^\p{L}\p{N}_\-\s]/gu, '').trim().slice(0, 18)
  return cleaned.length >= 2 ? cleaned : `Rival_${crypto.randomBytes(2).toString('hex').toUpperCase()}`
}

function isFiniteVec3(v: Vec3 | undefined | null): v is Vec3 {
  return (
    Boolean(v) &&
    Number.isFinite(v!.x) &&
    Number.isFinite(v!.y) &&
    Number.isFinite(v!.z)
  )
}

export class RoomManager {
  private readonly rooms = new Map<string, InternalRoom>()
  private readonly nowFn: () => number
  private readonly rngFn: () => number

  constructor(nowFn: () => number = () => Date.now(), rngFn: () => number = Math.random) {
    this.nowFn = nowFn
    this.rngFn = rngFn
  }

  getRoomCount(): number {
    return this.rooms.size
  }

  getTotalConnectedPlayers(): number {
    let total = 0
    for (const room of this.rooms.values()) {
      for (const p of room.players.values()) {
        if (p.connected) total++
      }
    }
    return total
  }

  getAllRoomCodes(): string[] {
    return Array.from(this.rooms.keys())
  }

  getRoom(roomCode: string): InternalRoom | undefined {
    return this.rooms.get(roomCode.trim().toUpperCase())
  }

  private getActiveBarrierBoxes(room: InternalRoom, now: number): ArenaBox[] {
    const boxes: ArenaBox[] = []
    for (const eff of room.worldEffects) {
      if (eff.kind === 'barrier' && eff.box && eff.expiresAt > now) {
        boxes.push({
          id: eff.id,
          minX: eff.box.minX,
          maxX: eff.box.maxX,
          minY: eff.box.minY,
          maxY: eff.box.maxY,
          minZ: eff.box.minZ,
          maxZ: eff.box.maxZ,
          kind: 'glass',
          accent: eff.ownerTeam,
        })
      }
    }
    return boxes
  }

  private applyDamageAndKill(
    room: InternalRoom,
    attacker: InternalPlayer,
    victim: InternalPlayer,
    damage: number,
    headshot: boolean,
    sourceWeapon: WeaponId | 'skill',
    now: number,
    skillLabel?: string,
  ): CombatHitRecord {
    victim.hp = Math.max(0, victim.hp - damage)
    const killed = victim.hp <= 0
    let pointsAwarded = 0
    let killEvent: KillFeedItem | undefined

    if (killed) {
      victim.alive = false
      victim.respawnAt = now + MATCH_CONFIG.RESPAWN_MS
      victim.deaths += 1
      victim.streak = 0
      victim.weapon = null
      victim.ammo = 0
      victim.maxAmmo = 0
      victim.reloadingUntil = null
      victim.maxHp = MATCH_CONFIG.MAX_HP
      victim.overshieldUntil = null
      victim.overdriveUntil = null
      victim.blindedUntil = null

      attacker.kills += 1
      attacker.streak += 1
      attacker.ultPoints = Math.min(ULT_MAX_POINTS, attacker.ultPoints + 1)
      if (headshot) attacker.headshots += 1
      pointsAwarded = SCORING.KILL + (headshot ? SCORING.HEADSHOT_BONUS : 0)
      attacker.totalScore += pointsAwarded

      killEvent = {
        id: crypto.randomUUID(),
        killerId: attacker.id,
        killerName: attacker.name,
        killerTeam: attacker.team,
        victimId: victim.id,
        victimName: victim.name,
        victimTeam: victim.team,
        weapon: sourceWeapon,
        skillLabel,
        headshot,
        pointsAwarded,
        timestamp: now,
      }
      room.killFeed.unshift(killEvent)
      if (room.killFeed.length > 8) room.killFeed.pop()
    }

    return {
      victimId: victim.id,
      confirm: {
        victimId: victim.id,
        victimName: victim.name,
        damage,
        headshot,
        killed,
        pointsAwarded,
      },
      damageTaken: {
        attackerId: attacker.id,
        attackerName: attacker.name,
        weapon: sourceWeapon,
        damage,
        headshot,
        remainingHp: victim.hp,
        killed,
      },
      killEvent,
    }
  }

  createRoom(playerName: string): {
    roomCode: string
    playerId: string
    sessionToken: string
    snapshot: RoomSnapshot
  } {
    const now = this.nowFn()
    const roomCode = generateRoomCode(this.rooms)
    const playerId = crypto.randomUUID()
    const sessionToken = crypto.randomBytes(24).toString('hex')
    const spawn = getSpawnForTeam('blue', 0)

    const host: InternalPlayer = {
      id: playerId,
      sessionToken,
      name: sanitizeName(playerName),
      team: 'blue',
      agent: 'vortex',
      ready: true,
      connected: true,
      isHost: true,
      position: spawn.position,
      yaw: spawn.yaw,
      pitch: 0,
      hp: MATCH_CONFIG.MAX_HP,
      maxHp: MATCH_CONFIG.MAX_HP,
      alive: true,
      respawnAt: null,
      weapon: null,
      ammo: 0,
      maxAmmo: 0,
      reloadingUntil: null,
      skillQReadyAt: 0,
      skillCReadyAt: 0,
      ultPoints: 0,
      ultMax: ULT_MAX_POINTS,
      overdriveUntil: null,
      overshieldUntil: null,
      blindedUntil: null,
      revealedUntil: null,
      kills: 0,
      deaths: 0,
      headshots: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      totalScore: 0,
      streak: 0,
      lastShotAt: 0,
      lastMoveAt: now,
      activeQuestionId: null,
      attemptedQuestionIds: new Set<string>(),
      disconnectedAt: null,
    }

    const room: InternalRoom = {
      roomCode,
      hostId: playerId,
      phase: 'lobby',
      createdAt: now,
      countdownEndsAt: null,
      matchStartedAt: null,
      matchEndsAt: null,
      players: new Map([[playerId, host]]),
      killFeed: [],
      worldEffects: [],
      summary: null,
      spawnCounter: { blue: 1, red: 0 },
    }

    this.rooms.set(roomCode, room)
    return {
      roomCode,
      playerId,
      sessionToken,
      snapshot: this.buildSnapshot(room),
    }
  }

  joinRoom(
    rawRoomCode: string,
    playerName: string,
  ):
    | { ok: true; roomCode: string; playerId: string; sessionToken: string; snapshot: RoomSnapshot }
    | { ok: false; code: string; message: string } {
    const roomCode = rawRoomCode.trim().toUpperCase()
    const room = this.rooms.get(roomCode)
    if (!room) {
      return { ok: false, code: 'ROOM_NOT_FOUND', message: `ไม่พบห้องรหัส "${roomCode}"` }
    }
    if (room.players.size >= MATCH_CONFIG.MAX_PLAYERS) {
      return { ok: false, code: 'ROOM_FULL', message: 'ห้องเต็มแล้ว (สูงสุด 8 คน)' }
    }
    if (room.phase === 'finished') {
      return { ok: false, code: 'MATCH_FINISHED', message: 'เกมในห้องนี้จบลงแล้ว กรุณารอห้องรีเซ็ตหรือสร้างห้องใหม่' }
    }

    let blueCount = 0
    let redCount = 0
    for (const p of room.players.values()) {
      if (p.team === 'blue') blueCount++
      else redCount++
    }
    const team: Team = blueCount <= redCount ? 'blue' : 'red'
    const spawn = getSpawnForTeam(team, room.spawnCounter[team]++)
    const defaultAgent = AGENT_IDS[room.players.size % AGENT_IDS.length]

    const now = this.nowFn()
    const playerId = crypto.randomUUID()
    const sessionToken = crypto.randomBytes(24).toString('hex')

    const player: InternalPlayer = {
      id: playerId,
      sessionToken,
      name: sanitizeName(playerName),
      team,
      agent: defaultAgent,
      ready: false,
      connected: true,
      isHost: false,
      position: spawn.position,
      yaw: spawn.yaw,
      pitch: 0,
      hp: MATCH_CONFIG.MAX_HP,
      maxHp: MATCH_CONFIG.MAX_HP,
      alive: true,
      respawnAt: null,
      weapon: null,
      ammo: 0,
      maxAmmo: 0,
      reloadingUntil: null,
      skillQReadyAt: 0,
      skillCReadyAt: 0,
      ultPoints: 0,
      ultMax: ULT_MAX_POINTS,
      overdriveUntil: null,
      overshieldUntil: null,
      blindedUntil: null,
      revealedUntil: null,
      kills: 0,
      deaths: 0,
      headshots: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      totalScore: 0,
      streak: 0,
      lastShotAt: 0,
      lastMoveAt: now,
      activeQuestionId: null,
      attemptedQuestionIds: new Set<string>(),
      disconnectedAt: null,
    }

    room.players.set(playerId, player)
    return {
      ok: true,
      roomCode,
      playerId,
      sessionToken,
      snapshot: this.buildSnapshot(room),
    }
  }

  reconnectPlayer(
    rawRoomCode: string,
    playerId: string,
    sessionToken: string,
  ):
    | { ok: true; roomCode: string; snapshot: RoomSnapshot }
    | { ok: false; code: string; message: string } {
    const roomCode = rawRoomCode.trim().toUpperCase()
    const room = this.rooms.get(roomCode)
    if (!room) {
      return { ok: false, code: 'ROOM_NOT_FOUND', message: 'ห้องหมดอายุหรือไม่พบในระบบแล้ว' }
    }
    const player = room.players.get(playerId)
    if (!player) {
      return { ok: false, code: 'PLAYER_NOT_FOUND', message: 'ไม่พบข้อมูลผู้เล่นในห้องนี้' }
    }
    const a = Buffer.from(player.sessionToken)
    const b = Buffer.from(sessionToken || '')
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, code: 'UNAUTHORIZED', message: 'Session token ไม่ถูกต้อง' }
    }

    player.connected = true
    player.disconnectedAt = null
    return {
      ok: true,
      roomCode,
      snapshot: this.buildSnapshot(room),
    }
  }

  markDisconnected(roomCode: string, playerId: string, permanentLeave = false): RoomSnapshot | null {
    const room = this.rooms.get(roomCode)
    if (!room) return null
    const player = room.players.get(playerId)
    if (!player) return null

    if (permanentLeave || room.phase === 'lobby') {
      room.players.delete(playerId)
    } else {
      player.connected = false
      player.disconnectedAt = this.nowFn()
    }

    if (room.hostId === playerId) {
      const nextHost = Array.from(room.players.values()).find((p) => p.connected)
      if (nextHost) {
        room.hostId = nextHost.id
        for (const p of room.players.values()) {
          p.isHost = p.id === nextHost.id
        }
      }
    }

    const anyConnected = Array.from(room.players.values()).some((p) => p.connected)
    if (room.players.size === 0 || (!anyConnected && room.phase === 'lobby')) {
      this.rooms.delete(roomCode)
      return null
    }

    return this.buildSnapshot(room)
  }

  setReady(
    roomCode: string,
    playerId: string,
    ready: boolean,
  ): { ok: true; snapshot: RoomSnapshot } | { ok: false; code: string; message: string } {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND', message: 'ไม่พบห้อง' }
    if (room.phase !== 'lobby') {
      return { ok: false, code: 'INVALID_PHASE', message: 'เปลี่ยนสถานะ Ready ได้เฉพาะใน Lobby เท่านั้น' }
    }
    const player = room.players.get(playerId)
    if (!player) return { ok: false, code: 'PLAYER_NOT_FOUND', message: 'ไม่พบผู้เล่น' }

    player.ready = Boolean(ready)
    return { ok: true, snapshot: this.buildSnapshot(room) }
  }

  switchTeam(
    roomCode: string,
    playerId: string,
    targetTeam: Team,
  ): { ok: true; snapshot: RoomSnapshot } | { ok: false; code: string; message: string } {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND', message: 'ไม่พบห้อง' }
    if (room.phase !== 'lobby') {
      return { ok: false, code: 'INVALID_PHASE', message: 'เปลี่ยนทีมได้เฉพาะใน Lobby เท่านั้น' }
    }
    if (targetTeam !== 'blue' && targetTeam !== 'red') {
      return { ok: false, code: 'INVALID_TEAM', message: 'ทีมไม่ถูกต้อง' }
    }
    const player = room.players.get(playerId)
    if (!player) return { ok: false, code: 'PLAYER_NOT_FOUND', message: 'ไม่พบผู้เล่น' }
    if (player.team === targetTeam) {
      return { ok: true, snapshot: this.buildSnapshot(room) }
    }

    const teamCount = Array.from(room.players.values()).filter((p) => p.team === targetTeam).length
    if (teamCount >= MATCH_CONFIG.MAX_PLAYERS / 2) {
      return { ok: false, code: 'TEAM_FULL', message: 'ทีมนี้เต็มแล้ว (สูงสุดทีมละ 4 คน)' }
    }

    player.team = targetTeam
    const spawn = getSpawnForTeam(targetTeam, room.spawnCounter[targetTeam]++)
    player.position = spawn.position
    player.yaw = spawn.yaw
    return { ok: true, snapshot: this.buildSnapshot(room) }
  }

  selectAgent(
    roomCode: string,
    playerId: string,
    agent: AgentId,
  ): { ok: true; snapshot: RoomSnapshot } | { ok: false; code: string; message: string } {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND', message: 'ไม่พบห้อง' }
    if (room.phase !== 'lobby') {
      return { ok: false, code: 'INVALID_PHASE', message: 'เลือก Agent ได้เฉพาะใน Lobby เท่านั้น' }
    }
    if (!AGENT_IDS.includes(agent)) {
      return { ok: false, code: 'INVALID_AGENT', message: 'ไม่พบ Agent ที่เลือก' }
    }
    const player = room.players.get(playerId)
    if (!player) return { ok: false, code: 'PLAYER_NOT_FOUND', message: 'ไม่พบผู้เล่น' }

    player.agent = agent
    return { ok: true, snapshot: this.buildSnapshot(room) }
  }

  startMatch(
    roomCode: string,
    requesterId: string,
  ): { ok: true; snapshot: RoomSnapshot } | { ok: false; code: string; message: string } {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND', message: 'ไม่พบห้อง' }
    if (room.hostId !== requesterId) {
      return { ok: false, code: 'FORBIDDEN', message: 'เฉพาะหัวหน้าห้อง (Host) เท่านั้นที่เริ่มเกมได้' }
    }
    if (room.phase !== 'lobby') {
      return { ok: false, code: 'INVALID_PHASE', message: 'เกมกำลังดำเนินอยู่แล้ว' }
    }

    const connectedPlayers = Array.from(room.players.values()).filter((p) => p.connected)
    if (connectedPlayers.length < MATCH_CONFIG.MIN_PLAYERS) {
      return {
        ok: false,
        code: 'NOT_ENOUGH_PLAYERS',
        message: `ต้องมีผู้เล่นอย่างน้อย ${MATCH_CONFIG.MIN_PLAYERS} คนจึงจะเริ่มแข่งได้`,
      }
    }

    const bluePlayers = connectedPlayers.filter((p) => p.team === 'blue')
    const redPlayers = connectedPlayers.filter((p) => p.team === 'red')
    if (bluePlayers.length === 0 || redPlayers.length === 0) {
      const half = Math.ceil(connectedPlayers.length / 2)
      connectedPlayers.forEach((p, idx) => {
        p.team = idx < half ? 'blue' : 'red'
      })
    }

    const now = this.nowFn()
    room.phase = 'countdown'
    room.countdownEndsAt = now + MATCH_CONFIG.COUNTDOWN_SEC * 1000
    room.matchStartedAt = null
    room.matchEndsAt = null
    room.killFeed = []
    room.worldEffects = []
    room.summary = null
    room.spawnCounter = { blue: 0, red: 0 }

    for (const p of room.players.values()) {
      const spawn = getSpawnForTeam(p.team, room.spawnCounter[p.team]++)
      p.position = spawn.position
      p.yaw = spawn.yaw
      p.pitch = 0
      p.hp = MATCH_CONFIG.MAX_HP
      p.maxHp = MATCH_CONFIG.MAX_HP
      p.alive = true
      p.respawnAt = null
      p.weapon = null
      p.ammo = 0
      p.maxAmmo = 0
      p.reloadingUntil = null
      p.skillQReadyAt = 0
      p.skillCReadyAt = 0
      p.ultPoints = 0
      p.overdriveUntil = null
      p.overshieldUntil = null
      p.blindedUntil = null
      p.revealedUntil = null
      p.kills = 0
      p.deaths = 0
      p.headshots = 0
      p.correctAnswers = 0
      p.wrongAnswers = 0
      p.totalScore = 0
      p.streak = 0
      p.lastShotAt = 0
      p.activeQuestionId = null
      p.attemptedQuestionIds.clear()
    }

    return { ok: true, snapshot: this.buildSnapshot(room) }
  }

  returnToLobby(
    roomCode: string,
    requesterId: string,
  ): { ok: true; snapshot: RoomSnapshot } | { ok: false; code: string; message: string } {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND', message: 'ไม่พบห้อง' }
    if (room.hostId !== requesterId) {
      return { ok: false, code: 'FORBIDDEN', message: 'เฉพาะหัวหน้าห้องเท่านั้นที่รีเซ็ตกลับ Lobby ได้' }
    }
    if (room.phase !== 'finished') {
      return { ok: false, code: 'INVALID_PHASE', message: 'สามารถกลับ Lobby ได้หลังจบเกมเท่านั้น' }
    }

    for (const [id, p] of room.players.entries()) {
      if (!p.connected) {
        room.players.delete(id)
      } else {
        p.ready = p.isHost
        p.weapon = null
        p.ammo = 0
        p.maxAmmo = 0
        p.hp = MATCH_CONFIG.MAX_HP
        p.maxHp = MATCH_CONFIG.MAX_HP
        p.alive = true
        p.respawnAt = null
        p.activeQuestionId = null
        p.overdriveUntil = null
        p.overshieldUntil = null
        p.blindedUntil = null
        p.revealedUntil = null
        p.ultPoints = 0
      }
    }

    room.phase = 'lobby'
    room.countdownEndsAt = null
    room.matchStartedAt = null
    room.matchEndsAt = null
    room.summary = null
    room.killFeed = []
    room.worldEffects = []

    return { ok: true, snapshot: this.buildSnapshot(room) }
  }

  updatePlayerMove(
    roomCode: string,
    playerId: string,
    position: Vec3,
    yaw: number,
    pitch: number,
  ): boolean {
    const room = this.rooms.get(roomCode)
    if (!room || (room.phase !== 'playing' && room.phase !== 'countdown')) return false
    const player = room.players.get(playerId)
    if (!player || !player.alive || !player.connected) return false
    if (!isFiniteVec3(position) || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return false

    const clamped = clampPositionToArena(position)
    const now = this.nowFn()
    const dtSec = Math.max(0.016, Math.min(1.0, (now - player.lastMoveAt) / 1000))

    if (room.phase === 'countdown') {
      player.yaw = yaw
      player.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch))
      player.lastMoveAt = now
      return true
    }

    // Generous speed tolerance to accommodate Jump Pads, Overdrive, and Dash
    const dx = clamped.x - player.position.x
    const dy = clamped.y - player.position.y
    const dz = clamped.z - player.position.z
    const dist = Math.hypot(dx, dy, dz)
    const maxAllowedDist = Math.max(5.5, 34 * dtSec)

    if (dist <= maxAllowedDist) {
      player.position = clamped
    } else {
      const scale = maxAllowedDist / dist
      player.position = clampPositionToArena({
        x: player.position.x + dx * scale,
        y: player.position.y + dy * scale,
        z: player.position.z + dz * scale,
      })
    }

    player.yaw = yaw
    player.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch))
    player.lastMoveAt = now
    return true
  }

  requestQuestion(
    roomCode: string,
    playerId: string,
    preferredDifficulty?: Difficulty,
  ): { ok: true; question: PublicMathQuestion } | { ok: false; code: string; message: string } {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND', message: 'ไม่พบห้อง' }
    if (room.phase !== 'playing') {
      return { ok: false, code: 'MATCH_NOT_ACTIVE', message: 'สามารถตอบคำถามได้ขณะแข่งขันเท่านั้น' }
    }
    const player = room.players.get(playerId)
    if (!player || !player.connected) {
      return { ok: false, code: 'PLAYER_NOT_FOUND', message: 'ไม่พบผู้เล่น' }
    }

    if (player.activeQuestionId && !player.attemptedQuestionIds.has(player.activeQuestionId)) {
      const existing = QUESTION_BY_ID.get(player.activeQuestionId)
      if (existing) {
        return { ok: true, question: toPublicQuestion(existing) }
      }
    }

    const nextQ = pickNextQuestion(player.attemptedQuestionIds, preferredDifficulty, this.rngFn)
    if (!nextQ) {
      return {
        ok: false,
        code: 'NO_MORE_QUESTIONS',
        message: 'คุณตอบโจทย์ครบทั้งคลัง 48 ข้อแล้ว! ใช้ทักษะการยิงและสกิลเก็บแต้มต่อเลย',
      }
    }

    player.activeQuestionId = nextQ.id
    return { ok: true, question: toPublicQuestion(nextQ) }
  }

  submitAnswer(
    roomCode: string,
    playerId: string,
    questionId: string,
    selectedIndex: number,
  ):
    | { ok: true; result: AnswerResultPayload; snapshot: RoomSnapshot }
    | { ok: false; code: string; message: string } {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND', message: 'ไม่พบห้อง' }
    if (room.phase !== 'playing') {
      return { ok: false, code: 'MATCH_NOT_ACTIVE', message: 'หมดเวลาการแข่งขันแล้ว' }
    }
    const player = room.players.get(playerId)
    if (!player || !player.connected) {
      return { ok: false, code: 'PLAYER_NOT_FOUND', message: 'ไม่พบผู้เล่น' }
    }
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) {
      return { ok: false, code: 'INVALID_CHOICE', message: 'ตัวเลือกคำตอบไม่ถูกต้อง' }
    }

    if (player.attemptedQuestionIds.has(questionId)) {
      return {
        ok: false,
        code: 'DUPLICATE_ANSWER',
        message: 'คำถามนี้ถูกส่งคำตอบไปแล้ว ไม่สามารถตอบซ้ำเพื่อฟาร์มคะแนนได้',
      }
    }

    if (player.activeQuestionId !== questionId) {
      return {
        ok: false,
        code: 'UNASSIGNED_QUESTION',
        message: 'คำถามนี้ไม่ได้ถูกสุ่มให้กับผู้เล่นในรอบปัจจุบัน',
      }
    }

    const question = QUESTION_BY_ID.get(questionId)
    if (!question) {
      return { ok: false, code: 'QUESTION_NOT_FOUND', message: 'ไม่พบคำถามในระบบ' }
    }

    player.attemptedQuestionIds.add(questionId)
    player.activeQuestionId = null

    const correct = selectedIndex === question.correctIndex
    let awardedWeapon: WeaponId | null = null
    let pointsAwarded = 0

    if (correct) {
      pointsAwarded = SCORING.MATH_CORRECT
      player.correctAnswers += 1
      player.totalScore += pointsAwarded
      // Answering math correctly charges your Valorant-style Ultimate (+1 ult orb)!
      player.ultPoints = Math.min(ULT_MAX_POINTS, player.ultPoints + 1)

      awardedWeapon = rollRandomWeapon(question.difficulty, player.weapon, this.rngFn)
      const spec = WEAPONS[awardedWeapon]
      player.weapon = awardedWeapon
      player.ammo = spec.magSize
      player.maxAmmo = spec.magSize
      player.reloadingUntil = null
    } else {
      player.wrongAnswers += 1
    }

    return {
      ok: true,
      result: {
        questionId: question.id,
        correct,
        pointsAwarded,
        awardedWeapon,
        correctIndex: question.correctIndex,
        correctChoiceText: question.choices[question.correctIndex],
        explanation: question.explanation,
        totalScore: player.totalScore,
        correctAnswers: player.correctAnswers,
      },
      snapshot: this.buildSnapshot(room),
    }
  }

  startReload(
    roomCode: string,
    playerId: string,
  ): { ok: true; reloadingUntil: number } | { ok: false; code: string; message: string } {
    const room = this.rooms.get(roomCode)
    if (!room || room.phase !== 'playing') {
      return { ok: false, code: 'MATCH_NOT_ACTIVE', message: 'เกมยังไม่เริ่ม' }
    }
    const player = room.players.get(playerId)
    if (!player || !player.alive || !player.weapon) {
      return { ok: false, code: 'NO_WEAPON', message: 'ยังไม่มีอาวุธ' }
    }
    const spec = WEAPONS[player.weapon]
    if (player.ammo >= spec.magSize) {
      return { ok: false, code: 'AMMO_FULL', message: 'กระสุนเต็มแล้ว' }
    }
    const now = this.nowFn()
    if (player.reloadingUntil && now < player.reloadingUntil) {
      return { ok: true, reloadingUntil: player.reloadingUntil }
    }
    player.reloadingUntil = now + spec.reloadMs
    return { ok: true, reloadingUntil: player.reloadingUntil }
  }

  useSkill(
    roomCode: string,
    playerId: string,
    slot: SkillSlot,
    origin: Vec3,
    rawDirection: Vec3,
  ): { ok: true; outcome: SkillOutcome } | { ok: false; code: string; message: string } {
    const room = this.rooms.get(roomCode)
    if (!room || room.phase !== 'playing') {
      return { ok: false, code: 'MATCH_NOT_ACTIVE', message: 'ใช้สกิลได้เฉพาะขณะแข่งขันเท่านั้น' }
    }
    const player = room.players.get(playerId)
    if (!player || !player.connected || !player.alive) {
      return { ok: false, code: 'CANNOT_CAST', message: 'ผู้เล่นไม่สามารถใช้สกิลได้ในขณะนี้' }
    }
    if (slot !== 'Q' && slot !== 'C' && slot !== 'X') {
      return { ok: false, code: 'INVALID_SKILL', message: 'ช่องสกิลไม่ถูกต้อง' }
    }
    if (!isFiniteVec3(origin) || !isFiniteVec3(rawDirection)) {
      return { ok: false, code: 'INVALID_VECTOR', message: 'ทิศทางสกิลไม่ถูกต้อง' }
    }

    const now = this.nowFn()
    const agentSpec = AGENTS[player.agent]
    const skillSpec = agentSpec.skills[slot]

    // Server-authoritative cooldown / ultimate charge validation
    if (slot === 'Q') {
      if (now < player.skillQReadyAt) {
        return { ok: false, code: 'SKILL_COOLDOWN', message: `${skillSpec.name} ยังติดคูลดาวน์` }
      }
      player.skillQReadyAt = now + skillSpec.cooldownSec * 1000
    } else if (slot === 'C') {
      if (now < player.skillCReadyAt) {
        return { ok: false, code: 'SKILL_COOLDOWN', message: `${skillSpec.name} ยังติดคูลดาวน์` }
      }
      player.skillCReadyAt = now + skillSpec.cooldownSec * 1000
    } else {
      if (player.ultPoints < ULT_MAX_POINTS) {
        return {
          ok: false,
          code: 'ULT_NOT_READY',
          message: `Ultimate ต้องใช้ ${ULT_MAX_POINTS} แต้ม (ตอบคณิตถูกหรือ Kill เพื่อสะสม)`,
        }
      }
      player.ultPoints = 0
    }

    const authEye: Vec3 = {
      x: player.position.x,
      y: player.position.y + PLAYER_DIMENSIONS.eyeHeight,
      z: player.position.z,
    }
    const castOrigin =
      Math.hypot(origin.x - authEye.x, origin.y - authEye.y, origin.z - authEye.z) <= 2.4
        ? origin
        : authEye
    const dir = normalizeVec3(rawDirection)
    const barriers = this.getActiveBarrierBoxes(room, now)

    const hits: CombatHitRecord[] = []
    let scoreboardChanged = false
    let roomStateChanged = true
    let targetPoint: Vec3 = { ...player.position }
    let newPosition: Vec3 | undefined

    switch (skillSpec.id) {
      // ---------------- VORTEX (DUELIST) ----------------
      case 'dash': {
        const flatDir = normalizeVec3({ x: dir.x, y: 0, z: dir.z })
        const clearDist = raycastArenaObstacles(
          { x: player.position.x, y: player.position.y + 0.9, z: player.position.z },
          flatDir,
          9.0,
          barriers,
        )
        const travel = Math.max(0, Math.min(8.5, clearDist - 0.85))
        const dest = clampPositionToArena({
          x: player.position.x + flatDir.x * travel,
          y: player.position.y,
          z: player.position.z + flatDir.z * travel,
        })
        player.position = dest
        player.lastMoveAt = now
        newPosition = dest
        targetPoint = dest
        break
      }

      case 'flash': {
        const hitDist = raycastArenaObstacles(castOrigin, dir, 22, barriers)
        const travel = Math.max(2, hitDist - 0.8)
        targetPoint = clampPositionToArena({
          x: castOrigin.x + dir.x * travel,
          y: Math.max(1.2, castOrigin.y + dir.y * travel),
          z: castOrigin.z + dir.z * travel,
        })
        room.worldEffects.push({
          id: crypto.randomUUID(),
          kind: 'flash',
          ownerId: player.id,
          ownerTeam: player.team,
          position: targetPoint,
          radius: 13.5,
          createdAt: now,
          expiresAt: now + 950,
          color: '#7ef9ff',
        })
        for (const enemy of room.players.values()) {
          if (enemy.team === player.team || !enemy.alive || !enemy.connected) continue
          const d = Math.hypot(
            enemy.position.x - targetPoint.x,
            enemy.position.y + 1.4 - targetPoint.y,
            enemy.position.z - targetPoint.z,
          )
          if (d <= 13.5) {
            enemy.blindedUntil = now + 2200
          }
        }
        break
      }

      case 'overdrive': {
        player.overdriveUntil = now + 8000
        if (player.weapon) {
          player.ammo = WEAPONS[player.weapon].magSize
          player.reloadingUntil = null
        }
        targetPoint = { ...player.position }
        break
      }

      // ---------------- AEGIS (SENTINEL) ----------------
      case 'heal': {
        player.hp = Math.min(player.maxHp, player.hp + 45)
        targetPoint = { ...player.position }
        break
      }

      case 'barrier': {
        const flatDir = normalizeVec3({ x: dir.x, y: 0, z: dir.z })
        const center = clampPositionToArena({
          x: player.position.x + flatDir.x * 3.6,
          y: player.position.y,
          z: player.position.z + flatDir.z * 3.6,
        })
        // Snap barrier orientation perpendicular to facing axis (clean AABB for 100% shared collision)
        const wideAlongX = Math.abs(flatDir.z) >= Math.abs(flatDir.x)
        const halfX = wideAlongX ? 2.6 : 0.42
        const halfZ = wideAlongX ? 0.42 : 2.6
        const wallHeight = 3.2
        targetPoint = center
        room.worldEffects.push({
          id: crypto.randomUUID(),
          kind: 'barrier',
          ownerId: player.id,
          ownerTeam: player.team,
          position: { x: center.x, y: center.y + wallHeight / 2, z: center.z },
          radius: 2.6,
          box: {
            minX: center.x - halfX,
            maxX: center.x + halfX,
            minY: center.y,
            maxY: center.y + wallHeight,
            minZ: center.z - halfZ,
            maxZ: center.z + halfZ,
          },
          createdAt: now,
          expiresAt: now + 12_000,
          color: '#10f59b',
        })
        break
      }

      case 'overshield': {
        player.maxHp = 175
        player.hp = 175
        player.overshieldUntil = now + 10_000
        if (player.weapon) {
          player.ammo = WEAPONS[player.weapon].magSize
          player.reloadingUntil = null
        }
        targetPoint = { ...player.position }
        break
      }

      // ---------------- PHANTOM (CONTROLLER) ----------------
      case 'smoke': {
        const hitDist = raycastArenaObstacles(castOrigin, dir, 26, barriers)
        const travel = Math.max(3, hitDist - 0.5)
        targetPoint = clampPositionToArena({
          x: castOrigin.x + dir.x * travel,
          y: Math.max(0.2, castOrigin.y + dir.y * travel),
          z: castOrigin.z + dir.z * travel,
        })
        room.worldEffects.push({
          id: crypto.randomUUID(),
          kind: 'smoke',
          ownerId: player.id,
          ownerTeam: player.team,
          position: { x: targetPoint.x, y: Math.min(3.5, targetPoint.y + 1.6), z: targetPoint.z },
          radius: 4.6,
          createdAt: now,
          expiresAt: now + 10_000,
          color: '#a855f7',
        })
        break
      }

      case 'blink': {
        const flatDir = normalizeVec3({ x: dir.x, y: 0, z: dir.z })
        const clearDist = raycastArenaObstacles(
          { x: player.position.x, y: player.position.y + 0.9, z: player.position.z },
          flatDir,
          10.8,
          barriers,
        )
        const travel = Math.max(0, Math.min(10.0, clearDist - 0.9))
        const dest = clampPositionToArena({
          x: player.position.x + flatDir.x * travel,
          y: player.position.y,
          z: player.position.z + flatDir.z * travel,
        })
        player.position = dest
        player.lastMoveAt = now
        newPosition = dest
        targetPoint = dest
        break
      }

      case 'orbital': {
        const hitDist = raycastArenaObstacles(castOrigin, dir, 34, [])
        targetPoint = clampPositionToArena({
          x: castOrigin.x + dir.x * hitDist,
          y: 0,
          z: castOrigin.z + dir.z * hitDist,
        })
        room.worldEffects.push({
          id: crypto.randomUUID(),
          kind: 'orbital',
          ownerId: player.id,
          ownerTeam: player.team,
          position: targetPoint,
          radius: 5.4,
          createdAt: now,
          detonateAt: now + 900,
          detonated: false,
          expiresAt: now + 2600,
          color: '#e879f9',
        })
        break
      }

      // ---------------- PULSE (INITIATOR) ----------------
      case 'recon': {
        targetPoint = { x: player.position.x, y: player.position.y + 1.2, z: player.position.z }
        room.worldEffects.push({
          id: crypto.randomUUID(),
          kind: 'sonar',
          ownerId: player.id,
          ownerTeam: player.team,
          position: targetPoint,
          radius: 30,
          createdAt: now,
          expiresAt: now + 2200,
          color: '#fb923c',
        })
        for (const enemy of room.players.values()) {
          if (enemy.team === player.team || !enemy.alive || !enemy.connected) continue
          const d = Math.hypot(
            enemy.position.x - targetPoint.x,
            enemy.position.z - targetPoint.z,
          )
          if (d <= 32) {
            enemy.revealedUntil = now + 5500
          }
        }
        break
      }

      case 'cluster':
      case 'barrage': {
        const isUlt = skillSpec.id === 'barrage'
        const maxRange = isUlt ? 38 : 28
        const blastRadius = isUlt ? 6.2 : 5.0
        const blastDamage = isUlt ? 120 : 55
        const wallDist = raycastArenaObstacles(castOrigin, dir, maxRange, barriers)

        // Check direct enemy hit along flight path too
        let impactDist = wallDist
        for (const enemy of room.players.values()) {
          if (enemy.team === player.team || !enemy.alive || !enemy.connected) continue
          const hit = raycastPlayerHitbox(castOrigin, dir, enemy.position, impactDist)
          if (hit && hit.distance < impactDist) {
            impactDist = hit.distance
          }
        }

        targetPoint = clampPositionToArena({
          x: castOrigin.x + dir.x * impactDist,
          y: Math.max(0.4, castOrigin.y + dir.y * impactDist),
          z: castOrigin.z + dir.z * impactDist,
        })

        room.worldEffects.push({
          id: crypto.randomUUID(),
          kind: 'explosion',
          ownerId: player.id,
          ownerTeam: player.team,
          position: targetPoint,
          radius: blastRadius,
          createdAt: now,
          expiresAt: now + (isUlt ? 1400 : 1050),
          color: isUlt ? '#fbbf24' : '#fb923c',
        })

        for (const enemy of room.players.values()) {
          if (enemy.team === player.team || !enemy.alive || !enemy.connected) continue
          const d = Math.hypot(
            enemy.position.x - targetPoint.x,
            enemy.position.y + 1.0 - targetPoint.y,
            enemy.position.z - targetPoint.z,
          )
          if (d <= blastRadius) {
            const record = this.applyDamageAndKill(
              room,
              player,
              enemy,
              blastDamage,
              false,
              'skill',
              now,
              skillSpec.name,
            )
            hits.push(record)
            if (record.confirm.killed) scoreboardChanged = true
          }
        }
        break
      }

      default:
        roomStateChanged = false
        break
    }

    const cast: SkillCastPayload = {
      id: crypto.randomUUID(),
      playerId: player.id,
      playerName: player.name,
      team: player.team,
      agent: player.agent,
      slot,
      skillId: skillSpec.id,
      skillName: skillSpec.name,
      origin: castOrigin,
      target: targetPoint,
      newPosition,
      timestamp: now,
    }

    return {
      ok: true,
      outcome: { cast, hits, scoreboardChanged, roomStateChanged },
    }
  }

  shoot(
    roomCode: string,
    shooterId: string,
    origin: Vec3,
    rawDirection: Vec3,
  ): { ok: true; outcome: ShootOutcome; scoreboardChanged: boolean } | { ok: false; code: string; message: string } {
    const room = this.rooms.get(roomCode)
    if (!room || room.phase !== 'playing') {
      return { ok: false, code: 'MATCH_NOT_ACTIVE', message: 'เกมยังไม่เริ่ม' }
    }
    const shooter = room.players.get(shooterId)
    if (!shooter || !shooter.connected || !shooter.alive) {
      return { ok: false, code: 'CANNOT_SHOOT', message: 'ผู้เล่นไม่สามารถยิงได้ในขณะนี้' }
    }
    if (!shooter.weapon) {
      return { ok: false, code: 'NO_WEAPON', message: 'ต้องตอบคำถามคณิตศาสตร์ให้ถูกก่อนจึงจะได้รับอาวุธ' }
    }
    if (!isFiniteVec3(origin) || !isFiniteVec3(rawDirection)) {
      return { ok: false, code: 'INVALID_VECTOR', message: 'ทิศทางการยิงไม่ถูกต้อง' }
    }

    const now = this.nowFn()
    const spec = WEAPONS[shooter.weapon]
    const overdriveActive = Boolean(shooter.overdriveUntil && now < shooter.overdriveUntil)
    const effectiveFireRateMs = overdriveActive ? Math.floor(spec.fireRateMs * 0.65) : spec.fireRateMs
    const damageMult = overdriveActive ? 1.25 : 1.0

    if (shooter.reloadingUntil !== null) {
      if (now >= shooter.reloadingUntil) {
        shooter.ammo = spec.magSize
        shooter.reloadingUntil = null
      } else {
        return { ok: false, code: 'RELOADING', message: 'กำลังรีโหลดอาวุธ' }
      }
    }

    if (shooter.ammo <= 0) {
      return { ok: false, code: 'OUT_OF_AMMO', message: 'กระสุนหมด กด R เพื่อรีโหลด' }
    }

    if (now - shooter.lastShotAt < effectiveFireRateMs - 20) {
      return { ok: false, code: 'FIRE_RATE_LIMIT', message: 'ยิงเร็วเกินขีดจำกัดของอาวุธ' }
    }

    const authEye: Vec3 = {
      x: shooter.position.x,
      y: shooter.position.y + PLAYER_DIMENSIONS.eyeHeight,
      z: shooter.position.z,
    }
    const originDelta = Math.hypot(
      origin.x - authEye.x,
      origin.y - authEye.y,
      origin.z - authEye.z,
    )
    const rayOrigin = originDelta <= 2.4 ? origin : authEye
    const baseDir = normalizeVec3(rawDirection)
    const barriers = this.getActiveBarrierBoxes(room, now)

    const ammoCost = spec.id === 'burst' ? Math.min(shooter.ammo, 3) : 1
    const shotPellets = spec.id === 'burst' ? ammoCost : spec.pellets

    shooter.ammo -= ammoCost
    shooter.lastShotAt = now

    const endpoints: Vec3[] = []
    const damageAccumulator = new Map<string, { damage: number; headshot: boolean }>()

    for (let pellet = 0; pellet < shotPellets; pellet++) {
      let dir = baseDir
      if (shotPellets > 1 && spec.spreadRad > 0) {
        const angle = (pellet / shotPellets) * Math.PI * 2 + this.rngFn() * 0.5
        const mag = (0.3 + this.rngFn() * 0.7) * spec.spreadRad
        dir = normalizeVec3({
          x: baseDir.x + Math.cos(angle) * mag,
          y: baseDir.y + Math.sin(angle) * mag * 0.75,
          z: baseDir.z + Math.sin(angle + 1.2) * mag,
        })
      }

      const wallDist = raycastArenaObstacles(rayOrigin, dir, spec.range, barriers)
      let closestTarget: { player: InternalPlayer; distance: number; headshot: boolean } | null = null

      for (const candidate of room.players.values()) {
        if (candidate.id === shooter.id) continue
        if (candidate.team === shooter.team) continue
        if (!candidate.alive || !candidate.connected) continue

        const hit = raycastPlayerHitbox(rayOrigin, dir, candidate.position, wallDist)
        if (hit && (!closestTarget || hit.distance < closestTarget.distance)) {
          closestTarget = { player: candidate, distance: hit.distance, headshot: hit.headshot }
        }
      }

      if (closestTarget) {
        endpoints.push({
          x: rayOrigin.x + dir.x * closestTarget.distance,
          y: rayOrigin.y + dir.y * closestTarget.distance,
          z: rayOrigin.z + dir.z * closestTarget.distance,
        })
        const rawDmg = closestTarget.headshot ? spec.headshotDamage : spec.damage
        const dmg = Math.round(rawDmg * damageMult)
        const prev = damageAccumulator.get(closestTarget.player.id)
        damageAccumulator.set(closestTarget.player.id, {
          damage: (prev?.damage ?? 0) + dmg,
          headshot: Boolean(prev?.headshot || closestTarget.headshot),
        })
      } else {
        endpoints.push({
          x: rayOrigin.x + dir.x * wallDist,
          y: rayOrigin.y + dir.y * wallDist,
          z: rayOrigin.z + dir.z * wallDist,
        })
      }
    }

    const hits: CombatHitRecord[] = []
    let scoreboardChanged = false
    let primaryHitPlayerId: string | undefined
    let primaryHeadshot: boolean | undefined

    for (const [victimId, info] of damageAccumulator.entries()) {
      const victim = room.players.get(victimId)
      if (!victim || !victim.alive) continue

      primaryHitPlayerId = victim.id
      primaryHeadshot = info.headshot

      const record = this.applyDamageAndKill(
        room,
        shooter,
        victim,
        info.damage,
        info.headshot,
        shooter.weapon,
        now,
      )
      hits.push(record)
      if (record.confirm.killed) scoreboardChanged = true
    }

    const shot: ShotEvent = {
      id: crypto.randomUUID(),
      shooterId: shooter.id,
      shooterTeam: shooter.team,
      weapon: shooter.weapon,
      origin: rayOrigin,
      endpoints,
      hitPlayerId: primaryHitPlayerId,
      headshot: primaryHeadshot,
      timestamp: now,
    }

    return { ok: true, outcome: { shot, hits }, scoreboardChanged }
  }

  tick(): TickTransition[] {
    const now = this.nowFn()
    const transitions: TickTransition[] = []

    for (const [roomCode, room] of this.rooms.entries()) {
      const anyConnected = Array.from(room.players.values()).some((p) => p.connected)
      if (!anyConnected) {
        const latestDisconnect = Math.max(
          room.createdAt,
          ...Array.from(room.players.values()).map((p) => p.disconnectedAt ?? room.createdAt),
        )
        if (now - latestDisconnect > 10 * 60 * 1000) {
          this.rooms.delete(roomCode)
          transitions.push({ roomCode, type: 'ROOM_CLEANED' })
          continue
        }
      }

      if (room.phase === 'countdown' && room.countdownEndsAt !== null && now >= room.countdownEndsAt) {
        room.phase = 'playing'
        room.matchStartedAt = now
        room.matchEndsAt = now + MATCH_CONFIG.DURATION_SEC * 1000
        room.countdownEndsAt = null
        transitions.push({ roomCode, type: 'PHASE_PLAYING' })
      }

      if (room.phase === 'playing') {
        let anyRespawn = false
        let anyReload = false
        let effectsDirty = false

        // Tick delayed Orbital Strikes & clean up expired WorldEffects
        for (const eff of room.worldEffects) {
          if (eff.kind === 'orbital' && !eff.detonated && eff.detonateAt && now >= eff.detonateAt) {
            eff.detonated = true
            effectsDirty = true
            const attacker = room.players.get(eff.ownerId)
            if (attacker) {
              const orbitalHits: CombatHitRecord[] = []
              for (const enemy of room.players.values()) {
                if (enemy.team === eff.ownerTeam || !enemy.alive || !enemy.connected) continue
                const d = Math.hypot(
                  enemy.position.x - eff.position.x,
                  enemy.position.z - eff.position.z,
                )
                if (d <= eff.radius) {
                  orbitalHits.push(
                    this.applyDamageAndKill(
                      room,
                      attacker,
                      enemy,
                      90,
                      false,
                      'skill',
                      now,
                      'ORBITAL STRIKE',
                    ),
                  )
                }
              }
              if (orbitalHits.length > 0) {
                transitions.push({
                  roomCode,
                  type: 'ORBITAL_DETONATED',
                  hits: orbitalHits,
                  attackerId: attacker.id,
                })
              }
            }
          }
        }

        const beforeEffects = room.worldEffects.length
        room.worldEffects = room.worldEffects.filter((e) => e.expiresAt > now)
        if (room.worldEffects.length !== beforeEffects) {
          effectsDirty = true
        }

        for (const p of room.players.values()) {
          // Expire Titan Overshield cleanly
          if (p.overshieldUntil !== null && now >= p.overshieldUntil) {
            p.overshieldUntil = null
            p.maxHp = MATCH_CONFIG.MAX_HP
            p.hp = Math.min(p.hp, MATCH_CONFIG.MAX_HP)
          }
          if (p.overdriveUntil !== null && now >= p.overdriveUntil) {
            p.overdriveUntil = null
          }
          if (p.blindedUntil !== null && now >= p.blindedUntil) {
            p.blindedUntil = null
          }
          if (p.revealedUntil !== null && now >= p.revealedUntil) {
            p.revealedUntil = null
          }

          if (p.reloadingUntil !== null && now >= p.reloadingUntil && p.weapon) {
            p.ammo = WEAPONS[p.weapon].magSize
            p.reloadingUntil = null
            anyReload = true
          }
          if (!p.alive && p.respawnAt !== null && now >= p.respawnAt) {
            const spawn = getSpawnForTeam(p.team, room.spawnCounter[p.team]++)
            p.position = spawn.position
            p.yaw = spawn.yaw
            p.pitch = 0
            p.hp = MATCH_CONFIG.MAX_HP
            p.maxHp = MATCH_CONFIG.MAX_HP
            p.alive = true
            p.respawnAt = null
            anyRespawn = true
          }
        }

        if (anyRespawn) transitions.push({ roomCode, type: 'RESPAWNED' })
        if (anyReload) transitions.push({ roomCode, type: 'RELOADED' })
        if (effectsDirty) transitions.push({ roomCode, type: 'EFFECTS_UPDATED' })

        if (room.matchEndsAt !== null && now >= room.matchEndsAt) {
          room.phase = 'finished'
          room.worldEffects = []
          const summary = this.buildMatchSummary(room, now)
          room.summary = summary
          transitions.push({ roomCode, type: 'MATCH_FINISHED', summary })
        }
      }
    }

    return transitions
  }

  buildScoreboard(room: InternalRoom): ScoreboardEntry[] {
    const entries: ScoreboardEntry[] = Array.from(room.players.values()).map((p) => ({
      rank: 0,
      playerId: p.id,
      name: p.name,
      team: p.team,
      agent: p.agent,
      correctAnswers: p.correctAnswers,
      wrongAnswers: p.wrongAnswers,
      kills: p.kills,
      deaths: p.deaths,
      headshots: p.headshots,
      totalScore: p.totalScore,
      connected: p.connected,
    }))

    entries.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
      if (b.kills !== a.kills) return b.kills - a.kills
      if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers
      return a.deaths - b.deaths
    })

    entries.forEach((entry, idx) => {
      entry.rank = idx + 1
    })
    return entries
  }

  buildMatchSummary(room: InternalRoom, finishedAt: number): MatchSummary {
    const standings = this.buildScoreboard(room)
    const teamScores = { blue: 0, red: 0 }
    for (const s of standings) {
      teamScores[s.team] += s.totalScore
    }
    const winnerTeam: Team | 'draw' =
      teamScores.blue > teamScores.red
        ? 'blue'
        : teamScores.red > teamScores.blue
          ? 'red'
          : 'draw'

    return {
      roomCode: room.roomCode,
      finishedAt,
      winnerPlayer: standings[0] ?? null,
      winnerTeam,
      teamScores,
      standings,
    }
  }

  buildSnapshot(room: InternalRoom): RoomSnapshot {
    const players: PlayerPublicState[] = Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      agent: p.agent,
      ready: p.ready,
      connected: p.connected,
      isHost: p.isHost,
      position: { ...p.position },
      yaw: p.yaw,
      pitch: p.pitch,
      hp: p.hp,
      maxHp: p.maxHp,
      alive: p.alive,
      respawnAt: p.respawnAt,
      weapon: p.weapon,
      ammo: p.ammo,
      maxAmmo: p.maxAmmo,
      reloadingUntil: p.reloadingUntil,
      skillQReadyAt: p.skillQReadyAt,
      skillCReadyAt: p.skillCReadyAt,
      ultPoints: p.ultPoints,
      ultMax: p.ultMax,
      overdriveUntil: p.overdriveUntil,
      overshieldUntil: p.overshieldUntil,
      blindedUntil: p.blindedUntil,
      revealedUntil: p.revealedUntil,
      kills: p.kills,
      deaths: p.deaths,
      headshots: p.headshots,
      correctAnswers: p.correctAnswers,
      wrongAnswers: p.wrongAnswers,
      totalScore: p.totalScore,
      streak: p.streak,
    }))

    return {
      roomCode: room.roomCode,
      hostId: room.hostId,
      phase: room.phase,
      serverNow: this.nowFn(),
      countdownEndsAt: room.countdownEndsAt,
      matchStartedAt: room.matchStartedAt,
      matchEndsAt: room.matchEndsAt,
      matchDurationSec: MATCH_CONFIG.DURATION_SEC,
      maxPlayers: MATCH_CONFIG.MAX_PLAYERS,
      players,
      scoreboard: this.buildScoreboard(room),
      killFeed: [...room.killFeed],
      worldEffects: room.worldEffects.map((e) => ({
        ...e,
        position: { ...e.position },
        box: e.box ? { ...e.box } : undefined,
      })),
      summary: room.summary,
    }
  }
}
