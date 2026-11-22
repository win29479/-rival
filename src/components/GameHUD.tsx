import { Brain, Crosshair, Eye, Flame, Heart, Shield, Skull, Target, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AGENTS } from '../../shared/agents.ts'
import type { SkillSlot } from '../../shared/types.ts'
import { WEAPONS } from '../../shared/weapons.ts'
import { soundEngine } from '../game/sound.ts'
import { multiplayerClient } from '../multiplayer/client.ts'
import { selectMyPlayer, useGameStore } from '../store/useGameStore.ts'

function formatTimer(ms: number): string {
  const clamped = Math.max(0, Math.ceil(ms / 1000))
  const min = Math.floor(clamped / 60)
  const sec = clamped % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function GameHUD() {
  const room = useGameStore((s) => s.room)
  const me = useGameStore(selectMyPlayer)
  const clockOffsetMs = useGameStore((s) => s.clockOffsetMs)
  const pointerLocked = useGameStore((s) => s.pointerLocked)
  const mathModalOpen = useGameStore((s) => s.mathModalOpen)
  const pauseOpen = useGameStore((s) => s.pauseOpen)
  const isAdsZoom = useGameStore((s) => s.isAdsZoom)
  const hitMarker = useGameStore((s) => s.hitMarker)
  const lastDamageTaken = useGameStore((s) => s.lastDamageTaken)
  const lastSkillBanner = useGameStore((s) => s.lastSkillBanner)
  const recentKills = useGameStore((s) => s.recentKills)
  const connectionStatus = useGameStore((s) => s.connectionStatus)

  const [nowTick, setNowTick] = useState(() => Date.now())
  const lastBeepSecRef = useRef<number | null>(null)
  const prevPhaseRef = useRef<string | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!room) return
    const serverNow = nowTick + clockOffsetMs
    if (room.phase === 'countdown' && room.countdownEndsAt) {
      const secLeft = Math.max(1, Math.ceil((room.countdownEndsAt - serverNow) / 1000))
      if (lastBeepSecRef.current !== secLeft) {
        lastBeepSecRef.current = secLeft
        soundEngine.playCountdown(false)
      }
    }
    if (prevPhaseRef.current === 'countdown' && room.phase === 'playing') {
      soundEngine.playCountdown(true)
      lastBeepSecRef.current = null
    }
    prevPhaseRef.current = room.phase
  }, [room, nowTick, clockOffsetMs])

  if (!room || !me) return null

  const serverNow = nowTick + clockOffsetMs
  const timeLeftMs =
    room.phase === 'playing' && room.matchEndsAt
      ? Math.max(0, room.matchEndsAt - serverNow)
      : room.matchDurationSec * 1000
  const countdownSec =
    room.phase === 'countdown' && room.countdownEndsAt
      ? Math.max(1, Math.ceil((room.countdownEndsAt - serverNow) / 1000))
      : null

  const blueTotal = room.scoreboard
    .filter((s) => s.team === 'blue')
    .reduce((acc, s) => acc + s.totalScore, 0)
  const redTotal = room.scoreboard
    .filter((s) => s.team === 'red')
    .reduce((acc, s) => acc + s.totalScore, 0)

  const agentSpec = AGENTS[me.agent]
  const weaponSpec = me.weapon ? WEAPONS[me.weapon] : null
  const isReloading = Boolean(me.reloadingUntil && serverNow < me.reloadingUntil)
  const reloadProgress =
    isReloading && weaponSpec && me.reloadingUntil
      ? Math.max(0, Math.min(100, 100 - ((me.reloadingUntil - serverNow) / weaponSpec.reloadMs) * 100))
      : 0

  const qCdSec = Math.max(0, Math.ceil((me.skillQReadyAt - serverNow) / 1000))
  const cCdSec = Math.max(0, Math.ceil((me.skillCReadyAt - serverNow) / 1000))
  const ultReady = me.ultPoints >= me.ultMax

  const overdriveLeft =
    me.overdriveUntil && serverNow < me.overdriveUntil
      ? ((me.overdriveUntil - serverNow) / 1000).toFixed(1)
      : null
  const overshieldLeft =
    me.overshieldUntil && serverNow < me.overshieldUntil
      ? ((me.overshieldUntil - serverNow) / 1000).toFixed(1)
      : null
  const blindOpacity =
    me.blindedUntil && serverNow < me.blindedUntil
      ? Math.min(0.95, (me.blindedUntil - serverNow) / 1600)
      : 0
  const anyEnemyRevealed = room.players.some(
    (p) => p.team !== me.team && p.alive && p.revealedUntil && serverNow < p.revealedUntil,
  )

  const showHitMarker = hitMarker && nowTick - hitMarker.timestamp < 320
  const showDamageFlash = lastDamageTaken && nowTick - lastDamageTaken.timestamp < 380
  const showSkillToast = lastSkillBanner && nowTick - lastSkillBanner.receivedAt < 2200
  const respawnSec =
    !me.alive && me.respawnAt ? Math.max(0.1, (me.respawnAt - serverNow) / 1000).toFixed(1) : null
  const lowTime = room.phase === 'playing' && timeLeftMs <= 15000

  const openMathTerminal = () => {
    if (document.pointerLockElement) document.exitPointerLock()
    multiplayerClient.requestQuestion()
  }

  const triggerSkillFromHud = (slot: SkillSlot) => {
    window.dispatchEvent(new CustomEvent('math-rivals-cast-skill', { detail: slot }))
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      {/* Vortex Flashpulse Blind Overlay */}
      {blindOpacity > 0 && (
        <div
          id="hud-blind-overlay"
          className="fixed inset-0 z-40 flex items-center justify-center bg-cyan-50 transition-opacity duration-100"
          style={{ opacity: blindOpacity }}
        >
          <span className="font-display text-3xl font-black tracking-[0.35em] text-cyan-950/60 uppercase">
            BLINDED
          </span>
        </div>
      )}

      {/* Damage Vignette Flash */}
      {showDamageFlash && (
        <div
          key={lastDamageTaken.timestamp}
          className="animate-damage-flash fixed inset-0 border-[12px] border-rose-500/80 shadow-[inset_0_0_90px_rgba(255,46,91,0.7)]"
        />
      )}

      {/* Overdrive Aura Edge Glow */}
      {overdriveLeft && (
        <div className="fixed inset-0 border-4 border-cyan-400/50 shadow-[inset_0_0_70px_rgba(0,229,255,0.28)]" />
      )}

      {/* Sniper Railgun Full-Scope Overlay */}
      {isAdsZoom && me.weapon === 'sniper' && me.alive && !mathModalOpen && !pauseOpen && (
        <div className="fixed inset-0 flex items-center justify-center">
          <div
            className="w-[min(78vh,78vw)] h-[min(78vh,78vw)] rounded-full border-2 border-rose-500/80 relative"
            style={{ boxShadow: '0 0 0 9999px rgba(3, 6, 14, 0.92)' }}
          >
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-rose-500/50" />
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-rose-500/50" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-rose-400" />
          </div>
        </div>
      )}

      {/* Reconnecting Warning Pill */}
      {connectionStatus === 'reconnecting' && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-amber-500/20 border border-amber-400 text-amber-200 font-display text-xs tracking-widest uppercase">
          RECONNECTING TO SERVER...
        </div>
      )}

      {/* TOP CENTER — Synchronized 90s Timer + Team Scores */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="hud-panel hud-cut-sm border border-cyan-500/50 px-4 py-1.5 text-right min-w-[96px]">
            <div className="text-[9px] font-display tracking-[0.2em] text-cyan-400 uppercase">BLUE</div>
            <div className="font-display text-xl font-black text-white">{blueTotal}</div>
          </div>

          <div
            className={`hud-panel hud-cut px-6 py-2 border-2 text-center min-w-[134px] ${
              lowTime ? 'border-rose-500 animate-pulse' : 'border-slate-600/80'
            }`}
          >
            <div className="text-[9px] font-display tracking-[0.24em] text-slate-400 uppercase">
              {room.phase === 'countdown' ? 'STARTING' : 'MATCH TIME'}
            </div>
            <div
              id="hud-match-timer"
              className={`font-display text-3xl font-black tracking-wider ${
                lowTime ? 'text-rose-400' : 'text-white'
              }`}
            >
              {formatTimer(timeLeftMs)}
            </div>
          </div>

          <div className="hud-panel hud-cut-sm border border-rose-500/50 px-4 py-1.5 text-left min-w-[96px]">
            <div className="text-[9px] font-display tracking-[0.2em] text-rose-400 uppercase">RED</div>
            <div className="font-display text-xl font-black text-white">{redTotal}</div>
          </div>
        </div>

        {/* Active Buffs & Skill Cast Banner */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {overdriveLeft && (
            <span className="px-2.5 py-0.5 bg-cyan-500/25 border border-cyan-400 text-cyan-200 font-display text-[11px] font-bold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> OVERDRIVE {overdriveLeft}s
            </span>
          )}
          {overshieldLeft && (
            <span className="px-2.5 py-0.5 bg-emerald-500/25 border border-emerald-400 text-emerald-200 font-display text-[11px] font-bold flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> TITAN SHIELD {overshieldLeft}s
            </span>
          )}
          {anyEnemyRevealed && (
            <span className="px-2.5 py-0.5 bg-orange-500/25 border border-orange-400 text-orange-200 font-display text-[11px] font-bold flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> ENEMY REVEALED
            </span>
          )}
          {showSkillToast && (
            <span
              id="hud-skill-toast"
              className="px-3 py-0.5 bg-slate-950/85 border border-slate-600 text-xs font-display tracking-wider text-white uppercase"
            >
              <strong style={{ color: AGENTS[lastSkillBanner.agent].accentColor }}>
                {lastSkillBanner.playerName}
              </strong>{' '}
              USED {lastSkillBanner.skillName}
            </span>
          )}
        </div>
      </div>

      {/* TOP LEFT — Live Kill Feed */}
      <div className="fixed top-4 left-4 space-y-1.5 max-w-xs">
        <div className="text-[10px] font-display tracking-[0.22em] text-slate-400 uppercase px-1">
          ROOM {room.roomCode} • {agentSpec.name}
        </div>
        {recentKills.slice(0, 4).map((k) => (
          <div
            key={k.id}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/85 border-l-2 border-cyan-400 text-xs backdrop-blur-sm"
          >
            <span className={k.killerTeam === 'blue' ? 'text-cyan-300 font-bold' : 'text-rose-400 font-bold'}>
              {k.killerName}
            </span>
            <span className="text-[10px] font-display text-amber-300 uppercase px-1">
              [{k.weapon === 'skill' ? (k.skillLabel ?? 'SKILL') : WEAPONS[k.weapon].name.split(' ')[0]}]
            </span>
            {k.headshot && <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            <span className={k.victimTeam === 'blue' ? 'text-cyan-300' : 'text-rose-400'}>
              {k.victimName}
            </span>
            <span className="text-[10px] font-display text-emerald-400 ml-1">+{k.pointsAwarded}</span>
          </div>
        ))}
      </div>

      {/* TOP RIGHT — Compact Live Leaderboard */}
      <div className="fixed top-4 right-4 w-56 space-y-1 hidden sm:block">
        <div className="flex items-center justify-between px-2 text-[10px] font-display tracking-[0.2em] text-slate-400 uppercase">
          <span>LIVE RANKING</span>
          <span>[TAB]</span>
        </div>
        {room.scoreboard.slice(0, 5).map((entry) => {
          const isMe = entry.playerId === me.id
          return (
            <div
              key={entry.playerId}
              className={`flex items-center justify-between px-2.5 py-1.5 text-xs border-r-2 backdrop-blur-sm ${
                entry.team === 'blue' ? 'border-cyan-400' : 'border-rose-500'
              } ${isMe ? 'bg-slate-800/90 text-white' : 'bg-slate-950/80 text-slate-300'}`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="font-display font-bold text-amber-300 w-4">#{entry.rank}</span>
                <span className="truncate font-semibold">{entry.name}</span>
              </div>
              <span className="font-display font-bold text-white">{entry.totalScore}</span>
            </div>
          )
        })}
      </div>

      {/* CENTER — Pre-Match 3-2-1 Countdown Overlay */}
      {room.phase === 'countdown' && countdownSec !== null && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950/35">
          <div className="font-display text-xs tracking-[0.35em] text-cyan-300 uppercase mb-2">
            AGENT {agentSpec.name} DEPLOYING • SOLVE &amp; FIGHT
          </div>
          <div
            id="hud-countdown-number"
            className="font-display text-8xl sm:text-9xl font-black text-white drop-shadow-[0_0_40px_rgba(0,229,255,0.85)]"
          >
            {countdownSec}
          </div>
          <div className="mt-4 px-4 py-2 bg-slate-950/85 border border-cyan-500/50 font-thai text-sm text-slate-200">
            กด <span className="font-display text-cyan-300 font-bold">[E]</span> ตอบคณิตสุ่มปืน 8 แบบ • กด{' '}
            <span className="font-display text-amber-300 font-bold">[Q] [C] [X]</span> ใช้สกิล Agent!
          </div>
        </div>
      )}

      {/* CENTER — Crosshair + Hitmarker */}
      {room.phase === 'playing' && me.alive && !mathModalOpen && !pauseOpen && !(isAdsZoom && me.weapon === 'sniper') && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {me.weapon === 'shotgun' ? (
            <div className="w-9 h-9 rounded-full border-2 border-amber-400/80 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-300" />
            </div>
          ) : (
            <div className="relative w-7 h-7 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-cyan-300 shadow-[0_0_6px_#00f0ff]" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-white/90" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-white/90" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-white/90" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-white/90" />
            </div>
          )}

          {showHitMarker && (
            <div
              key={hitMarker.id}
              className="animate-hitmarker absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            >
              <div
                className={`w-6 h-6 relative ${
                  hitMarker.headshot || hitMarker.killed ? 'text-rose-500' : 'text-white'
                }`}
              >
                <span className="absolute inset-x-0 top-1/2 h-[2.5px] bg-current rotate-45" />
                <span className="absolute inset-x-0 top-1/2 h-[2.5px] bg-current -rotate-45" />
              </div>
              {hitMarker.killed && (
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap font-display text-xs font-black tracking-wider text-amber-300 drop-shadow">
                  {hitMarker.headshot ? 'HEADSHOT KILL' : 'ELIMINATED'} +{hitMarker.pointsAwarded}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CENTER — Eliminated Respawn Overlay */}
      {room.phase === 'playing' && !me.alive && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-rose-950/35">
          <Skull className="w-12 h-12 text-rose-400 mb-2" />
          <div className="font-display text-3xl font-black text-white tracking-wider">
            ELIMINATED
          </div>
          {respawnSec && (
            <div className="font-display text-lg text-rose-300 mt-1">
              RESPAWNING IN {respawnSec}s
            </div>
          )}
        </div>
      )}

      {/* CENTER PROMPT — Unarmed Math CTA */}
      {room.phase === 'playing' && me.alive && !mathModalOpen && !pauseOpen && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          {!me.weapon && (
            <button
              id="btn-hud-open-math"
              type="button"
              onClick={openMathTerminal}
              className="pointer-events-auto px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-black text-sm tracking-wider uppercase hud-cut-sm flex items-center gap-2.5 shadow-[0_0_32px_rgba(0,229,255,0.65)] ring-2 ring-cyan-300/60 transition cursor-pointer"
            >
              <Brain className="w-5 h-5" />
              กด [E] ตอบโจทย์คณิต เพื่อสุ่มปืน (+100 PTS +1 ULT)
            </button>
          )}
          {me.weapon && !pointerLocked && (
            <div className="px-4 py-1 bg-slate-950/80 border border-cyan-500/40 text-[11px] font-display tracking-wider text-cyan-200 uppercase">
              CLICK ARENA TO LOCK AIM • [Q][C][X] SKILLS • [E] MATH
            </div>
          )}
        </div>
      )}

      {/* BOTTOM LEFT — HP & Personal Stats */}
      <div className="fixed bottom-4 left-4 hud-panel hud-cut border border-slate-700/80 p-3.5 min-w-[220px] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <span className="font-display text-2xl font-black text-white" id="hud-hp-value">
              {me.hp}
            </span>
            <span className="text-xs font-display text-slate-400">/ {me.maxHp}</span>
          </div>
          <span
            className={`px-2 py-0.5 text-[10px] font-display font-bold uppercase ${
              me.team === 'blue' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {me.team}
          </span>
        </div>

        <div className="h-2.5 w-full bg-slate-950 border border-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-150 ${
              me.maxHp > 100
                ? 'bg-emerald-400'
                : me.hp > 50
                  ? 'bg-cyan-400'
                  : me.hp > 25
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, (me.hp / me.maxHp) * 100))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs pt-0.5 border-t border-slate-800">
          <span className="text-slate-400">
            SCORE <strong className="font-display text-white ml-1" id="hud-my-score">{me.totalScore}</strong>
          </span>
          <span className="text-emerald-400 font-semibold">✓ {me.correctAnswers}</span>
          <span className="text-cyan-300 font-semibold">
            K/D {me.kills}/{me.deaths}
          </span>
        </div>
      </div>

      {/* BOTTOM CENTER — VALORANT-STYLE AGENT ABILITY DOCK (Q / C / X) */}
      {room.phase === 'playing' && (
        <div
          id="hud-ability-dock"
          className="pointer-events-auto fixed bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-2"
        >
          {/* [Q] Skill */}
          <button
            id="btn-hud-skill-Q"
            type="button"
            disabled={!me.alive || qCdSec > 0}
            onClick={() => triggerSkillFromHud('Q')}
            className={`hud-panel hud-cut-sm border px-3 py-2 min-w-[106px] text-left transition cursor-pointer disabled:cursor-not-allowed ${
              qCdSec === 0
                ? 'border-slate-500 hover:border-cyan-300'
                : 'border-slate-800 opacity-65'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className="px-1.5 py-0.5 text-[10px] font-display font-black text-slate-950"
                style={{ backgroundColor: qCdSec === 0 ? agentSpec.skills.Q.accentColor : '#475569' }}
              >
                Q
              </span>
              <span className="font-display text-xs font-bold text-white" id="hud-skill-Q-status">
                {qCdSec > 0 ? `${qCdSec}s` : 'READY'}
              </span>
            </div>
            <div className="font-display text-[10px] font-bold text-slate-200 truncate mt-1.5 uppercase">
              {agentSpec.skills.Q.name}
            </div>
          </button>

          {/* [C] Skill */}
          <button
            id="btn-hud-skill-C"
            type="button"
            disabled={!me.alive || cCdSec > 0}
            onClick={() => triggerSkillFromHud('C')}
            className={`hud-panel hud-cut-sm border px-3 py-2 min-w-[106px] text-left transition cursor-pointer disabled:cursor-not-allowed ${
              cCdSec === 0
                ? 'border-slate-500 hover:border-cyan-300'
                : 'border-slate-800 opacity-65'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className="px-1.5 py-0.5 text-[10px] font-display font-black text-slate-950"
                style={{ backgroundColor: cCdSec === 0 ? agentSpec.skills.C.accentColor : '#475569' }}
              >
                C
              </span>
              <span className="font-display text-xs font-bold text-white" id="hud-skill-C-status">
                {cCdSec > 0 ? `${cCdSec}s` : 'READY'}
              </span>
            </div>
            <div className="font-display text-[10px] font-bold text-slate-200 truncate mt-1.5 uppercase">
              {agentSpec.skills.C.name}
            </div>
          </button>

          {/* [X] ULTIMATE (4-Pip Charge Meter) */}
          <button
            id="btn-hud-skill-X"
            type="button"
            disabled={!me.alive || !ultReady}
            onClick={() => triggerSkillFromHud('X')}
            className={`hud-panel hud-cut-sm border px-3.5 py-2 min-w-[132px] text-left transition cursor-pointer disabled:cursor-not-allowed ${
              ultReady
                ? 'border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.4)]'
                : 'border-slate-800 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="px-1.5 py-0.5 text-[10px] font-display font-black text-slate-950"
                style={{ backgroundColor: ultReady ? '#fbbf24' : '#475569' }}
              >
                X
              </span>
              <div className="flex items-center gap-1" id="hud-ult-pips">
                {Array.from({ length: me.ultMax }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rotate-45 border ${
                      i < me.ultPoints
                        ? 'bg-amber-400 border-amber-200'
                        : 'bg-slate-900 border-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="font-display text-[10px] font-bold truncate mt-1.5 uppercase text-amber-200">
              {ultReady ? `ULT: ${agentSpec.skills.X.name}` : `ULT ${me.ultPoints}/${me.ultMax}`}
            </div>
          </button>
        </div>
      )}

      {/* BOTTOM RIGHT — Equipped Weapon & Ammo + Quick Math Button */}
      <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2">
        {room.phase === 'playing' && me.alive && me.weapon && (
          <button
            id="btn-hud-math-quick"
            type="button"
            onClick={openMathTerminal}
            className="pointer-events-auto px-3 py-1.5 bg-slate-950/85 hover:bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 text-[11px] font-display tracking-wider uppercase flex items-center gap-1.5 hud-cut-sm cursor-pointer"
          >
            <Brain className="w-3.5 h-3.5" /> [E] MATH (+100 &amp; REROLL)
          </button>
        )}

        <div className="hud-panel hud-cut border border-slate-700/80 p-3.5 min-w-[230px] space-y-1.5">
          {weaponSpec ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div
                    className="font-display text-sm font-black tracking-wide uppercase"
                    id="hud-weapon-name"
                    style={{ color: weaponSpec.accentColor }}
                  >
                    {weaponSpec.name}
                  </div>
                  <div className="text-[10px] font-display tracking-widest text-slate-400 uppercase">
                    {weaponSpec.category}
                  </div>
                </div>
                {me.streak >= 2 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-display font-bold">
                    <Flame className="w-3 h-3" /> {me.streak}x
                  </span>
                )}
              </div>

              {isReloading ? (
                <div className="space-y-1">
                  <div className="font-display text-xs tracking-widest text-amber-300 uppercase">
                    RELOADING...
                  </div>
                  <div className="h-2 bg-slate-950 border border-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-75"
                      style={{ width: `${reloadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-3xl font-black text-white" id="hud-ammo-value">
                      {me.ammo}
                    </span>
                    <span className="font-display text-sm text-slate-400">/ {weaponSpec.magSize}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {me.ammo === 0 ? '[R] RELOAD' : '[R] • [RMB]'}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between gap-3 py-1">
              <div>
                <div className="font-display text-sm font-bold text-slate-400 uppercase" id="hud-weapon-name">
                  NO WEAPON EQUIPPED
                </div>
                <div className="font-thai text-xs text-cyan-300">
                  กด [E] ตอบคณิตเพื่อสุ่มปืน 8 แบบ
                </div>
              </div>
              <Crosshair className="w-6 h-6 text-slate-600" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
