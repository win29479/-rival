import { Award, Crown, LogOut, RotateCcw, Target, Trophy } from 'lucide-react'
import { multiplayerClient } from '../multiplayer/client.ts'
import { selectMyPlayer, useGameStore } from '../store/useGameStore.ts'

export function ResultScreen() {
  const summary = useGameStore((s) => s.matchSummary ?? s.room?.summary ?? null)
  const me = useGameStore(selectMyPlayer)
  const myId = useGameStore((s) => s.playerId)

  if (!summary) return null

  const winner = summary.winnerPlayer
  const myRow = summary.standings.find((s) => s.playerId === myId)

  return (
    <div
      id="result-winner-screen"
      className="relative z-20 flex flex-col justify-between h-full w-full p-6 md:p-10 bg-[#040812]/88 overflow-y-auto"
    >
      <div className="max-w-5xl w-full mx-auto space-y-6 my-auto">
        {/* Winner Banner */}
        <header className="hud-panel hud-cut border-2 border-amber-400/70 p-6 sm:p-8 text-center space-y-3 shadow-[0_0_60px_rgba(255,184,0,0.18)]">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-amber-500/20 border border-amber-400/50 text-amber-300 font-display text-xs tracking-[0.26em] uppercase">
            <Trophy className="w-4 h-4" /> MATCH COMPLETE • 90 SECONDS UP
          </div>

          {winner ? (
            <>
              <div className="flex items-center justify-center gap-3">
                <Crown className="w-8 h-8 text-amber-400" />
                <h1
                  id="winner-player-name"
                  className="font-display text-4xl sm:text-5xl font-black text-white tracking-wide"
                >
                  {winner.name}
                </h1>
              </div>
              <div className="font-display text-sm tracking-[0.22em] uppercase text-amber-300">
                MATCH CHAMPION • {winner.totalScore} PTS • {winner.kills} KILLS • {winner.correctAnswers} MATH CORRECT
              </div>
            </>
          ) : (
            <h1 className="font-display text-4xl font-black text-white">MATCH ENDED</h1>
          )}

          {/* Team Score Comparison */}
          <div className="flex items-center justify-center gap-6 pt-3">
            <div className="px-5 py-2 bg-cyan-950/60 border border-cyan-400/50">
              <div className="text-[10px] font-display tracking-[0.2em] text-cyan-300 uppercase">BLUE TEAM</div>
              <div className="font-display text-2xl font-black text-white">{summary.teamScores.blue}</div>
            </div>
            <div className="font-display text-xs tracking-widest text-slate-400 uppercase">
              {summary.winnerTeam === 'draw'
                ? 'DRAW'
                : `${summary.winnerTeam.toUpperCase()} VICTORY`}
            </div>
            <div className="px-5 py-2 bg-rose-950/60 border border-rose-500/50">
              <div className="text-[10px] font-display tracking-[0.2em] text-rose-400 uppercase">RED TEAM</div>
              <div className="font-display text-2xl font-black text-white">{summary.teamScores.red}</div>
            </div>
          </div>
        </header>

        {/* Personal Summary Strip */}
        {myRow && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="hud-panel hud-cut-sm border border-slate-700/80 p-4 text-center">
              <div className="text-[10px] font-display tracking-[0.2em] text-slate-400 uppercase">YOUR RANK</div>
              <div className="font-display text-2xl font-black text-amber-300">#{myRow.rank}</div>
            </div>
            <div className="hud-panel hud-cut-sm border border-slate-700/80 p-4 text-center">
              <div className="text-[10px] font-display tracking-[0.2em] text-slate-400 uppercase">TOTAL SCORE</div>
              <div className="font-display text-2xl font-black text-white">{myRow.totalScore}</div>
            </div>
            <div className="hud-panel hud-cut-sm border border-slate-700/80 p-4 text-center">
              <div className="text-[10px] font-display tracking-[0.2em] text-slate-400 uppercase">MATH ACCURACY</div>
              <div className="font-display text-2xl font-black text-emerald-400">
                {myRow.correctAnswers + myRow.wrongAnswers > 0
                  ? `${Math.round((myRow.correctAnswers / (myRow.correctAnswers + myRow.wrongAnswers)) * 100)}%`
                  : '0%'}
              </div>
            </div>
            <div className="hud-panel hud-cut-sm border border-slate-700/80 p-4 text-center">
              <div className="text-[10px] font-display tracking-[0.2em] text-slate-400 uppercase">KILLS / HEADSHOTS</div>
              <div className="font-display text-2xl font-black text-cyan-300">
                {myRow.kills} / {myRow.headshots}
              </div>
            </div>
          </section>
        )}

        {/* Complete Final Standings Table */}
        <section className="hud-panel hud-cut border border-slate-700/80 p-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <span className="font-display text-sm font-bold tracking-[0.2em] text-cyan-300 uppercase flex items-center gap-2">
              <Award className="w-4 h-4" /> FINAL STANDINGS
            </span>
            <span className="font-mono text-xs text-slate-400">ROOM {summary.roomCode}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="final-standings-table">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-display tracking-widest text-slate-400 uppercase">
                  <th className="py-2.5 px-3">RANK</th>
                  <th className="py-2.5 px-3">PLAYER</th>
                  <th className="py-2.5 px-3">TEAM</th>
                  <th className="py-2.5 px-3 text-right">MATH ✓</th>
                  <th className="py-2.5 px-3 text-right">KILLS</th>
                  <th className="py-2.5 px-3 text-right">HEADSHOTS</th>
                  <th className="py-2.5 px-3 text-right">DEATHS</th>
                  <th className="py-2.5 px-3 text-right">TOTAL SCORE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-sm">
                {summary.standings.map((row) => {
                  const isMe = row.playerId === myId
                  return (
                    <tr
                      key={row.playerId}
                      className={
                        row.rank === 1
                          ? 'bg-amber-500/10 text-white'
                          : isMe
                            ? 'bg-cyan-500/10 text-white'
                            : 'text-slate-200'
                      }
                    >
                      <td className="py-3 px-3 font-display font-black text-amber-300">
                        #{row.rank}
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        {row.name}
                        {isMe && (
                          <span className="ml-2 text-[10px] font-display px-1.5 py-0.5 bg-cyan-500/20 text-cyan-200 uppercase">
                            YOU
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
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
                      <td className="py-3 px-3 text-right font-display font-bold text-emerald-400">
                        {row.correctAnswers}
                      </td>
                      <td className="py-3 px-3 text-right font-display font-bold text-cyan-300">
                        {row.kills}
                      </td>
                      <td className="py-3 px-3 text-right font-display text-amber-300 inline-flex items-center justify-end gap-1 w-full">
                        <Target className="w-3.5 h-3.5" /> {row.headshots}
                      </td>
                      <td className="py-3 px-3 text-right font-display text-rose-400">
                        {row.deaths}
                      </td>
                      <td className="py-3 px-3 text-right font-display text-lg font-black text-white">
                        {row.totalScore}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Actions */}
        <footer className="flex flex-wrap items-center justify-center gap-4">
          {me?.isHost ? (
            <button
              id="btn-result-rematch"
              type="button"
              onClick={() => multiplayerClient.returnToLobby()}
              className="px-7 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-black text-sm tracking-wider uppercase hud-cut-sm flex items-center gap-2 cursor-pointer shadow-[0_0_24px_rgba(0,229,255,0.35)]"
            >
              <RotateCcw className="w-4 h-4" /> PLAY AGAIN (RETURN TO LOBBY)
            </button>
          ) : (
            <div className="px-5 py-3 bg-slate-900/90 border border-slate-700 font-thai text-sm text-slate-300">
              รอหัวหน้าห้องกด Play Again เพื่อเริ่มรอบใหม่...
            </div>
          )}

          <button
            id="btn-result-menu"
            type="button"
            onClick={() => multiplayerClient.leaveRoom()}
            className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-display font-bold text-sm tracking-wider uppercase hud-cut-sm flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> MAIN MENU
          </button>
        </footer>
      </div>
    </div>
  )
}
