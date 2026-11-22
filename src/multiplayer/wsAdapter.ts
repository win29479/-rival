import type { ClientMessage, ServerMessage } from '../../shared/types.ts'
import { loadSession, useGameStore } from '../store/useGameStore.ts'

export function resolveWebSocketUrl(): string {
  const configured = import.meta.env.VITE_WS_URL?.trim()
  if (configured) return configured
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
}

function resolveHttpApiBase(): string {
  const configured = import.meta.env.VITE_WS_URL?.trim()
  if (configured) {
    return configured
      .replace(/^wss:\/\//i, 'https://')
      .replace(/^ws:\/\//i, 'http://')
      .replace(/\/ws\/?$/i, '')
  }
  return ''
}

export class WebSocketAdapter {
  private ws: WebSocket | null = null
  private httpSid: string | null = null
  private pollTimer: number | null = null
  private pollInFlight = false
  private reconnectTimer: number | null = null
  private pingTimer: number | null = null
  private manualClose = false
  private pendingQueue: ClientMessage[] = []
  private connectPromise: Promise<void> | null = null
  private onMessageCallback: ((msg: ServerMessage) => void) | null = null

  setMessageHandler(handler: (msg: ServerMessage) => void): void {
    this.onMessageCallback = handler
  }

  private isConnected(): boolean {
    return Boolean(
      (this.ws && this.ws.readyState === WebSocket.OPEN) || this.httpSid !== null,
    )
  }

  async ensureConnected(): Promise<void> {
    if (this.isConnected()) return
    if (this.connectPromise) return this.connectPromise

    this.manualClose = false
    const store = useGameStore.getState()
    store.setConnectionStatus(store.connectionStatus === 'reconnecting' ? 'reconnecting' : 'connecting')

    this.connectPromise = (async () => {
      try {
        await this.connectWebSocket(1800)
      } catch {
        // Proxy or firewall blocked WebSocket upgrade -> seamlessly fall back to HTTP Realtime!
        await this.connectHttpFallback()
      } finally {
        this.connectPromise = null
      }
    })()

    return this.connectPromise
  }

  private connectWebSocket(timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const url = resolveWebSocketUrl()
      let ws: WebSocket
      try {
        ws = new WebSocket(url)
      } catch (err) {
        reject(err)
        return
      }
      this.ws = ws

      let settled = false
      const timeoutId = window.setTimeout(() => {
        if (!settled) {
          settled = true
          try {
            ws.close()
          } catch {
            // Ignore close errors
          }
          if (this.ws === ws) this.ws = null
          reject(new Error('WS_TIMEOUT'))
        }
      }, timeoutMs)

      ws.onopen = () => {
        window.clearTimeout(timeoutId)
        settled = true
        useGameStore.getState().setConnectionStatus('connected')
        useGameStore.getState().setError(null)
        this.startPingLoop()
        this.flushPendingQueue()
        resolve()
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as ServerMessage
          this.onMessageCallback?.(msg)
        } catch {
          // Ignore malformed message
        }
      }

      ws.onerror = () => {
        if (!settled) {
          window.clearTimeout(timeoutId)
          settled = true
          if (this.ws === ws) this.ws = null
          reject(new Error('WS_FAILED'))
        }
      }

      ws.onclose = () => {
        if (!settled) {
          window.clearTimeout(timeoutId)
          settled = true
          if (this.ws === ws) this.ws = null
          reject(new Error('WS_CLOSED'))
          return
        }
        this.stopPingLoop()
        if (this.ws === ws) this.ws = null
        if (this.manualClose || this.httpSid !== null) {
          if (this.manualClose) useGameStore.getState().setConnectionStatus('disconnected')
          return
        }
        this.triggerAutoReconnectIfNeeded()
      }
    })
  }

  private async connectHttpFallback(): Promise<void> {
    const base = resolveHttpApiBase()
    const res = await fetch(`${base}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      useGameStore.getState().setConnectionStatus('disconnected')
      throw new Error('ไม่สามารถเชื่อมต่อ Game Server ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์ทำงานอยู่')
    }
    const data = (await res.json()) as { sid: string; serverNow: number }
    this.httpSid = data.sid
    useGameStore.getState().setClockOffset(data.serverNow)
    useGameStore.getState().setConnectionStatus('connected')
    useGameStore.getState().setError(null)

    this.startHttpPolling()
    this.startPingLoop()
    this.flushPendingQueue()
  }

  private startHttpPolling(): void {
    this.stopHttpPolling()
    const base = resolveHttpApiBase()
    this.pollTimer = window.setInterval(async () => {
      if (!this.httpSid || this.pollInFlight) return
      this.pollInFlight = true
      try {
        const res = await fetch(`${base}/api/poll?sid=${encodeURIComponent(this.httpSid)}`, {
          cache: 'no-store',
        })
        if (res.status === 404) {
          this.stopHttpPolling()
          this.httpSid = null
          this.triggerAutoReconnectIfNeeded()
          return
        }
        if (res.ok) {
          const data = (await res.json()) as { messages?: ServerMessage[] }
          if (Array.isArray(data.messages)) {
            for (const m of data.messages) {
              this.onMessageCallback?.(m)
            }
          }
        }
      } catch {
        // Ignore single transient poll hiccup
      } finally {
        this.pollInFlight = false
      }
    }, 90)
  }

  private stopHttpPolling(): void {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.pollInFlight = false
  }

  private flushPendingQueue(): void {
    const queued = [...this.pendingQueue]
    this.pendingQueue = []
    for (const m of queued) {
      this.sendRaw(m)
    }
  }

  private triggerAutoReconnectIfNeeded(): void {
    const saved = loadSession()
    const currentRoom = useGameStore.getState().room
    if (saved && currentRoom) {
      useGameStore.getState().setConnectionStatus('reconnecting')
      this.scheduleReconnect(saved.roomCode, saved.playerId, saved.sessionToken)
    } else {
      useGameStore.getState().setConnectionStatus('disconnected')
    }
  }

  private scheduleReconnect(roomCode: string, playerId: string, sessionToken: string): void {
    if (this.reconnectTimer !== null) return
    this.reconnectTimer = window.setTimeout(async () => {
      this.reconnectTimer = null
      try {
        await this.ensureConnected()
        this.sendRaw({
          type: 'RECONNECT',
          roomCode,
          playerId,
          sessionToken,
        })
      } catch {
        if (!this.manualClose && loadSession()) {
          this.scheduleReconnect(roomCode, playerId, sessionToken)
        }
      }
    }, 1200)
  }

  private startPingLoop(): void {
    this.stopPingLoop()
    this.sendRaw({ type: 'PING', clientTime: Date.now() })
    this.pingTimer = window.setInterval(() => {
      this.sendRaw({ type: 'PING', clientTime: Date.now() })
    }, 5000)
  }

  private stopPingLoop(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  sendRaw(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
      return
    }
    if (this.httpSid) {
      const sid = this.httpSid
      const base = resolveHttpApiBase()
      void fetch(`${base}/api/msg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid, message: msg }),
      })
        .then(async (res) => {
          if (!res.ok) return
          const data = (await res.json()) as { messages?: ServerMessage[] }
          if (Array.isArray(data.messages)) {
            for (const m of data.messages) {
              this.onMessageCallback?.(m)
            }
          }
        })
        .catch(() => {})
      return
    }
    if (msg.type !== 'PLAYER_MOVE' && msg.type !== 'PING') {
      this.pendingQueue.push(msg)
    }
  }

  disconnect(): void {
    this.manualClose = true
    this.stopPingLoop()
    this.stopHttpPolling()
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.pendingQueue = []
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    if (this.httpSid) {
      const sid = this.httpSid
      this.httpSid = null
      const base = resolveHttpApiBase()
      void fetch(`${base}/api/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid }),
      }).catch(() => {})
    }
    useGameStore.getState().setConnectionStatus('disconnected')
  }
}
