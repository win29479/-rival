import { Crosshair, Play, RotateCcw, Shield, Sparkles, Trophy, Users, Volume2, VolumeX, Zap } from 'lucide-react'
import { useState } from 'react'
import { AGENT_IDS, AGENTS } from '../../shared/agents.ts'
import { WEAPON_IDS, WEAPONS } from '../../shared/weapons.ts'
import { multiplayerClient } from '../multiplayer/client.ts'
import { loadSession, useGameStore } from '../store/useGameStore.ts'

export function MainMenu() {
  const playerName = useGameStore((s) => s.playerName)
  const setPlayerName = useGameStore((s) => s.setPlayerName)
  const setScreen = useGameStore((s) => s.setScreen)
  const muted = useGameStore((s) => s.muted)
  const setMuted = useGameStore((s) => s.setMuted)
  const errorMessage = useGameStore((s) => s.errorMessage)
  const transportMode = useGameStore((s) => s.transportMode)
  const [savedSession] = useState(() => loadSession())
  const [reconnecting, setReconnecting] = useState(false)

  const handleQuickCreate = async () => {
    const name = playerName.trim() || `Rival_${Math.floor(100 + Math.random() * 900)}`
    setPlayerName(name)
    await multiplayerClient.createRoom(name)
  }

  const handleReconnect = async () => {
    setReconnecting(true)
    const ok = await multiplayerClient.tryReconnectSavedSession()
    if (!ok) {
      useGameStore.getState().setError('เชื่อมต่อห้องเดิมไม่สำเร็จ กรุณาลองกดอีกครั้ง')
    }
    setReconnecting(false)
  }

  return (
    <div className="relative z-10 flex flex-col justify-between h-full w-full p-5 md:p-8 bg-gradient-to-r from-[#040812]/90 via-[#040812]/55 to-[#040812]/82 overflow-y-auto">
      {/* Top Bar */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 hud-cut-sm bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center">
            <Crosshair className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <div className="font-display text-xs tracking-[0.28em] text-cyan-400 uppercase">
              GRADE 10 TERM 2 • ค31102
            </div>
            <div className="font-thai text-xs text-slate-300">
              หลักการนับเบื้องต้น • 8 Weapons • 4 Tactical Agents
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold tracking-wider uppercase bg-slate-900/80 border border-slate-700/80 text-slate-300 hud-cut-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {transportMode === 'supabase' ? 'Supabase Realtime' : 'Authoritative WS'}
          </span>
          <button
            id="btn-toggle-mute"
            type="button"
            onClick={() => setMuted(!muted)}
            className="p-2.5 bg-slate-900/85 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hud-cut-sm transition cursor-pointer"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-300" />}
          </button>
        </div>
      </header>

      {/* Main Hero */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center my-auto max-w-6xl w-full mx-auto py-4">
        <section className="lg:col-span-6 space-y-5">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-display tracking-[0.22em] uppercase">
              <Zap className="w-3.5 h-3.5" /> 90-SECOND TACTICAL MATH FPS
            </div>
            <h1 className="font-display text-5xl sm:text-6xl font-black tracking-tight text-white leading-[0.95] drop-shadow-[0_6px_28px_rgba(0,229,255,0.28)]">
              MATH <span className="text-cyan-400">RIVALS</span>{' '}
              <span className="text-rose-500">3D</span>
            </h1>
            <p className="font-thai text-slate-300 text-sm sm:text-base max-w-xl leading-relaxed">
              เลือก Agent ใช้สกิล <strong className="text-cyan-300">[Q] [C] [X]</strong> สไตล์ Tactical FPS
              ตอบโจทย์คณิตศาสตร์ ม.4 เทอม 2 เพื่อสุ่มปืนไซไฟ <strong className="text-amber-300">8 ชนิด</strong>{' '}
              และชาร์จอัลติเมตลุยศึก 2–8 คนใน 90 วินาที
            </p>
          </div>

          <div className="hud-panel hud-cut border border-slate-700/70 p-5 max-w-lg space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="input-player-name"
                className="block text-xs font-display tracking-[0.2em] text-slate-400 uppercase"
              >
                PLAYER CALLSIGN
              </label>
              <input
                id="input-player-name"
                type="text"
                maxLength={18}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="ใส่ชื่อผู้เล่น เช่น NeonMath01"
                className="w-full px-4 py-3 bg-slate-950/90 border border-slate-700 focus:border-cyan-400 focus:outline-none text-white font-semibold tracking-wide text-base placeholder:text-slate-500"
              />
            </div>

            {errorMessage && (
              <div className="px-3.5 py-2.5 bg-rose-950/80 border border-rose-500/60 text-rose-200 text-sm font-thai">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                id="btn-menu-create"
                type="button"
                onClick={handleQuickCreate}
                className="flex items-center justify-center gap-2.5 py-3.5 px-5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-extrabold tracking-wider text-sm uppercase hud-cut-sm transition cursor-pointer shadow-[0_0_24px_rgba(0,229,255,0.35)]"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                CREATE ROOM
              </button>
              <button
                id="btn-menu-join"
                type="button"
                onClick={() => setScreen('room')}
                className="flex items-center justify-center gap-2.5 py-3.5 px-5 bg-rose-600/90 hover:bg-rose-500 text-white font-display font-extrabold tracking-wider text-sm uppercase hud-cut-sm transition cursor-pointer shadow-[0_0_24px_rgba(255,46,91,0.3)]"
              >
                <Users className="w-4 h-4" />
                JOIN ROOM
              </button>
            </div>

            {savedSession && (
              <button
                id="btn-menu-reconnect"
                type="button"
                disabled={reconnecting}
                onClick={handleReconnect}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-200 text-xs font-display tracking-wider uppercase transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {reconnecting
                  ? 'RECONNECTING...'
                  : `RECONNECT TO ROOM ${savedSession.roomCode} (${savedSession.playerName})`}
              </button>
            )}
          </div>
        </section>

        {/* Right Showcase: 8 Weapons + 4 Tactical Agents */}
        <aside className="lg:col-span-6 space-y-3">
          <div className="hud-panel hud-cut border border-slate-700/70 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-display text-xs tracking-[0.22em] text-cyan-300 uppercase">
                8 RANDOM SCI-FI WEAPONS
              </span>
              <span className="text-[11px] text-slate-400 font-thai">ตอบถูกสุ่มปลดล็อกทันที</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEAPON_IDS.map((id) => {
                const w = WEAPONS[id]
                return (
                  <div
                    key={id}
                    className="p-2.5 bg-slate-950/85 border border-slate-800/90 space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display text-[11px] font-bold text-white truncate">
                        {w.name.split(' ')[0]}
                      </span>
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: w.accentColor }}
                      />
                    </div>
                    <div className="text-[9px] font-display tracking-wider text-slate-400 uppercase">
                      DMG {w.damage}{w.pellets > 1 ? `×${w.pellets}` : ''} • {w.magSize}RD
                    </div>
                    <div className="text-[9px] font-mono uppercase" style={{ color: w.accentColor }}>
                      {w.badge}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 4 Tactical Agents Strip */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display text-[11px] tracking-[0.2em] text-amber-300 uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> 4 TACTICAL AGENTS (Q / C / X)
                </span>
                <span className="text-[10px] font-thai text-slate-400">เลือกได้ใน Lobby</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AGENT_IDS.map((aid) => {
                  const a = AGENTS[aid]
                  return (
                    <div key={aid} className="p-2 bg-slate-950/80 border border-slate-800">
                      <div className="font-display text-xs font-black" style={{ color: a.accentColor }}>
                        {a.name}
                      </div>
                      <div className="text-[9px] font-display text-slate-400">{a.role}</div>
                      <div className="text-[10px] font-thai text-slate-300 truncate mt-0.5">
                        {a.skills.Q.name.split(' ')[0]} • {a.skills.C.name.split(' ')[0]}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
              <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 text-center">
                <div className="font-display text-base font-extrabold text-emerald-400">+100</div>
                <div className="text-[10px] font-thai text-slate-300">ตอบถูก (+1 ULT)</div>
              </div>
              <div className="p-2 bg-cyan-950/40 border border-cyan-500/30 text-center">
                <div className="font-display text-base font-extrabold text-cyan-300">+150</div>
                <div className="text-[10px] font-thai text-slate-300">Kill (+1 ULT)</div>
              </div>
              <div className="p-2 bg-rose-950/40 border border-rose-500/30 text-center">
                <div className="font-display text-base font-extrabold text-rose-400">+50</div>
                <div className="text-[10px] font-thai text-slate-300">Headshot</div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Bottom Controls Strip */}
      <footer className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 border-t border-slate-800/70 pt-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-cyan-400" /> Blue vs Red Arena
          </span>
          <span className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" /> 48 Verified ม.4 เทอม 2 Questions
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          WASD Move • LMB/RMB Shoot/Zoom • Q/C/X Agent Skills • E Math Quiz • R Reload • Tab Scoreboard
        </div>
      </footer>
    </div>
  )
}
