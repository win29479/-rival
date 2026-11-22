import { create } from 'zustand'
import type {
  AnswerResultPayload,
  DamageTakenPayload,
  HitConfirmPayload,
  KillFeedItem,
  MatchSummary,
  PlayerPublicState,
  PublicMathQuestion,
  RoomSnapshot,
  ShotEvent,
  SkillCastPayload,
  Vec3,
  WeaponId,
} from '../../shared/types.ts'

export type ScreenMode = 'menu' | 'room' | 'lobby' | 'arena' | 'result'
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface RemoteTransform {
  position: Vec3
  yaw: number
  pitch: number
  hp: number
  maxHp: number
  alive: boolean
  respawnAt: number | null
  weapon: WeaponId | null
  ammo: number
  reloadingUntil: number | null
  skillQReadyAt: number
  skillCReadyAt: number
  ultPoints: number
  overdriveUntil: number | null
  overshieldUntil: number | null
  blindedUntil: number | null
  revealedUntil: number | null
  updatedAt: number
}

export interface PersistedSession {
  roomCode: string
  playerId: string
  sessionToken: string
  playerName: string
}

const SESSION_KEY = 'math_rivals_3d_session'

export function saveSession(session: PersistedSession | null): void {
  try {
    if (!session) {
      sessionStorage.removeItem(SESSION_KEY)
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedSession>
    if (parsed.roomCode && parsed.playerId && parsed.sessionToken) {
      return {
        roomCode: parsed.roomCode,
        playerId: parsed.playerId,
        sessionToken: parsed.sessionToken,
        playerName: parsed.playerName ?? 'Rival',
      }
    }
    return null
  } catch {
    return null
  }
}

export interface HitMarkerState {
  id: number
  headshot: boolean
  killed: boolean
  damage: number
  pointsAwarded: number
  timestamp: number
}

export interface WeaponRevealState {
  id: number
  weapon: WeaponId
  pointsAwarded: number
  timestamp: number
}

export interface ActiveTracer {
  id: string
  shooterTeam: 'blue' | 'red'
  weapon: WeaponId
  origin: Vec3
  endpoints: Vec3[]
  createdAt: number
}

export interface GameState {
  screen: ScreenMode
  connectionStatus: ConnectionStatus
  transportMode: 'ws' | 'supabase'
  playerName: string
  playerId: string | null
  sessionToken: string | null
  room: RoomSnapshot | null
  clockOffsetMs: number

  liveTransforms: Map<string, RemoteTransform>
  localPredictedPos: Vec3
  localYaw: number
  localPitch: number
  pendingSnapPos: Vec3 | null
  lastShotVisualAt: number
  isAdsZoom: boolean

  activeQuestion: PublicMathQuestion | null
  lastAnswerResult: AnswerResultPayload | null
  mathModalOpen: boolean
  weaponReveal: WeaponRevealState | null
  lastSkillBanner: (SkillCastPayload & { receivedAt: number }) | null
  hitMarker: HitMarkerState | null
  lastDamageTaken: (DamageTakenPayload & { timestamp: number }) | null
  tracers: ActiveTracer[]
  recentKills: KillFeedItem[]
  matchSummary: MatchSummary | null

  pointerLocked: boolean
  pauseOpen: boolean
  scoreboardOpen: boolean
  muted: boolean
  mouseSensitivity: number
  errorMessage: string | null
  statusToast: string | null

  setScreen: (screen: ScreenMode) => void
  setPlayerName: (name: string) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setTransportMode: (mode: 'ws' | 'supabase') => void
  setClockOffset: (serverNow: number) => void
  setError: (msg: string | null) => void
  setStatusToast: (msg: string | null) => void
  setPointerLocked: (locked: boolean) => void
  setMathModalOpen: (open: boolean) => void
  setPauseOpen: (open: boolean) => void
  setScoreboardOpen: (open: boolean) => void
  setMuted: (muted: boolean) => void
  setMouseSensitivity: (sens: number) => void
  setAdsZoom: (zoom: boolean) => void
  triggerLocalShotVisual: () => void
  setLocalTransform: (pos: Vec3, yaw: number, pitch: number) => void
  consumePendingSnap: () => Vec3 | null

  onRoomJoined: (playerId: string, sessionToken: string, room: RoomSnapshot) => void
  onRoomState: (room: RoomSnapshot) => void
  onPositionsSync: (
    serverNow: number,
    positions: Array<{
      id: string
      position: Vec3
      yaw: number
      pitch: number
      hp: number
      maxHp: number
      alive: boolean
      respawnAt: number | null
      weapon: WeaponId | null
      ammo: number
      reloadingUntil: number | null
      skillQReadyAt: number
      skillCReadyAt: number
      ultPoints: number
      overdriveUntil: number | null
      overshieldUntil: number | null
      blindedUntil: number | null
      revealedUntil: number | null
    }>,
  ) => void
  onQuestionAssigned: (question: PublicMathQuestion) => void
  onAnswerResult: (result: AnswerResultPayload) => void
  onShotFired: (shot: ShotEvent) => void
  onSkillCast: (cast: SkillCastPayload) => void
  onHitConfirmed: (hit: HitConfirmPayload) => void
  onDamageTaken: (damage: DamageTakenPayload) => void
  onKillEvent: (kill: KillFeedItem) => void
  onMatchFinished: (summary: MatchSummary, room: RoomSnapshot) => void
  clearWeaponReveal: () => void
  clearLastAnswer: () => void
  resetToMenu: () => void
}

function screenForPhase(phase: RoomSnapshot['phase']): ScreenMode {
  switch (phase) {
    case 'lobby':
      return 'lobby'
    case 'countdown':
    case 'playing':
      return 'arena'
    case 'finished':
      return 'result'
  }
}

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'menu',
  connectionStatus: 'disconnected',
  transportMode: 'ws',
  playerName: loadSession()?.playerName ?? '',
  playerId: null,
  sessionToken: null,
  room: null,
  clockOffsetMs: 0,

  liveTransforms: new Map<string, RemoteTransform>(),
  localPredictedPos: { x: 0, y: 0, z: -26 },
  localYaw: Math.PI,
  localPitch: 0,
  pendingSnapPos: null,
  lastShotVisualAt: 0,
  isAdsZoom: false,

  activeQuestion: null,
  lastAnswerResult: null,
  mathModalOpen: false,
  weaponReveal: null,
  lastSkillBanner: null,
  hitMarker: null,
  lastDamageTaken: null,
  tracers: [],
  recentKills: [],
  matchSummary: null,

  pointerLocked: false,
  pauseOpen: false,
  scoreboardOpen: false,
  muted: false,
  mouseSensitivity: 0.0022,
  errorMessage: null,
  statusToast: null,

  setScreen: (screen) => set({ screen, errorMessage: null }),
  setPlayerName: (playerName) => set({ playerName }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setTransportMode: (transportMode) => set({ transportMode }),
  setClockOffset: (serverNow) => {
    const sample = serverNow - Date.now()
    const prev = get().clockOffsetMs
    set({ clockOffsetMs: prev === 0 ? sample : prev * 0.7 + sample * 0.3 })
  },
  setError: (errorMessage) => set({ errorMessage }),
  setStatusToast: (statusToast) => set({ statusToast }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  setMathModalOpen: (mathModalOpen) => set({ mathModalOpen }),
  setPauseOpen: (pauseOpen) => set({ pauseOpen }),
  setScoreboardOpen: (scoreboardOpen) => set({ scoreboardOpen }),
  setMuted: (muted) => set({ muted }),
  setMouseSensitivity: (mouseSensitivity) => set({ mouseSensitivity }),
  setAdsZoom: (isAdsZoom) => set({ isAdsZoom }),
  triggerLocalShotVisual: () => set({ lastShotVisualAt: performance.now() }),
  setLocalTransform: (localPredictedPos, localYaw, localPitch) => {
    const state = get()
    state.localPredictedPos = localPredictedPos
    state.localYaw = localYaw
    state.localPitch = localPitch
  },
  consumePendingSnap: () => {
    const pos = get().pendingSnapPos
    if (pos) {
      get().pendingSnapPos = null
    }
    return pos
  },

  onRoomJoined: (playerId, sessionToken, room) => {
    const me = room.players.find((p) => p.id === playerId)
    const transforms = new Map<string, RemoteTransform>()
    const now = performance.now()
    for (const p of room.players) {
      transforms.set(p.id, {
        position: { ...p.position },
        yaw: p.yaw,
        pitch: p.pitch,
        hp: p.hp,
        maxHp: p.maxHp,
        alive: p.alive,
        respawnAt: p.respawnAt,
        weapon: p.weapon,
        ammo: p.ammo,
        reloadingUntil: p.reloadingUntil,
        skillQReadyAt: p.skillQReadyAt,
        skillCReadyAt: p.skillCReadyAt,
        ultPoints: p.ultPoints,
        overdriveUntil: p.overdriveUntil,
        overshieldUntil: p.overshieldUntil,
        blindedUntil: p.blindedUntil,
        revealedUntil: p.revealedUntil,
        updatedAt: now,
      })
    }

    saveSession({
      roomCode: room.roomCode,
      playerId,
      sessionToken,
      playerName: me?.name ?? get().playerName,
    })

    set({
      playerId,
      sessionToken,
      playerName: me?.name ?? get().playerName,
      room,
      liveTransforms: transforms,
      localPredictedPos: me ? { ...me.position } : { x: 0, y: 0, z: -26 },
      localYaw: me?.yaw ?? Math.PI,
      localPitch: me?.pitch ?? 0,
      screen: screenForPhase(room.phase),
      matchSummary: room.summary,
      recentKills: room.killFeed,
      clockOffsetMs: room.serverNow - Date.now(),
      errorMessage: null,
      pauseOpen: false,
    })
  },

  onRoomState: (room) => {
    const prevRoom = get().room
    const myId = get().playerId
    const prevPhase = prevRoom?.phase
    const nextScreen = screenForPhase(room.phase)

    const transforms = get().liveTransforms
    const now = performance.now()
    for (const p of room.players) {
      transforms.set(p.id, {
        position: { ...p.position },
        yaw: p.yaw,
        pitch: p.pitch,
        hp: p.hp,
        maxHp: p.maxHp,
        alive: p.alive,
        respawnAt: p.respawnAt,
        weapon: p.weapon,
        ammo: p.ammo,
        reloadingUntil: p.reloadingUntil,
        skillQReadyAt: p.skillQReadyAt,
        skillCReadyAt: p.skillCReadyAt,
        ultPoints: p.ultPoints,
        overdriveUntil: p.overdriveUntil,
        overshieldUntil: p.overshieldUntil,
        blindedUntil: p.blindedUntil,
        revealedUntil: p.revealedUntil,
        updatedAt: now,
      })
    }

    const prevMe = prevRoom?.players.find((p) => p.id === myId)
    const nextMe = room.players.find((p) => p.id === myId)
    let nextLocalPos = get().localPredictedPos
    let nextLocalYaw = get().localYaw
    if (
      nextMe &&
      (prevPhase !== room.phase || (prevMe && !prevMe.alive && nextMe.alive))
    ) {
      nextLocalPos = { ...nextMe.position }
      nextLocalYaw = nextMe.yaw
    }

    set({
      room,
      screen: nextScreen,
      localPredictedPos: nextLocalPos,
      localYaw: nextLocalYaw,
      recentKills: room.killFeed,
      matchSummary: room.summary ?? get().matchSummary,
      clockOffsetMs: room.serverNow - Date.now(),
      mathModalOpen: room.phase === 'playing' ? get().mathModalOpen : false,
      activeQuestion: room.phase === 'playing' ? get().activeQuestion : null,
      pauseOpen: room.phase === 'playing' ? get().pauseOpen : false,
    })
  },

  onPositionsSync: (serverNow, positions) => {
    const state = get()
    const transforms = state.liveTransforms
    const now = performance.now()

    for (const item of positions) {
      transforms.set(item.id, {
        position: item.position,
        yaw: item.yaw,
        pitch: item.pitch,
        hp: item.hp,
        maxHp: item.maxHp,
        alive: item.alive,
        respawnAt: item.respawnAt,
        weapon: item.weapon,
        ammo: item.ammo,
        reloadingUntil: item.reloadingUntil,
        skillQReadyAt: item.skillQReadyAt,
        skillCReadyAt: item.skillCReadyAt,
        ultPoints: item.ultPoints,
        overdriveUntil: item.overdriveUntil,
        overshieldUntil: item.overshieldUntil,
        blindedUntil: item.blindedUntil,
        revealedUntil: item.revealedUntil,
        updatedAt: now,
      })
    }

    if (state.room && state.playerId) {
      const mySync = positions.find((p) => p.id === state.playerId)
      const myCurrent = state.room.players.find((p) => p.id === state.playerId)
      const anyRevealChanged = positions.some((s) => {
        const cur = state.room?.players.find((p) => p.id === s.id)
        return cur && cur.revealedUntil !== s.revealedUntil
      })

      if (
        anyRevealChanged ||
        (mySync &&
          myCurrent &&
          (myCurrent.hp !== mySync.hp ||
            myCurrent.maxHp !== mySync.maxHp ||
            myCurrent.ammo !== mySync.ammo ||
            myCurrent.alive !== mySync.alive ||
            myCurrent.weapon !== mySync.weapon ||
            myCurrent.reloadingUntil !== mySync.reloadingUntil ||
            myCurrent.skillQReadyAt !== mySync.skillQReadyAt ||
            myCurrent.skillCReadyAt !== mySync.skillCReadyAt ||
            myCurrent.ultPoints !== mySync.ultPoints ||
            myCurrent.overdriveUntil !== mySync.overdriveUntil ||
            myCurrent.overshieldUntil !== mySync.overshieldUntil ||
            myCurrent.blindedUntil !== mySync.blindedUntil))
      ) {
        const updatedPlayers: PlayerPublicState[] = state.room.players.map((p) => {
          const sync = positions.find((s) => s.id === p.id)
          if (!sync) return p
          return {
            ...p,
            hp: sync.hp,
            maxHp: sync.maxHp,
            alive: sync.alive,
            respawnAt: sync.respawnAt,
            weapon: sync.weapon,
            ammo: sync.ammo,
            reloadingUntil: sync.reloadingUntil,
            skillQReadyAt: sync.skillQReadyAt,
            skillCReadyAt: sync.skillCReadyAt,
            ultPoints: sync.ultPoints,
            overdriveUntil: sync.overdriveUntil,
            overshieldUntil: sync.overshieldUntil,
            blindedUntil: sync.blindedUntil,
            revealedUntil: sync.revealedUntil,
          }
        })
        set({
          room: { ...state.room, serverNow, players: updatedPlayers },
        })
      }
    }
  },

  onQuestionAssigned: (question) => {
    set({
      activeQuestion: question,
      lastAnswerResult: null,
      mathModalOpen: true,
    })
  },

  onAnswerResult: (result) => {
    set({
      lastAnswerResult: result,
      activeQuestion: null,
      weaponReveal:
        result.correct && result.awardedWeapon
          ? {
              id: Date.now(),
              weapon: result.awardedWeapon,
              pointsAwarded: result.pointsAwarded,
              timestamp: Date.now(),
            }
          : get().weaponReveal,
    })
  },

  onShotFired: (shot) => {
    const now = performance.now()
    const nextTracer: ActiveTracer = {
      id: shot.id,
      shooterTeam: shot.shooterTeam,
      weapon: shot.weapon,
      origin: shot.origin,
      endpoints: shot.endpoints,
      createdAt: now,
    }
    const kept = get().tracers.filter((t) => now - t.createdAt < 260)
    kept.push(nextTracer)
    set({ tracers: kept })
  },

  onSkillCast: (cast) => {
    const state = get()
    // Snap local FPS controller cleanly when server authorizes Tailwind Dash or Phase Blink
    const snap =
      cast.playerId === state.playerId && cast.newPosition
        ? { ...cast.newPosition }
        : state.pendingSnapPos

    set({
      pendingSnapPos: snap,
      lastSkillBanner: { ...cast, receivedAt: Date.now() },
    })
  },

  onHitConfirmed: (hit) => {
    set({
      hitMarker: {
        id: Date.now(),
        headshot: hit.headshot,
        killed: hit.killed,
        damage: hit.damage,
        pointsAwarded: hit.pointsAwarded,
        timestamp: Date.now(),
      },
    })
  },

  onDamageTaken: (damage) => {
    set({
      lastDamageTaken: {
        ...damage,
        timestamp: Date.now(),
      },
    })
  },

  onKillEvent: (kill) => {
    const next = [kill, ...get().recentKills.filter((k) => k.id !== kill.id)].slice(0, 6)
    set({ recentKills: next })
  },

  onMatchFinished: (summary, room) => {
    if (document.pointerLockElement) {
      document.exitPointerLock()
    }
    set({
      room,
      matchSummary: summary,
      screen: 'result',
      mathModalOpen: false,
      activeQuestion: null,
      pauseOpen: false,
      scoreboardOpen: false,
      pointerLocked: false,
      isAdsZoom: false,
    })
  },

  clearWeaponReveal: () => set({ weaponReveal: null }),
  clearLastAnswer: () => set({ lastAnswerResult: null }),

  resetToMenu: () => {
    saveSession(null)
    if (document.pointerLockElement) {
      document.exitPointerLock()
    }
    set({
      screen: 'menu',
      playerId: null,
      sessionToken: null,
      room: null,
      liveTransforms: new Map(),
      pendingSnapPos: null,
      activeQuestion: null,
      lastAnswerResult: null,
      mathModalOpen: false,
      weaponReveal: null,
      lastSkillBanner: null,
      hitMarker: null,
      lastDamageTaken: null,
      tracers: [],
      recentKills: [],
      matchSummary: null,
      pointerLocked: false,
      pauseOpen: false,
      scoreboardOpen: false,
      isAdsZoom: false,
      errorMessage: null,
    })
  },
}))

export function selectMyPlayer(state: GameState): PlayerPublicState | null {
  if (!state.room || !state.playerId) return null
  return state.room.players.find((p) => p.id === state.playerId) ?? null
}
