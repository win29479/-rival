import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { getSpawnForTeam, normalizeVec3, raycastArenaObstacles, raycastPlayerHitbox } from '../../shared/arena.ts'
import { pickNextQuestion, QUESTION_BY_ID, toPublicQuestion } from '../../shared/questions.ts'
import {
  MATCH_CONFIG,
  SCORING,
  type Difficulty,
  type KillFeedItem,
  type MatchPhase,
  type MatchSummary,
  type PlayerPublicState,
  type RoomSnapshot,
  type ScoreboardEntry,
  type ServerMessage,
  type ShotEvent,
  type Team,
  type Vec3,
  type WeaponId,
} from '../../shared/types.ts'
import { rollRandomWeapon, WEAPONS } from '../../shared/weapons.ts'
import { useGameStore } from '../store/useGameStore.ts'

interface DbRoomRow {
  room_code: string
  host_player_id: string
  phase: MatchPhase
  countdown_ends_at: string | null
  match_started_at: string | null
  match_ends_at: string | null
  max_players: number
}

interface DbPlayerRow {
  player_id: string
  room_code: string
  name: string
  team: Team
  ready: boolean
  is_host: boolean
  weapon: WeaponId | null
  kills: number
  deaths: number
  headshots: number
  correct_answers: number
  wrong_answers: number
  total_score: number
}

/**
 * Supabase Realtime + Authoritative PostgreSQL RPC Adapter.
 * Uses supabase/schema.sql RPCs (SECURITY DEFINER) for room creation, match start,
 * anti-duplicate math scoring, and kill recording, paired with Supabase Realtime Broadcast
 * for low-latency 3D positions, tracers, and hit notifications.
 */
export class SupabaseAdapter {
  private client: SupabaseClient | null = null
  private channel: RealtimeChannel | null = null
  private roomCode: string | null = null
  private playerId: string | null = null
  private sessionToken: string | null = null
  private onMessage: ((msg: ServerMessage) => void) | null = null
  private attemptedIds = new Set<string>()
  private activeQuestionId: string | null = null
  private matchPollTimer: number | null = null

  static isConfigured(): boolean {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim()
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
    return Boolean(url && key && !url.includes('your-project-id'))
  }

  setMessageHandler(handler: (msg: ServerMessage) => void): void {
    this.onMessage = handler
  }

  private getClient(): SupabaseClient {
    if (!this.client) {
      const url = import.meta.env.VITE_SUPABASE_URL?.trim()
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
      if (!url || !key) {
        throw new Error('ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY')
      }
      this.client = createClient(url, key, {
        realtime: { params: { eventsPerSecond: 20 } },
      })
    }
    return this.client
  }

  async createRoom(playerName: string): Promise<void> {
    const sb = this.getClient()
    useGameStore.getState().setConnectionStatus('connecting')
    const { data, error } = await sb.rpc('mr_create_room', { p_player_name: playerName })
    if (error || !data) {
      useGameStore.getState().setConnectionStatus('disconnected')
      throw new Error(error?.message ?? 'สร้างห้องบน Supabase ไม่สำเร็จ')
    }

    this.roomCode = data.room_code
    this.playerId = data.player_id
    this.sessionToken = data.session_token
    this.attemptedIds.clear()
    this.activeQuestionId = null

    await this.subscribeChannel(data.room_code)
    const snapshot = await this.fetchSnapshot(data.room_code)
    useGameStore.getState().setConnectionStatus('connected')
    this.onMessage?.({
      type: 'ROOM_JOINED',
      playerId: data.player_id,
      sessionToken: data.session_token,
      room: snapshot,
    })
  }

