import crypto from 'node:crypto'
import http from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import type { ClientMessage, ServerMessage } from '../shared/types.ts'
import { RoomManager, type CombatHitRecord } from './roomManager.ts'

interface ClientSession {
  id: string
  transport: 'ws' | 'http'
  ws: WebSocket | null
  httpQueue: ServerMessage[]
  lastSeenAt: number
  roomCode: string | null
  playerId: string | null
}

const PORT = Number(process.env.PORT ?? 3001)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '*'
const HTTP_SESSION_TIMEOUT_MS = 12_000

const manager = new RoomManager()
const clients = new Set<ClientSession>()
const httpSessions = new Map<string, ClientSession>()
const playerSockets = new Map<string, ClientSession>()
const startedAt = Date.now()

function sendToSession(session: ClientSession, msg: ServerMessage): void {
  if (session.transport === 'ws') {
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify(msg))
    }
  } else {
    // Coalesce high-frequency POSITIONS_SYNC so HTTP queues never grow stale
    if (msg.type === 'POSITIONS_SYNC') {
      const existingIdx = session.httpQueue.findIndex((m) => m.type === 'POSITIONS_SYNC')
      if (existingIdx >= 0) {
        session.httpQueue[existingIdx] = msg
        return
      }
    }
    session.httpQueue.push(msg)
    if (session.httpQueue.length > 120) {
      session.httpQueue.splice(0, session.httpQueue.length - 120)
    }
  }
}

function broadcastToRoom(roomCode: string, msg: ServerMessage, excludePlayerId?: string): void {
  let serialized: string | null = null
  for (const session of clients) {
    if (session.roomCode !== roomCode || session.playerId === excludePlayerId) continue
    if (session.transport === 'ws') {
      if (session.ws && session.ws.readyState === WebSocket.OPEN) {
        if (serialized === null) serialized = JSON.stringify(msg)
        session.ws.send(serialized)
      }
    } else {
      sendToSession(session, msg)
    }
  }
}

function broadcastRoomState(roomCode: string): void {
  const room = manager.getRoom(roomCode)
  if (!room) return
  broadcastToRoom(roomCode, {
    type: 'ROOM_STATE',
    room: manager.buildSnapshot(room),
  })
}

function emitCombatHits(roomCode: string, attackerId: string, hits: CombatHitRecord[]): void {
  const attackerSocket = playerSockets.get(attackerId)
  for (const hit of hits) {
    if (attackerSocket) {
      sendToSession(attackerSocket, { type: 'HIT_CONFIRMED', hit: hit.confirm })
    }
    const victimSocket = playerSockets.get(hit.victimId)
    if (victimSocket) {
      sendToSession(victimSocket, { type: 'DAMAGE_TAKEN', damage: hit.damageTaken })
    }
    if (hit.killEvent) {
      broadcastToRoom(roomCode, { type: 'KILL_EVENT', kill: hit.killEvent })
    }
  }
}

function closeSession(session: ClientSession): void {
  clients.delete(session)
  if (session.transport === 'http') {
    httpSessions.delete(session.id)
  }
  if (session.playerId && playerSockets.get(session.playerId) === session) {
    playerSockets.delete(session.playerId)
  }
  if (session.roomCode && session.playerId) {
    const updated = manager.markDisconnected(session.roomCode, session.playerId, false)
    if (updated) {
      broadcastToRoom(session.roomCode, { type: 'ROOM_STATE', room: updated })
    }
  }
}

