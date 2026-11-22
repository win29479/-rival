import { Trophy } from 'lucide-react'
import { useGameStore } from '../store/useGameStore.ts'

export function ScoreboardOverlay() {
  const open = useGameStore((s) => s.scoreboardOpen)
  const room = useGameStore((s) => s.room)
  const myId = useGameStore((s) => s.playerId)

  if (!open || !room) return null

  return (
    <div
      id="live-scoreboard-overlay"
      className="pointer-events-none fixed inset-0 z-35 flex items-center justify-center p-6 bg-[#040812]/65 backdrop-blur-sm"
    >
      <div className="w-full max-w-4xl hud-panel hud-cut border border-cyan-500/50 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="font-display text-xl font-black text-white tracking-wider uppercase">
              LIVE SCOREBOARD • ROOM {room.roomCode}
            </h3>
          </div>
          <span className="font-mono text-xs text-slate-400">
            +100 Math • +150 Kill • +50 Headshot
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-display tracking-widest text-slate-400 uppercase">
                <th className="py-2.5 px-3">RANK</th>
                <th className="py-2.5 px-3">PLAYER NAME</th>
                <th className="py-2.5 px-3">TEAM</th>
                <th className="py-2.5 px-3 text-right">CORRECT ANSWERS</th>
                <th className="py-2.5 px-3 text-right">KILLS</th>
                <th className="py-2.5 px-3 text-right">DEATHS</th>
                <th className="py-2.5 px-3 text-right">TOTAL SCORE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-sm">
              {room.scoreboard.map((row) => {
                const isMe = row.playerId === myId
                return (
                  <tr
                    key={row.playerId}
                    className={isMe ? 'bg-cyan-500/15 text-white' : 'text-slate-200'}
                  >
                    <td className="py-2.5 px-3 font-display font-black text-amber-300">
                      #{row.rank}
                    </td>
                    <td className="py-2.5 px-3 font-semibold">
                      {row.name}
                      {isMe && (
                        <span className="ml-2 text-[10px] font-display px-1.5 py-0.5 bg-cyan-500/25 text-cyan-200 uppercase">
                          YOU
                        </span>
                      )}
                      {!row.connected && (
                        <span className="ml-2 text-[10px] font-display px-1.5 py-0.5 bg-slate-800 text-slate-400 uppercase">
                          OFFLINE
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[11px] font-display font-bold uppercase px-2 py-0.5 ${
                          row.team === 'blue'
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {row.team}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-display text-emerald-400 font-bold">
                      {row.correctAnswers}
                    </td>
                    <td className="py-2.5 px-3 text-right font-display text-cyan-300 font-bold">
                      {row.kills}
                    </td>
                    <td className="py-2.5 px-3 text-right font-display text-rose-400">
                      {row.deaths}
                    </td>
                    <td className="py-2.5 px-3 text-right font-display text-lg font-black text-white">
                      {row.totalScore}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
