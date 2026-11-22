import type { AgentId, Difficulty, ServerMessage, SkillSlot, Team, Vec3 } from '../../shared/types.ts'
import { soundEngine } from '../game/sound.ts'
import { loadSession, useGameStore } from '../store/useGameStore.ts'
import { SupabaseAdapter } from './supabaseAdapter.ts'
import { WebSocketAdapter } from './wsAdapter.ts'

function resolveTransportMode(): 'ws' | 'supabase' {
  const envMode = import.meta.env.VITE_MULTIPLAYER_MODE?.trim().toLowerCase()
  if (envMode === 'supabase' && SupabaseAdapter.isConfigured()) {
    return 'supabase'
  }
  return 'ws'
}

class MultiplayerClient {
  private readonly mode: 'ws' | 'supabase'
  private readonly ws = new WebSocketAdapter()
  private readonly sb = new SupabaseAdapter()
  private lastMoveSentAt = 0

  constructor() {
    this.mode = resolveTransportMode()
    useGameStore.getState().setTransportMode(this.mode)
    this.ws.setMessageHandler((msg) => this.handleServerMessage(msg))
    this.sb.setMessageHandler((msg) => this.handleServerMessage(msg))
  }

  getMode(): 'ws' | 'supabase' {
    return this.mode
  }

  private handleServerMessage(msg: ServerMessage): void {
    const store = useGameStore.getState()
    switch (msg.type) {
      case 'PONG': {
        const rtt = Date.now() - msg.clientTime
        store.setClockOffset(msg.serverNow + rtt / 2)
        break
      }
      case 'ROOM_JOINED':
        store.onRoomJoined(msg.playerId, msg.sessionToken, msg.room)
        break
      case 'ROOM_STATE':
        store.onRoomState(msg.room)
        break
      case 'POSITIONS_SYNC':
        store.onPositionsSync(msg.serverNow, msg.positions)
        break
      case 'QUESTION_ASSIGNED':
        store.onQuestionAssigned(msg.question)
        break
      case 'ANSWER_RESULT':
        store.onAnswerResult(msg.result)
        if (msg.result.correct) {
          soundEngine.playMathCorrect()
          window.setTimeout(() => soundEngine.playWeaponReveal(), 160)
        } else {
          soundEngine.playMathWrong()
        }
        break
      case 'SHOT_FIRED':
        store.onShotFired(msg.shot)
        if (msg.shot.shooterId !== store.playerId) {
          soundEngine.playWeaponFire(msg.shot.weapon, 0.32)
        }
        break
      case 'SKILL_CAST':
        store.onSkillCast(msg.cast)
        soundEngine.playSkillCast(msg.cast.skillId, msg.cast.playerId === store.playerId ? 1 : 0.45)
        break
      case 'HIT_CONFIRMED':
        store.onHitConfirmed(msg.hit)
        soundEngine.playHitMarker(msg.hit.headshot, msg.hit.killed)
        break
      case 'DAMAGE_TAKEN':
        store.onDamageTaken(msg.damage)
        soundEngine.playDamageTaken()
        break
      case 'KILL_EVENT':
        store.onKillEvent(msg.kill)
        break
      case 'MATCH_FINISHED':
        store.onMatchFinished(msg.summary, msg.room)
        soundEngine.playMatchEnd()
        break
      case 'ERROR':
        store.setError(msg.message)
        break
    }
  }

