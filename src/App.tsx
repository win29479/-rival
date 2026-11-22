import { GameHUD } from './components/GameHUD.tsx'
import { LobbyScreen } from './components/LobbyScreen.tsx'
import { MainMenu } from './components/MainMenu.tsx'
import { MathModal } from './components/MathModal.tsx'
import { PauseMenu } from './components/PauseMenu.tsx'
import { ResultScreen } from './components/ResultScreen.tsx'
import { RoomScreen } from './components/RoomScreen.tsx'
import { ScoreboardOverlay } from './components/ScoreboardOverlay.tsx'
import { WeaponReveal } from './components/WeaponReveal.tsx'
import { ArenaScene } from './game/ArenaScene.tsx'
import { useGameStore } from './store/useGameStore.ts'

export default function App() {
  const screen = useGameStore((s) => s.screen)

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050811] hud-scanline">
      {/* Persistent 3D Neon Arena WebGL Layer (live backdrop on menus + FPS world in arena) */}
      <ArenaScene />

      {/* Active Game Screen */}
      {screen === 'menu' && <MainMenu />}
      {screen === 'room' && <RoomScreen />}
      {screen === 'lobby' && <LobbyScreen />}
      {screen === 'arena' && (
        <>
          <GameHUD />
          <MathModal />
          <WeaponReveal />
          <ScoreboardOverlay />
          <PauseMenu />
        </>
      )}
      {screen === 'result' && <ResultScreen />}
    </div>
  )
}