  async joinRoom(roomCode: string, playerName: string): Promise<void> {
    const sb = this.getClient()
    useGameStore.getState().setConnectionStatus('connecting')
    const { data, error } = await sb.rpc('mr_join_room', {
      p_room_code: roomCode.trim().toUpperCase(),
      p_player_name: playerName,
    })
    if (error || !data) {
      useGameStore.getState().setConnectionStatus('disconnected')
      throw new Error(error?.message ?? 'เข้าร่วมห้องไม่สำเร็จ')
    }

    this.roomCode = data.room_code
    this.playerId = data.player_id
    this.sessionToken = data.session_token
    this.attemptedIds.clear()
    this.activeQuestionId = null

    await this.subscribeChannel(data.room_code)
    const snapshot = await this.fetchSnapshot(data.room_code)
    useGameStore.getState().setConnectionStatus('connected')
    this.onMessage?.({
      type: 'ROOM_JOINED',
      playerId: data.player_id,
      sessionToken: data.session_token,
      room: snapshot,
    })
    this.channel?.send({ type: 'broadcast', event: 'room_refresh', payload: {} })
  }

  private async subscribeChannel(roomCode: string): Promise<void> {
    const sb = this.getClient()
    if (this.channel) {
      await sb.removeChannel(this.channel)
    }

    const ch = sb.channel(`math-rivals:${roomCode}`, {
      config: { broadcast: { self: false }, presence: { key: this.playerId ?? 'anon' } },
    })

    ch.on('broadcast', { event: 'room_refresh' }, async () => {
      if (!this.roomCode) return
      const snap = await this.fetchSnapshot(this.roomCode)
      this.onMessage?.({ type: 'ROOM_STATE', room: snap })
    })

    ch.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (!payload?.id) return
      this.onMessage?.({
        type: 'POSITIONS_SYNC',
        serverNow: Date.now(),
        positions: [payload],
      })
    })

    ch.on('broadcast', { event: 'shot' }, ({ payload }) => {
      if (payload) {
        this.onMessage?.({ type: 'SHOT_FIRED', shot: payload as ShotEvent })
      }
    })

    ch.on('broadcast', { event: 'kill' }, ({ payload }) => {
      if (payload) {
        this.onMessage?.({ type: 'KILL_EVENT', kill: payload as KillFeedItem })
      }
    })

    await new Promise<void>((resolve) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve()
      })
    })
    this.channel = ch
    this.startMatchLoop()
  }

  private startMatchLoop(): void {
    if (this.matchPollTimer !== null) window.clearInterval(this.matchPollTimer)
    this.matchPollTimer = window.setInterval(async () => {
      const room = useGameStore.getState().room
      if (!room || !this.roomCode) return
      const now = Date.now()
      if (room.phase === 'countdown' && room.countdownEndsAt && now >= room.countdownEndsAt) {
        this.onMessage?.({
          type: 'ROOM_STATE',
          room: { ...room, phase: 'playing', serverNow: now },
        })
      } else if (room.phase === 'playing' && room.matchEndsAt && now >= room.matchEndsAt) {
        const snap = await this.fetchSnapshot(this.roomCode)
        const summary = this.buildSummary(snap.roomCode, snap.scoreboard)
        this.onMessage?.({
          type: 'MATCH_FINISHED',
          summary,
          room: { ...snap, phase: 'finished', summary },
        })
      }
    }, 250)
  }

  private buildSummary(roomCode: string, standings: ScoreboardEntry[]): MatchSummary {
    const teamScores = { blue: 0, red: 0 }
    for (const s of standings) teamScores[s.team] += s.totalScore
    return {
      roomCode,
      finishedAt: Date.now(),
      winnerPlayer: standings[0] ?? null,
      winnerTeam:
        teamScores.blue > teamScores.red ? 'blue' : teamScores.red > teamScores.blue ? 'red' : 'draw',
      teamScores,
      standings,
    }
  }

  private async fetchSnapshot(roomCode: string): Promise<RoomSnapshot> {
    const sb = this.getClient()
    const [{ data: roomRow }, { data: playerRows }] = await Promise.all([
      sb.from('rooms').select('*').eq('room_code', roomCode).single(),
      sb.from('room_players_public').select('*').eq('room_code', roomCode),
    ])

    const r = roomRow as DbRoomRow
    const rows = (playerRows ?? []) as DbPlayerRow[]
    const now = Date.now()
    const countdownMs = r.countdown_ends_at ? Date.parse(r.countdown_ends_at) : null
    const matchEndMs = r.match_ends_at ? Date.parse(r.match_ends_at) : null

    let effectivePhase: MatchPhase = r.phase
    if (effectivePhase === 'countdown' && countdownMs && now >= countdownMs) {
      effectivePhase = 'playing'
    }
    if ((effectivePhase === 'playing' || effectivePhase === 'countdown') && matchEndMs && now >= matchEndMs) {
      effectivePhase = 'finished'
    }

    const transforms = useGameStore.getState().liveTransforms
    const players: PlayerPublicState[] = rows.map((p, idx) => {
      const existing = transforms.get(p.player_id)
      const spawn = getSpawnForTeam(p.team, idx)
      const spec = p.weapon ? WEAPONS[p.weapon] : null
      return {
        id: p.player_id,
        name: p.name,
        team: p.team,
        agent: 'vortex',
        ready: p.ready,
        connected: true,
        isHost: p.is_host,
        position: existing?.position ?? spawn.position,
        yaw: existing?.yaw ?? spawn.yaw,
        pitch: existing?.pitch ?? 0,
        hp: existing?.hp ?? MATCH_CONFIG.MAX_HP,
        maxHp: existing?.maxHp ?? MATCH_CONFIG.MAX_HP,
        alive: existing?.alive ?? true,
        respawnAt: existing?.respawnAt ?? null,
        weapon: p.weapon,
        ammo: existing?.ammo ?? spec?.magSize ?? 0,
        maxAmmo: spec?.magSize ?? 0,
        reloadingUntil: existing?.reloadingUntil ?? null,
        skillQReadyAt: existing?.skillQReadyAt ?? 0,
        skillCReadyAt: existing?.skillCReadyAt ?? 0,
        ultPoints: existing?.ultPoints ?? 0,
        ultMax: 4,
        overdriveUntil: existing?.overdriveUntil ?? null,
        overshieldUntil: existing?.overshieldUntil ?? null,
        blindedUntil: existing?.blindedUntil ?? null,
        revealedUntil: existing?.revealedUntil ?? null,
        kills: p.kills,
        deaths: p.deaths,
        headshots: p.headshots,
        correctAnswers: p.correct_answers,
        wrongAnswers: p.wrong_answers,
        totalScore: p.total_score,
        streak: 0,
      }
    })

    const scoreboard: ScoreboardEntry[] = players
      .map((p) => ({
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
      .sort((a, b) => b.totalScore - a.totalScore || b.kills - a.kills)
      .map((s, idx) => ({ ...s, rank: idx + 1 }))

    return {
      roomCode: r.room_code,
      hostId: r.host_player_id,
      phase: effectivePhase,
      serverNow: now,
      countdownEndsAt: countdownMs,
      matchStartedAt: r.match_started_at ? Date.parse(r.match_started_at) : null,
      matchEndsAt: matchEndMs,
      matchDurationSec: MATCH_CONFIG.DURATION_SEC,
      maxPlayers: r.max_players,
      players,
      scoreboard,
      killFeed: useGameStore.getState().recentKills,
      worldEffects: [],
      summary: effectivePhase === 'finished' ? this.buildSummary(r.room_code, scoreboard) : null,
    }
  }

  async startMatch(): Promise<void> {
    if (!this.roomCode || !this.playerId || !this.sessionToken) return
    const sb = this.getClient()
    const { error } = await sb.rpc('mr_start_match', {
      p_room_code: this.roomCode,
      p_player_id: this.playerId,
      p_session_token: this.sessionToken,
    })
    if (error) {
      this.onMessage?.({ type: 'ERROR', code: 'START_FAILED', message: error.message })
      return
    }
    this.attemptedIds.clear()
    this.activeQuestionId = null
    const snap = await this.fetchSnapshot(this.roomCode)
    this.onMessage?.({ type: 'ROOM_STATE', room: snap })
    this.channel?.send({ type: 'broadcast', event: 'room_refresh', payload: {} })
  }

  requestQuestion(preferredDifficulty?: Difficulty): void {
    const q = pickNextQuestion(this.attemptedIds, preferredDifficulty)
    if (!q) {
      this.onMessage?.({ type: 'ERROR', code: 'NO_MORE_QUESTIONS', message: 'ตอบครบทุกข้อในคลังแล้ว!' })
      return
    }
    this.activeQuestionId = q.id
    this.onMessage?.({ type: 'QUESTION_ASSIGNED', question: toPublicQuestion(q) })
  }

  async submitAnswer(questionId: string, selectedIndex: number): Promise<void> {
    if (!this.roomCode || !this.playerId || !this.sessionToken) return
    if (this.attemptedIds.has(questionId) || this.activeQuestionId !== questionId) {
      this.onMessage?.({
        type: 'ERROR',
        code: 'DUPLICATE_ANSWER',
        message: 'ไม่สามารถส่งคำตอบซ้ำได้',
      })
      return
    }

    const q = QUESTION_BY_ID.get(questionId)
    if (!q) return
    const correct = selectedIndex === q.correctIndex
    const currentWeapon = useGameStore.getState().room?.players.find((p) => p.id === this.playerId)?.weapon ?? null
    const awardedWeapon = correct ? rollRandomWeapon(q.difficulty, currentWeapon) : null

    const sb = this.getClient()
    const { data, error } = await sb.rpc('mr_record_math_answer', {
      p_room_code: this.roomCode,
      p_player_id: this.playerId,
      p_session_token: this.sessionToken,
      p_question_id: questionId,
      p_is_correct: correct,
      p_awarded_weapon: awardedWeapon,
    })

    if (error) {
      this.onMessage?.({ type: 'ERROR', code: 'ANSWER_REJECTED', message: error.message })
      return
    }

    this.attemptedIds.add(questionId)
    this.activeQuestionId = null
    this.onMessage?.({
      type: 'ANSWER_RESULT',
      result: {
        questionId,
        correct,
        pointsAwarded: data?.points_awarded ?? (correct ? SCORING.MATH_CORRECT : 0),
        awardedWeapon,
        correctIndex: q.correctIndex,
        correctChoiceText: q.choices[q.correctIndex],
        explanation: q.explanation,
        totalScore: data?.total_score ?? 0,
        correctAnswers: data?.correct_answers ?? 0,
      },
    })

    const snap = await this.fetchSnapshot(this.roomCode)
    this.onMessage?.({ type: 'ROOM_STATE', room: snap })
    this.channel?.send({ type: 'broadcast', event: 'room_refresh', payload: {} })
  }

  sendMove(position: Vec3, yaw: number, pitch: number): void {
    if (!this.channel || !this.playerId) return
    const me = useGameStore.getState().room?.players.find((p) => p.id === this.playerId)
    this.channel.send({
      type: 'broadcast',
      event: 'move',
      payload: {
        id: this.playerId,
        position,
        yaw,
        pitch,
        hp: me?.hp ?? 100,
        alive: me?.alive ?? true,
        respawnAt: me?.respawnAt ?? null,
        weapon: me?.weapon ?? null,
        ammo: me?.ammo ?? 0,
        reloadingUntil: me?.reloadingUntil ?? null,
      },
    })
  }

  async shoot(origin: Vec3, direction: Vec3): Promise<void> {
    if (!this.roomCode || !this.playerId || !this.sessionToken) return
    const state = useGameStore.getState()
    const me = state.room?.players.find((p) => p.id === this.playerId)
    if (!me || !me.weapon || !me.alive) return

    const spec = WEAPONS[me.weapon]
    const dir = normalizeVec3(direction)
    const wallDist = raycastArenaObstacles(origin, dir, spec.range)
    let hitTarget: { player: PlayerPublicState; distance: number; headshot: boolean } | null = null

    for (const candidate of state.room?.players ?? []) {
      if (candidate.id === me.id || candidate.team === me.team || !candidate.alive) continue
      const pos = state.liveTransforms.get(candidate.id)?.position ?? candidate.position
      const hit = raycastPlayerHitbox(origin, dir, pos, wallDist)
      if (hit && (!hitTarget || hit.distance < hitTarget.distance)) {
        hitTarget = { player: candidate, distance: hit.distance, headshot: hit.headshot }
      }
    }

    const endpoint = {
      x: origin.x + dir.x * (hitTarget?.distance ?? wallDist),
      y: origin.y + dir.y * (hitTarget?.distance ?? wallDist),
      z: origin.z + dir.z * (hitTarget?.distance ?? wallDist),
    }

    const shot: ShotEvent = {
      id: crypto.randomUUID(),
      shooterId: me.id,
      shooterTeam: me.team,
      weapon: me.weapon,
      origin,
      endpoints: [endpoint],
      hitPlayerId: hitTarget?.player.id,
      headshot: hitTarget?.headshot,
      timestamp: Date.now(),
    }

    this.onMessage?.({ type: 'SHOT_FIRED', shot })
    this.channel?.send({ type: 'broadcast', event: 'shot', payload: shot })

    if (hitTarget) {
      const dmg = hitTarget.headshot ? spec.headshotDamage : spec.damage
      const nextHp = Math.max(0, hitTarget.player.hp - dmg)
      const killed = nextHp <= 0
      const points = killed ? SCORING.KILL + (hitTarget.headshot ? SCORING.HEADSHOT_BONUS : 0) : 0

      this.onMessage?.({
        type: 'HIT_CONFIRMED',
        hit: {
          victimId: hitTarget.player.id,
          victimName: hitTarget.player.name,
          damage: dmg,
          headshot: hitTarget.headshot,
          killed,
          pointsAwarded: points,
        },
      })

      if (killed) {
        const sb = this.getClient()
        await sb.rpc('mr_record_kill', {
          p_room_code: this.roomCode,
          p_killer_id: this.playerId,
          p_session_token: this.sessionToken,
          p_victim_id: hitTarget.player.id,
          p_weapon: me.weapon,
          p_headshot: hitTarget.headshot,
        })
        const kill: KillFeedItem = {
          id: crypto.randomUUID(),
          killerId: me.id,
          killerName: me.name,
          killerTeam: me.team,
          victimId: hitTarget.player.id,
          victimName: hitTarget.player.name,
          victimTeam: hitTarget.player.team,
          weapon: me.weapon,
          headshot: hitTarget.headshot,
          pointsAwarded: points,
          timestamp: Date.now(),
        }
        this.onMessage?.({ type: 'KILL_EVENT', kill })
        this.channel?.send({ type: 'broadcast', event: 'kill', payload: kill })
        const snap = await this.fetchSnapshot(this.roomCode)
        this.onMessage?.({ type: 'ROOM_STATE', room: snap })
        this.channel?.send({ type: 'broadcast', event: 'room_refresh', payload: {} })
      }
    }
  }

  disconnect(): void {
    if (this.matchPollTimer !== null) {
      window.clearInterval(this.matchPollTimer)
      this.matchPollTimer = null
    }
    if (this.channel && this.client) {
      void this.client.removeChannel(this.channel)
      this.channel = null
    }
    this.roomCode = null
    this.playerId = null
    this.sessionToken = null
    useGameStore.getState().setConnectionStatus('disconnected')
  }
}
