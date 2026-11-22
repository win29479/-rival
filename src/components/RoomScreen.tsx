import { ArrowLeft, KeyRound, PlusCircle, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { multiplayerClient } from '../multiplayer/client.ts'
import { useGameStore } from '../store/useGameStore.ts'

export function RoomScreen() {
  const playerName = useGameStore((s) => s.playerName)
  const setPlayerName = useGameStore((s) => s.setPlayerName)
  const setScreen = useGameStore((s) => s.setScreen)
  const connectionStatus = useGameStore((s) => s.connectionStatus)
  const errorMessage = useGameStore((s) => s.errorMessage)
  const [roomCode, setRoomCode] = useState('')
  const [busy, setBusy] = useState(false)

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const name = playerName.trim() || `Rival_${Math.floor(100 + Math.random() * 900)}`
    setPlayerName(name)
    await multiplayerClient.joinRoom(roomCode, name)
    setBusy(false)
  }

  const handleCreate = async () => {
    if (busy) return
    setBusy(true)
    const name = playerName.trim() || `Rival_${Math.floor(100 + Math.random() * 900)}`
    setPlayerName(name)
    await multiplayerClient.createRoom(name)
    setBusy(false)
  }

  return (
    <div className="relative z-10 flex flex-col justify-center items-center h-full w-full p-6 bg-[#040812]/80">
      <div className="w-full max-w-xl hud-panel hud-cut border border-slate-700/80 p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <button
            id="btn-room-back"
            type="button"
            onClick={() => setScreen('menu')}
            className="inline-flex items-center gap-2 text-xs font-display tracking-widest text-slate-400 hover:text-cyan-300 uppercase cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> BACK
          </button>
          <span className="font-display text-xs tracking-[0.24em] text-cyan-400 uppercase">
            MULTIPLAYER ROOMS (2–8 PLAYERS)
          </span>
        </div>

        <div className="space-y-1">
          <h2 className="font-display text-3xl font-black text-white tracking-wide">
            ENTER THE ARENA
          </h2>
          <p className="font-thai text-sm text-slate-400">
            สร้างห้องใหม่เพื่อรับรหัส 6 หลักส่งให้เพื่อน หรือกรอกรหัสห้องของเพื่อนเพื่อเข้าร่วมทันที
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="input-room-player-name"
            className="block text-xs font-display tracking-[0.2em] text-slate-400 uppercase"
          >
            PLAYER CALLSIGN
          </label>
          <input
            id="input-room-player-name"
            type="text"
            maxLength={18}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="ชื่อของคุณในสนามแข่ง"
            className="w-full px-4 py-3 bg-slate-950/90 border border-slate-700 focus:border-cyan-400 focus:outline-none text-white font-semibold"
          />
        </div>

        {errorMessage && (
          <div
            id="room-error-banner"
            className="px-4 py-3 bg-rose-950/80 border border-rose-500/70 text-rose-200 text-sm font-thai"
          >
            {errorMessage}
          </div>
        )}

        {/* Join Existing Room Form */}
        <form onSubmit={handleJoin} className="space-y-3 pt-2 border-t border-slate-800">
          <label
            htmlFor="input-room-code"
            className="flex items-center gap-2 text-xs font-display tracking-[0.2em] text-rose-400 uppercase"
          >
            <KeyRound className="w-3.5 h-3.5" /> JOIN WITH 6-CHAR ROOM CODE
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="input-room-code"
              type="text"
              maxLength={6}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="เช่น M4R8K2"
              className="flex-1 px-4 py-3 bg-slate-950/90 border border-slate-700 focus:border-rose-400 focus:outline-none text-white font-display font-bold text-xl tracking-[0.35em] uppercase placeholder:tracking-normal placeholder:font-thai placeholder:text-sm placeholder:text-slate-500"
            />
            <button
              id="btn-join-room-submit"
              type="submit"
              disabled={busy || roomCode.trim().length !== 6}
              className="px-6 py-3 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-display font-extrabold tracking-wider text-sm uppercase hud-cut-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:cursor-not-allowed"
            >
              <Users className="w-4 h-4" />
              {busy && connectionStatus === 'connecting' ? 'JOINING...' : 'JOIN ROOM'}
            </button>
          </div>
        </form>

        {/* Or Create New Room */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
          <div className="font-thai text-xs text-slate-400">
            ยังไม่มีห้อง? สร้างห้องใหม่แล้วแชร์ Room Code ให้เพื่อน
          </div>
          <button
            id="btn-create-room-submit"
            type="button"
            disabled={busy}
            onClick={handleCreate}
            className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 font-display font-extrabold tracking-wider text-xs uppercase hud-cut-sm flex items-center gap-2 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            CREATE NEW ROOM
          </button>
        </div>
      </div>
    </div>
  )
}
