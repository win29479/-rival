import { Sparkles } from 'lucide-react'
import { useEffect } from 'react'
import { WEAPONS } from '../../shared/weapons.ts'
import { useGameStore } from '../store/useGameStore.ts'

export function WeaponReveal() {
  const reveal = useGameStore((s) => s.weaponReveal)
  const clearWeaponReveal = useGameStore((s) => s.clearWeaponReveal)

  useEffect(() => {
    if (!reveal) return
    const timer = window.setTimeout(() => {
      clearWeaponReveal()
    }, 3200)
    return () => window.clearTimeout(timer)
  }, [reveal, clearWeaponReveal])

  if (!reveal) return null
  const spec = WEAPONS[reveal.weapon]
  const dmgScore = Math.min(100, Math.round(((spec.damage * spec.pellets) / 108) * 100))
  const rofScore = Math.min(100, Math.round((1 - (spec.fireRateMs - 100) / 1100) * 100))
  const rangeScore = Math.min(100, Math.round((spec.range / 140) * 100))

  return (
    <div
      id="weapon-reveal-banner"
      className="pointer-events-none fixed bottom-28 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
    >
      <div
        className="animate-weapon-reveal hud-panel hud-cut border-2 p-4 space-y-2.5"
        style={{
          borderColor: spec.accentColor,
          boxShadow: `0 0 36px ${spec.accentColor}40`,
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1.5 font-display text-[11px] font-bold tracking-[0.22em] uppercase"
            style={{ color: spec.accentColor }}
          >
            <Sparkles className="w-3.5 h-3.5" /> RANDOM WEAPON UNLOCKED
          </span>
          <span className="font-display text-xs font-extrabold text-emerald-400">
            +{reveal.pointsAwarded} PTS
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="font-display text-2xl font-black text-white tracking-wide uppercase">
              {spec.name}
            </div>
            <div className="font-thai text-xs text-slate-300">{spec.tagline}</div>
          </div>
          <span
            className="px-2 py-0.5 text-[10px] font-display font-bold uppercase text-slate-950 shrink-0"
            style={{ backgroundColor: spec.accentColor }}
          >
            {spec.badge}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] font-display text-slate-400">
          <div>
            <div className="flex justify-between mb-1">
              <span>POWER</span>
              <span className="text-white">{spec.damage}{spec.pellets > 1 ? `×${spec.pellets}` : ''}</span>
            </div>
            <div className="h-1.5 bg-slate-900">
              <div className="h-full" style={{ width: `${dmgScore}%`, backgroundColor: spec.accentColor }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span>FIRE RATE</span>
              <span className="text-white">{Math.round(1000 / spec.fireRateMs)}/s</span>
            </div>
            <div className="h-1.5 bg-slate-900">
              <div className="h-full" style={{ width: `${rofScore}%`, backgroundColor: spec.accentColor }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span>RANGE</span>
              <span className="text-white">{spec.range}m</span>
            </div>
            <div className="h-1.5 bg-slate-900">
              <div className="h-full" style={{ width: `${rangeScore}%`, backgroundColor: spec.accentColor }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
