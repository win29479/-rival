import { ArrowLeftRight, Check, Copy, Crown, LogOut, Play, Shield, Sparkles, Users } from 'lucide-react'
import { useState } from 'react'
import { AGENT_IDS, AGENTS } from '../../shared/agents.ts'
import { MATCH_CONFIG, type PlayerPublicState } from '../../shared/types.ts'
import { multiplayerClient } from '../multiplayer/client.ts'
import { selectMyPlayer, useGameStore } from '../store/useGameStore.ts'

function TeamRoster({
  title,
  team,
  players,
  myId,
  canSwitch,
  onSwitch,
}: {
  title: string
  team: 'blue' | 'red'
  players: PlayerPublicState[]
  myId: string | null
  canSwitch: boolean
  onSwitch: () => void
}) {
  const isBlue = team === 'blue'
  return (
    <div
      className={`hud-panel hud-cut border p-4 flex flex-col justify-between space-y-3 ${
        isBlue ? 'border-cyan-500/45' : 'border-rose-500/45'
      }`}
    >
      <div className="space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Shield className={`w-4 h-4 ${isBlue ? 'text-cyan-400' : 'text-rose-500'}`} />
            <h3
              className={`font-display text-base font-extrabold tracking-wider uppercase ${
                isBlue ? 'text-cyan-300' : 'text-rose-400'
              }`}
            >
              {title}
            </h3>
          </div>
          <span className="font-display text-xs text-slate-400">
            {players.length} / {MATCH_CONFIG.MAX_PLAYERS / 2}
          </span>
        </div>

        <div className="space-y-1.5 min-h-[140px]">
          {players.map((p) => {
            const agent = AGENTS[p.agent]
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between px-3 py-2 border ${
                  p.id === myId
                    ? isBlue
                      ? 'bg-cyan-950/55 border-cyan-400/70'
                      : 'bg-rose-950/55 border-rose-400/70'
                    : 'bg-slate-950/75 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      p.connected ? 'bg-emerald-400' : 'bg-slate-600'
                    }`}
                  />
                  <span className="font-semibold text-sm text-white truncate">{p.name}</span>
                  <span
                    className="text-[10px] font-display font-bold px-1.5 py-0.5 uppercase border"
                    style={{
                      color: agent.accentColor,
                      borderColor: `${agent.accentColor}66`,
                      backgroundColor: `${agent.accentColor}15`,
                    }}
                  >
                    {agent.name}
                  </span>
                  {p.id === myId && (
                    <span className="text-[10px] font-display px-1.5 py-0.5 bg-slate-800 text-slate-300 uppercase">
                      YOU
                    </span>
                  )}
                  {p.isHost && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-display px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                      <Crown className="w-2.5 h-2.5" /> HOST
                    </span>
                  )}
                </div>

                <span
                  className={`text-[10px] font-display font-bold tracking-wider uppercase px-2 py-0.5 ${
                    p.ready
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                >
                  {p.ready ? 'READY' : 'WAITING'}
                </span>
              </div>
            )
          })}

          {players.length === 0 && (
            <div className="h-[118px] flex items-center justify-center text-sm font-thai text-slate-500 border border-dashed border-slate-800">
              รอผู้เล่นเข้าร่วมทีม...
            </div>
          )}
        </div>
      </div>

      {canSwitch && (
        <button
          id={`btn-switch-${team}`}
          type="button"
          onClick={onSwitch}
          className={`w-full py-2 text-xs font-display font-bold tracking-wider uppercase border flex items-center justify-center gap-2 transition cursor-pointer ${
            isBlue
              ? 'border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/15'
              : 'border-rose-500/50 text-rose-300 hover:bg-rose-500/15'
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" /> JOIN {title}
        </button>
      )}
    </div>
  )
}

export function LobbyScreen() {
  const room = useGameStore((s) => s.room)
  const myId = useGameStore((s) => s.playerId)
  const me = useGameStore(selectMyPlayer)
  const errorMessage = useGameStore((s) => s.errorMessage)
  const [copied, setCopied] = useState(false)

  if (!room || !me) return null

  const bluePlayers = room.players.filter((p) => p.team === 'blue')
  const redPlayers = room.players.filter((p) => p.team === 'red')
  const connectedCount = room.players.filter((p) => p.connected).length
  const canStart = me.isHost && connectedCount >= MATCH_CONFIG.MIN_PLAYERS
  const selectedAgent = AGENTS[me.agent]

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.roomCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Ignore clipboard failure
    }
  }

  return (
    <div className="relative z-10 flex flex-col justify-between h-full w-full p-5 md:p-7 bg-[#040812]/82 overflow-y-auto gap-4">
      {/* Header with Room Code */}
      <header className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-display text-xs tracking-[0.24em] text-cyan-400 uppercase">
            AGENT SELECT &amp; MATCH LOBBY
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-white">
            MATH DEATHMATCH • 90 SEC
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="hud-panel hud-cut-sm border border-cyan-500/50 px-4 py-2 flex items-center gap-3">
            <div>
              <div className="text-[10px] font-display tracking-[0.2em] text-slate-400 uppercase">
                ROOM CODE
              </div>
              <div
                id="lobby-room-code"
                className="font-display text-2xl font-black tracking-[0.25em] text-cyan-300"
              >
                {room.roomCode}
              </div>
            </div>
            <button
              id="btn-copy-room-code"
              type="button"
              onClick={copyCode}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 cursor-pointer"
              title="Copy room code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <button
            id="btn-leave-lobby"
            type="button"
            onClick={() => multiplayerClient.leaveRoom()}
            className="px-3.5 py-3 bg-slate-900/90 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-500/60 text-slate-300 hover:text-rose-200 hud-cut-sm flex items-center gap-1.5 text-xs font-display tracking-wider uppercase cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> LEAVE
          </button>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto space-y-4">
        {errorMessage && (
          <div className="px-4 py-3 bg-rose-950/85 border border-rose-500/70 text-rose-200 text-sm font-thai">
            {errorMessage}
          </div>
        )}

        {/* Blue vs Red Teams */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TeamRoster
            title="BLUE TEAM"
            team="blue"
            players={bluePlayers}
            myId={myId}
            canSwitch={me.team !== 'blue' && bluePlayers.length < MATCH_CONFIG.MAX_PLAYERS / 2}
            onSwitch={() => multiplayerClient.switchTeam('blue')}
          />
          <TeamRoster
            title="RED TEAM"
            team="red"
            players={redPlayers}
            myId={myId}
            canSwitch={me.team !== 'red' && redPlayers.length < MATCH_CONFIG.MAX_PLAYERS / 2}
            onSwitch={() => multiplayerClient.switchTeam('red')}
          />
        </div>

        {/* Valorant-Style Tactical Agent Picker */}
        <section className="hud-panel hud-cut border border-slate-700/80 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-display text-xs font-bold tracking-[0.22em] text-white uppercase">
                SELECT TACTICAL AGENT (Q / C / X SKILLS)
              </span>
            </div>
            <span className="font-thai text-xs text-slate-400">
              ตอบคณิตถูก +1 แต้มอัลติ • Kill +1 แต้มอัลติ (ครบ 4 แต้มกด [X] ใช้อัลติ!)
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {AGENT_IDS.map((aid) => {
              const a = AGENTS[aid]
              const active = me.agent === aid
              return (
                <button
                  key={aid}
                  id={`btn-agent-${aid}`}
                  type="button"
                  onClick={() => multiplayerClient.selectAgent(aid)}
                  className={`p-3 text-left border transition hud-cut-sm cursor-pointer ${
                    active
                      ? 'bg-slate-900/95'
                      : 'bg-slate-950/75 border-slate-800 hover:border-slate-600'
                  }`}
                  style={
                    active
                      ? {
                          borderColor: a.accentColor,
                          boxShadow: `0 0 22px ${a.accentColor}30`,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-black text-white">{a.name}</span>
                    <span
                      className="text-[10px] font-display font-bold px-1.5 py-0.5 uppercase text-slate-950"
                      style={{ backgroundColor: a.accentColor }}
                    >
                      {a.role}
                    </span>
                  </div>
                  <div className="font-thai text-[11px] text-slate-400 mt-1">{a.roleThai}</div>
                </button>
              )
            })}
          </div>

          {/* Active Agent 3-Skill Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
            {(['Q', 'C', 'X'] as const).map((slot) => {
              const sk = selectedAgent.skills[slot]
              return (
                <div
                  key={slot}
                  className="p-2.5 bg-slate-950/85 border border-slate-800 flex items-start gap-2.5"
                >
                  <span
                    className="h-7 w-7 shrink-0 flex items-center justify-center font-display text-xs font-black text-slate-950"
                    style={{ backgroundColor: sk.accentColor }}
                  >
                    {slot}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xs font-bold text-white truncate">
                        {sk.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {slot === 'X' ? `${sk.ultCost} PTS` : `${sk.cooldownSec}s`}
                      </span>
                    </div>
                    <div className="font-thai text-[11px] text-slate-300 leading-snug mt-0.5">
                      {sk.thaiDesc}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      {/* Bottom Action Bar */}
      <footer className="max-w-6xl w-full mx-auto hud-panel hud-cut border border-slate-700/75 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm">
          <Users className="w-4 h-4 text-cyan-400" />
          <span className="font-display font-bold text-white" id="lobby-player-count">
            {connectedCount} / {room.maxPlayers} PLAYERS
          </span>
          <span className="text-slate-400 font-thai text-xs">
            {connectedCount < MATCH_CONFIG.MIN_PLAYERS
              ? `แชร์รหัส ${room.roomCode} ให้เพื่อนเข้าร่วม (ต้องมีอย่างน้อย 2 คน)`
              : `Agent: ${selectedAgent.name} (${selectedAgent.role}) • พร้อมเริ่มแข่ง!`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-toggle-ready"
            type="button"
            onClick={() => multiplayerClient.setReady(!me.ready)}
            className={`px-5 py-3 font-display font-bold text-xs tracking-wider uppercase hud-cut-sm border transition cursor-pointer ${
              me.ready
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-slate-900 border-slate-600 text-slate-200 hover:border-cyan-400'
            }`}
          >
            {me.ready ? '✓ READY' : 'MARK READY'}
          </button>

          {me.isHost && (
            <button
              id="btn-start-match"
              type="button"
              disabled={!canStart}
              onClick={() => multiplayerClient.startMatch()}
              className="px-7 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-black text-xs tracking-widest uppercase hud-cut-sm flex items-center gap-2 transition cursor-pointer disabled:cursor-not-allowed shadow-[0_0_24px_rgba(0,229,255,0.3)]"
            >
              <Play className="w-4 h-4 fill-current" />
              START MATCH (90s)
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