  async createRoom(playerName: string): Promise<void> {
    const clean = playerName.trim() || 'Rival'
    useGameStore.getState().setPlayerName(clean)
    useGameStore.getState().setError(null)
    try {
      if (this.mode === 'supabase') {
        await this.sb.createRoom(clean)
      } else {
        await this.ws.ensureConnected()
        this.ws.sendRaw({ type: 'CREATE_ROOM', playerName: clean })
      }
    } catch (err) {
      useGameStore.getState().setError(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ')
    }
  }

  async joinRoom(roomCode: string, playerName: string): Promise<void> {
    const cleanName = playerName.trim() || 'Rival'
    const cleanCode = roomCode.trim().toUpperCase()
    if (cleanCode.length !== 6) {
      useGameStore.getState().setError('รหัสห้องต้องมีความยาว 6 ตัวอักษร')
      return
    }
    useGameStore.getState().setPlayerName(cleanName)
    useGameStore.getState().setError(null)
    try {
      if (this.mode === 'supabase') {
        await this.sb.joinRoom(cleanCode, cleanName)
      } else {
        await this.ws.ensureConnected()
        this.ws.sendRaw({ type: 'JOIN_ROOM', roomCode: cleanCode, playerName: cleanName })
      }
    } catch (err) {
      useGameStore.getState().setError(err instanceof Error ? err.message : 'เข้าร่วมห้องไม่สำเร็จ')
    }
  }

  async tryReconnectSavedSession(): Promise<boolean> {
    if (this.mode !== 'ws') return false
    const saved = loadSession()
    if (!saved) return false
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this.ws.ensureConnected()
        this.ws.sendRaw({
          type: 'RECONNECT',
          roomCode: saved.roomCode,
          playerId: saved.playerId,
          sessionToken: saved.sessionToken,
        })
        return true
      } catch {
        if (attempt === 0) {
          await new Promise((r) => window.setTimeout(r, 350))
        }
      }
    }
    return false
  }

  setReady(ready: boolean): void {
    if (this.mode === 'ws') {
      this.ws.sendRaw({ type: 'SET_READY', ready })
    }
  }

  switchTeam(team: Team): void {
    if (this.mode === 'ws') {
      this.ws.sendRaw({ type: 'SWITCH_TEAM', team })
    }
  }

  selectAgent(agent: AgentId): void {
    if (this.mode === 'ws') {
      this.ws.sendRaw({ type: 'SELECT_AGENT', agent })
    }
  }

  startMatch(): void {
    if (this.mode === 'supabase') {
      void this.sb.startMatch()
    } else {
      this.ws.sendRaw({ type: 'START_MATCH' })
    }
  }

  returnToLobby(): void {
    if (this.mode === 'ws') {
      this.ws.sendRaw({ type: 'RETURN_TO_LOBBY' })
    }
  }

  leaveRoom(): void {
    if (this.mode === 'ws') {
      this.ws.sendRaw({ type: 'LEAVE_ROOM' })
      this.ws.disconnect()
    } else {
      this.sb.disconnect()
    }
    useGameStore.getState().resetToMenu()
  }

  sendMove(position: Vec3, yaw: number, pitch: number): void {
    const now = performance.now()
    if (now - this.lastMoveSentAt < 45) return
    this.lastMoveSentAt = now
    if (this.mode === 'supabase') {
      this.sb.sendMove(position, yaw, pitch)
    } else {
      this.ws.sendRaw({ type: 'PLAYER_MOVE', position, yaw, pitch })
    }
  }

  requestQuestion(preferredDifficulty?: Difficulty): void {
    if (this.mode === 'supabase') {
      this.sb.requestQuestion(preferredDifficulty)
    } else {
      this.ws.sendRaw({ type: 'REQUEST_QUESTION', preferredDifficulty })
    }
  }

  submitAnswer(questionId: string, selectedIndex: number): void {
    if (this.mode === 'supabase') {
      void this.sb.submitAnswer(questionId, selectedIndex)
    } else {
      this.ws.sendRaw({ type: 'SUBMIT_ANSWER', questionId, selectedIndex })
    }
  }

  shoot(origin: Vec3, direction: Vec3): void {
    if (this.mode === 'supabase') {
      void this.sb.shoot(origin, direction)
    } else {
      this.ws.sendRaw({ type: 'SHOOT', origin, direction })
    }
  }

  useSkill(slot: SkillSlot, origin: Vec3, direction: Vec3): void {
    if (this.mode === 'ws') {
      this.ws.sendRaw({ type: 'USE_SKILL', slot, origin, direction })
    }
  }

  reload(): void {
    if (this.mode === 'ws') {
      this.ws.sendRaw({ type: 'RELOAD' })
    }
  }
}

export const multiplayerClient = new MultiplayerClient()