function handleClientMessage(session: ClientSession, msg: ClientMessage): void {
  session.lastSeenAt = Date.now()

  switch (msg.type) {
    case 'PING': {
      sendToSession(session, { type: 'PONG', clientTime: msg.clientTime, serverNow: Date.now() })
      break
    }

    case 'CREATE_ROOM': {
      if (session.roomCode && session.playerId) {
        manager.markDisconnected(session.roomCode, session.playerId, true)
        broadcastRoomState(session.roomCode)
      }
      const created = manager.createRoom(msg.playerName ?? '')
      session.roomCode = created.roomCode
      session.playerId = created.playerId
      playerSockets.set(created.playerId, session)
      sendToSession(session, {
        type: 'ROOM_JOINED',
        playerId: created.playerId,
        sessionToken: created.sessionToken,
        room: created.snapshot,
      })
      break
    }

    case 'JOIN_ROOM': {
      if (session.roomCode && session.playerId) {
        manager.markDisconnected(session.roomCode, session.playerId, true)
        broadcastRoomState(session.roomCode)
      }
      const res = manager.joinRoom(msg.roomCode ?? '', msg.playerName ?? '')
      if (!res.ok) {
        sendToSession(session, { type: 'ERROR', code: res.code, message: res.message })
        break
      }
      session.roomCode = res.roomCode
      session.playerId = res.playerId
      playerSockets.set(res.playerId, session)
      sendToSession(session, {
        type: 'ROOM_JOINED',
        playerId: res.playerId,
        sessionToken: res.sessionToken,
        room: res.snapshot,
      })
      broadcastToRoom(res.roomCode, { type: 'ROOM_STATE', room: res.snapshot }, res.playerId)
      break
    }

    case 'RECONNECT': {
      const res = manager.reconnectPlayer(msg.roomCode ?? '', msg.playerId ?? '', msg.sessionToken ?? '')
      if (!res.ok) {
        sendToSession(session, { type: 'ERROR', code: res.code, message: res.message })
        break
      }
      const old = playerSockets.get(msg.playerId)
      if (old && old !== session) {
        old.roomCode = null
        old.playerId = null
        if (old.transport === 'ws') {
          old.ws?.close(1000, 'Reconnected on a new session')
        } else {
          httpSessions.delete(old.id)
          clients.delete(old)
        }
      }
      session.roomCode = res.roomCode
      session.playerId = msg.playerId
      playerSockets.set(msg.playerId, session)
      sendToSession(session, {
        type: 'ROOM_JOINED',
        playerId: msg.playerId,
        sessionToken: msg.sessionToken,
        room: res.snapshot,
      })
      broadcastToRoom(res.roomCode, { type: 'ROOM_STATE', room: res.snapshot }, msg.playerId)
      break
    }

    case 'LEAVE_ROOM': {
      if (session.roomCode && session.playerId) {
        const code = session.roomCode
        const pid = session.playerId
        session.roomCode = null
        session.playerId = null
        playerSockets.delete(pid)
        const updated = manager.markDisconnected(code, pid, true)
        if (updated) {
          broadcastToRoom(code, { type: 'ROOM_STATE', room: updated })
        }
      }
      break
    }

    case 'SET_READY': {
      if (!session.roomCode || !session.playerId) return
      const res = manager.setReady(session.roomCode, session.playerId, msg.ready)
      if (!res.ok) {
        sendToSession(session, { type: 'ERROR', code: res.code, message: res.message })
      } else {
        broadcastToRoom(session.roomCode, { type: 'ROOM_STATE', room: res.snapshot })
      }
      break
    }

    case 'SWITCH_TEAM': {
      if (!session.roomCode || !session.playerId) return
      const res = manager.switchTeam(session.roomCode, session.playerId, msg.team)
      if (!res.ok) {
        sendToSession(session, { type: 'ERROR', code: res.code, message: res.message })
      } else {
        broadcastToRoom(session.roomCode, { type: 'ROOM_STATE', room: res.snapshot })
      }
      break
    }

    case 'SELECT_AGENT': {
      if (!session.roomCode || !session.playerId) return
      const res = manager.selectAgent(session.roomCode, session.playerId, msg.agent)
      if (!res.ok) {
        sendToSession(session, { type: 'ERROR', code: res.code, message: res.message })
      } else {
        broadcastToRoom(session.roomCode, { type: 'ROOM_STATE', room: res.snapshot })
      }
      break
    }

    case 'START_MATCH': {
      if (!session.roomCode || !session.playerId) return
      const res = manager.startMatch(session.roomCode, session.playerId)
      if (!res.ok) {
        sendToSession(session, { type: 'ERROR', code: res.code, message: res.message })
      } else {
        broadcastToRoom(session.roomCode, { type: 'ROOM_STATE', room: res.snapshot })
      }
      break
    }

    case 'RETURN_TO_LOBBY': {
      if (!session.roomCode || !session.playerId) return
      const res = manager.returnToLobby(session.roomCode, session.playerId)
      if (!res.ok) {
        sendToSession(session, { type: 'ERROR', code: res.code, message: res.message })
      } else {
        broadcastToRoom(session.roomCode, { type: 'ROOM_STATE', room: res.snapshot })
      }
      break
    }

    case 'PLAYER_MOVE': {
      if (!session.roomCode || !session.playerId) return
      manager.updatePlayerMove(session.roomCode, session.playerId, msg.position, msg.yaw, msg.pitch)
      break
    }

    case 'REQUEST_QUESTION': {
      if (!session.roomCode || !session.playerId) return
      const res = manager.requestQuestion(session.roomCode, session.playerId, msg.preferredDifficulty)
      if (!res.ok) {
        sendToSession(session, { type: 'ERROR', code: res.code, message: res.message })
      } else {
        sendToSession(session, { type: 'QUESTION_ASSIGNED', question: res.question })
      }
      break
    }

    case 'SUBMIT_ANSWER': {
      if (!session.roomCode || !session.playerId) return
      const res = manager.submitAnswer(
        session.roomCode,
        session.playerId,
        msg.questionId,
        msg.selectedIndex,
      )
      if (!res.ok) {
        sendToSession(session, { type: 'ERROR', code: res.code, message: res.message })
      } else {
        sendToSession(session, { type: 'ANSWER_RESULT', result: res.result })
        broadcastToRoom(session.roomCode, { type: 'ROOM_STATE', room: res.snapshot })
      }
      break
    }

    case 'RELOAD': {
      if (!session.roomCode || !session.playerId) return
      const res = manager.startReload(session.roomCode, session.playerId)
      if (res.ok) {
        broadcastRoomState(session.roomCode)
      }
      break
    }

    case 'USE_SKILL': {
      if (!session.roomCode || !session.playerId) return
      const res = manager.useSkill(
        session.roomCode,
        session.playerId,
        msg.slot,
        msg.origin,
        msg.direction,
      )
      if (!res.ok) {
        if (res.code === 'ULT_NOT_READY') {
          sendToSession(session, { type: 'ERROR', code: res.code, message: res.message })
        }
        return
      }

      broadcastToRoom(session.roomCode, { type: 'SKILL_CAST', cast: res.outcome.cast })
      emitCombatHits(session.roomCode, session.playerId, res.outcome.hits)

      if (res.outcome.roomStateChanged || res.outcome.scoreboardChanged) {
        broadcastRoomState(session.roomCode)
      }
      break
    }

    case 'SHOOT': {
      if (!session.roomCode || !session.playerId) return
      const res = manager.shoot(session.roomCode, session.playerId, msg.origin, msg.direction)
      if (!res.ok) {
        if (res.code === 'NO_WEAPON') {
          sendToSession(session, { type: 'ERROR', code: res.code, message: res.message })
        }
        return
      }

      broadcastToRoom(session.roomCode, { type: 'SHOT_FIRED', shot: res.outcome.shot })
      emitCombatHits(session.roomCode, session.playerId, res.outcome.hits)

      if (res.scoreboardChanged) {
        broadcastRoomState(session.roomCode)
      }
      break
    }
  }
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => {
      raw += chunk.toString('utf8')
      if (raw.length > 16384) {
        reject(new Error('PAYLOAD_TOO_LARGE'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('BAD_JSON'))
      }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const parsedUrl = new URL(req.url ?? '/', 'http://localhost')
  const pathname = parsedUrl.pathname

  if (pathname === '/health' || pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        service: 'math-rivals-3d-server',
        status: 'ok',
        transports: ['ws', 'http-poll'],
        rooms: manager.getRoomCount(),
        players: manager.getTotalConnectedPlayers(),
        uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      }),
    )
    return
  }

  // HTTP Realtime Fallback Transport (for proxies/firewalls that block WebSocket upgrades)
  if (pathname === '/api/connect' && req.method === 'POST') {
    const sid = crypto.randomBytes(16).toString('hex')
    const session: ClientSession = {
      id: sid,
      transport: 'http',
      ws: null,
      httpQueue: [],
      lastSeenAt: Date.now(),
      roomCode: null,
      playerId: null,
    }
    clients.add(session)
    httpSessions.set(sid, session)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ sid, serverNow: Date.now() }))
    return
  }

  if (pathname === '/api/msg' && req.method === 'POST') {
    try {
      const body = (await readJsonBody(req)) as { sid?: string; message?: ClientMessage }
      const session = body.sid ? httpSessions.get(body.sid) : undefined
      if (!session || !body.message) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'INVALID_SESSION' }))
        return
      }
      handleClientMessage(session, body.message)
      const messages = session.httpQueue.splice(0, session.httpQueue.length)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ messages }))
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'BAD_REQUEST' }))
    }
    return
  }

  if (pathname === '/api/poll' && req.method === 'GET') {
    const sid = parsedUrl.searchParams.get('sid') ?? ''
    const session = httpSessions.get(sid)
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'SESSION_EXPIRED' }))
      return
    }
    session.lastSeenAt = Date.now()
    const messages = session.httpQueue.splice(0, session.httpQueue.length)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ messages }))
    return
  }

  if (pathname === '/api/disconnect' && req.method === 'POST') {
    try {
      const body = (await readJsonBody(req)) as { sid?: string }
      const session = body.sid ? httpSessions.get(body.sid) : undefined
      if (session) closeSession(session)
    } catch {
      // Ignore disconnect parse errors
    }
    res.writeHead(204)
    res.end()
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not Found' }))
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  const session: ClientSession = {
    id: crypto.randomBytes(12).toString('hex'),
    transport: 'ws',
    ws,
    httpQueue: [],
    lastSeenAt: Date.now(),
    roomCode: null,
    playerId: null,
  }
  clients.add(session)

  ws.on('message', (raw) => {
    let msg: ClientMessage
    try {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8')
      if (text.length > 8192) {
        sendToSession(session, { type: 'ERROR', code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' })
        return
      }
      msg = JSON.parse(text) as ClientMessage
    } catch {
      sendToSession(session, { type: 'ERROR', code: 'BAD_JSON', message: 'Invalid JSON payload' })
      return
    }
    handleClientMessage(session, msg)
  })

  ws.on('close', () => {
    closeSession(session)
  })
})

// 20 Hz Authoritative Simulation & Position Sync Loop
setInterval(() => {
  const now = Date.now()

  // Expire inactive HTTP-poll sessions (browser tab closed)
  for (const session of httpSessions.values()) {
    if (now - session.lastSeenAt > HTTP_SESSION_TIMEOUT_MS) {
      closeSession(session)
    }
  }

  const transitions = manager.tick()
  for (const t of transitions) {
    if (t.type === 'MATCH_FINISHED' && t.summary) {
      const room = manager.getRoom(t.roomCode)
      if (room) {
        broadcastToRoom(t.roomCode, {
          type: 'MATCH_FINISHED',
          summary: t.summary,
          room: manager.buildSnapshot(room),
        })
      }
    } else if (t.type === 'ORBITAL_DETONATED' && t.hits && t.attackerId) {
      emitCombatHits(t.roomCode, t.attackerId, t.hits)
      broadcastRoomState(t.roomCode)
    } else if (
      t.type === 'PHASE_PLAYING' ||
      t.type === 'RESPAWNED' ||
      t.type === 'RELOADED' ||
      t.type === 'EFFECTS_UPDATED'
    ) {
      broadcastRoomState(t.roomCode)
    }
  }

  for (const code of manager.getAllRoomCodes()) {
    const room = manager.getRoom(code)
    if (!room || (room.phase !== 'playing' && room.phase !== 'countdown')) continue
    const positions = Array.from(room.players.values()).map((p) => ({
      id: p.id,
      position: p.position,
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
    }))
    broadcastToRoom(code, { type: 'POSITIONS_SYNC', serverNow: now, positions })
  }
}, 50)

server.listen(PORT, () => {
  console.log(`[MATH RIVALS 3D] Authoritative Game Server listening on http://localhost:${PORT} (WS + HTTP fallback)`)
})
