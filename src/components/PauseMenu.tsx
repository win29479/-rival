import { LogOut, Play, Sliders, Volume2, VolumeX } from 'lucide-react'
import { multiplayerClient } from '../multiplayer/client.ts'
import { useGameStore } from '../store/useGameStore.ts'

export function PauseMenu() {
  const open = useGameStore((s) => s.pauseOpen)
  const setPauseOpen = useGameStore((s) => s.setPauseOpen)
  const muted = useGameStore((s) => s.muted)
  const setMuted = useGameStore((s) => s.setMuted)
  const sensitivity = useGameStore((s) => s.mouseSensitivity)
  const setSensitivity = useGameStore((s) => s.setMouseSensitivity)

  if (!open) return null

  const handleResume = () => {
    setPauseOpen(false)
    const canvas = document.querySelector('canvas')
    void canvas?.requestPointerLock?.()
  }

  return (
    <div
      id="pause-menu-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#040812]/75 backdrop-blur-sm"
    >
      <div className="w-full max-w-md hud-panel hud-cut border border-slate-700 p-6 space-y-5">
        <div className="border-b border-slate-800 pb-3">
          <div className="font-display text-xs tracking-[0.24em] text-cyan-400 uppercase">
            MATCH IN PROGRESS
          </div>
          <h3 className="font-display text-2xl font-black text-white">PAUSED</h3>
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-display text-slate-300 uppercase">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" /> MOUSE SENSITIVITY
              </span>
              <span className="text-cyan-300">{(sensitivity * 1000).toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0.0008}
              max={0.0055}
              step={0.0002}
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <button
            type="button"
            onClick={() => setMuted(!muted)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-950/85 border border-slate-700 text-sm text-slate-200 hover:border-cyan-400 cursor-pointer"
          >
            <span className="font-display text-xs tracking-wider uppercase">SOUND EFFECTS</span>
            {muted ? (
              <span className="inline-flex items-center gap-1.5 text-rose-400 font-display text-xs">
                <VolumeX className="w-4 h-4" /> MUTED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-display text-xs">
                <Volume2 className="w-4 h-4" /> ON
              </span>
            )}
          </button>
        </div>

        {/* Controls Quick Reference */}
        <div className="p-3.5 bg-slate-950/80 border border-slate-800 text-xs grid grid-cols-2 gap-y-1.5 gap-x-3 text-slate-300">
          <div><strong className="text-cyan-300 font-mono">WASD</strong> Move</div>
          <div><strong className="text-cyan-300 font-mono">SHIFT / SPACE</strong> Sprint / Jump</div>
          <div><strong className="text-cyan-300 font-mono">LMB / RMB</strong> Shoot / Zoom</div>
          <div><strong className="text-cyan-300 font-mono">R</strong> Reload</div>
          <div><strong className="text-amber-300 font-mono">Q / C</strong> Agent Skills</div>
          <div><strong className="text-amber-300 font-mono">X</strong> Ultimate (4 pts)</div>
          <div><strong className="text-cyan-300 font-mono">E</strong> Math Quiz (+100)</div>
          <div><strong className="text-cyan-300 font-mono">TAB / ESC</strong> Score / Pause</div>
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            id="btn-pause-resume"
            type="button"
            onClick={handleResume}
            className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-black text-sm tracking-wider uppercase hud-cut-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" /> RESUME MATCH
          </button>
          <button
            id="btn-pause-leave"
            type="button"
            onClick={() => multiplayerClient.leaveRoom()}
            className="w-full py-2.5 bg-rose-950/70 hover:bg-rose-900 border border-rose-500/60 text-rose-200 font-display font-bold text-xs tracking-wider uppercase hud-cut-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> LEAVE ROOM
          </button>
        </div>
      </div>
    </div>
  )
}
