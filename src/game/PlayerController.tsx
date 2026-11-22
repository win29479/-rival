import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { PLAYER_DIMENSIONS, resolvePlayerMovement, type ArenaBox } from '../../shared/arena.ts'
import type { SkillSlot } from '../../shared/types.ts'
import { WEAPONS } from '../../shared/weapons.ts'
import { multiplayerClient } from '../multiplayer/client.ts'
import { selectMyPlayer, useGameStore } from '../store/useGameStore.ts'
import { soundEngine } from './sound.ts'

const WALK_SPEED = 7.8
const SPRINT_SPEED = 11.4
const JUMP_VELOCITY = 8.4
const GRAVITY = 22.0
const DEFAULT_FOV = 75

export function PlayerController() {
  const gl = useThree((s) => s.gl)
  const getThreeState = useThree((s) => s.get)
  const keysRef = useRef<Set<string>>(new Set())
  const mouseDownRef = useRef(false)
  const velocityYRef = useRef(0)
  const groundedRef = useRef(true)
  const posRef = useRef({ x: 0, y: 0, z: -26 })
  const yawRef = useRef(Math.PI)
  const pitchRef = useRef(0)
  const lastShotClientAtRef = useRef(0)
  const prevAliveRef = useRef(true)
  const prevPhaseRef = useRef<string>('lobby')

  const castSkill = useCallback(
    (slot: SkillSlot) => {
      const state = useGameStore.getState()
      if (state.room?.phase !== 'playing') return
      if (state.mathModalOpen || state.pauseOpen) return
      const me = selectMyPlayer(state)
      if (!me || !me.alive) return

      const activeCamera = getThreeState().camera
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(activeCamera.quaternion).normalize()
      const origin = {
        x: posRef.current.x,
        y: posRef.current.y + PLAYER_DIMENSIONS.eyeHeight,
        z: posRef.current.z,
      }
      multiplayerClient.useSkill(slot, origin, { x: dir.x, y: dir.y, z: dir.z })
    },
    [getThreeState],
  )

  const attemptShoot = useCallback(() => {
    const state = useGameStore.getState()
    if (state.room?.phase !== 'playing') return
    if (state.mathModalOpen || state.pauseOpen) return
    const me = selectMyPlayer(state)
    if (!me || !me.alive) return

    if (!me.weapon) {
      if (!state.mathModalOpen) {
        if (document.pointerLockElement) document.exitPointerLock()
        multiplayerClient.requestQuestion()
      }
      return
    }

    const spec = WEAPONS[me.weapon]
    const now = performance.now()
    const serverNow = Date.now() + state.clockOffsetMs
    if (me.reloadingUntil && serverNow < me.reloadingUntil) return

    if (me.ammo <= 0) {
      multiplayerClient.reload()
      soundEngine.playReload()
      return
    }

    const overdriveActive = Boolean(me.overdriveUntil && serverNow < me.overdriveUntil)
    const effectiveFireRate = overdriveActive ? Math.floor(spec.fireRateMs * 0.65) : spec.fireRateMs
    if (now - lastShotClientAtRef.current < effectiveFireRate) return
    lastShotClientAtRef.current = now

    const activeCamera = getThreeState().camera
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(activeCamera.quaternion).normalize()
    const origin = {
      x: posRef.current.x,
      y: posRef.current.y + PLAYER_DIMENSIONS.eyeHeight,
      z: posRef.current.z,
    }

    state.triggerLocalShotVisual()
    soundEngine.playWeaponFire(me.weapon, 1)
    multiplayerClient.shoot(origin, { x: dir.x, y: dir.y, z: dir.z })
  }, [getThreeState])

  useEffect(() => {
    const domElement = gl.domElement

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === domElement
      const state = useGameStore.getState()
      state.setPointerLocked(locked)

      if (!locked && state.screen === 'arena' && state.room?.phase === 'playing' && !state.mathModalOpen) {
        state.setPauseOpen(true)
      }
      if (locked) {
        state.setPauseOpen(false)
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== domElement) return
      const state = useGameStore.getState()
      if (state.mathModalOpen || state.pauseOpen) return
      const sens = state.mouseSensitivity * (state.isAdsZoom ? 0.55 : 1)
      yawRef.current -= e.movementX * sens
      pitchRef.current = Math.max(
        -Math.PI / 2 + 0.08,
        Math.min(Math.PI / 2 - 0.08, pitchRef.current - e.movementY * sens),
      )
    }

    const onMouseDown = (e: MouseEvent) => {
      const state = useGameStore.getState()
      if (state.screen !== 'arena') return
      if (state.mathModalOpen || state.pauseOpen) return

      if (document.pointerLockElement !== domElement) {
        if (e.target === domElement) {
          void domElement.requestPointerLock?.()
        }
        return
      }

      if (e.button === 0) {
        mouseDownRef.current = true
        attemptShoot()
      } else if (e.button === 2) {
        state.setAdsZoom(true)
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        mouseDownRef.current = false
      } else if (e.button === 2) {
        useGameStore.getState().setAdsZoom(false)
      }
    }

    const onContextMenu = (e: MouseEvent) => {
      if (useGameStore.getState().screen === 'arena') {
        e.preventDefault()
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const state = useGameStore.getState()
      if (state.screen !== 'arena') return

      if (e.code === 'Tab') {
        e.preventDefault()
        state.setScoreboardOpen(true)
        return
      }

      if (e.code === 'Escape') {
        if (state.mathModalOpen) {
          state.setMathModalOpen(false)
          return
        }
        if (state.pauseOpen) {
          state.setPauseOpen(false)
          return
        }
        if (!document.pointerLockElement && state.room?.phase === 'playing') {
          state.setPauseOpen(true)
        }
        return
      }

      if (e.code === 'KeyE' && state.room?.phase === 'playing' && !state.pauseOpen) {
        e.preventDefault()
        if (state.mathModalOpen) {
          state.setMathModalOpen(false)
        } else {
          if (document.pointerLockElement) document.exitPointerLock()
          mouseDownRef.current = false
          state.setAdsZoom(false)
          if (state.activeQuestion) {
            state.setMathModalOpen(true)
          } else {
            multiplayerClient.requestQuestion()
          }
        }
        return
      }

      if (state.mathModalOpen || state.pauseOpen) return

      // Valorant-style Q / C / X Tactical Skill hotkeys
      if (state.room?.phase === 'playing') {
        if (e.code === 'KeyQ') {
          e.preventDefault()
          castSkill('Q')
          return
        }
        if (e.code === 'KeyC') {
          e.preventDefault()
          castSkill('C')
          return
        }
        if (e.code === 'KeyX') {
          e.preventDefault()
          castSkill('X')
          return
        }
      }

      keysRef.current.add(e.code)

      if (e.code === 'KeyR' && state.room?.phase === 'playing') {
        const me = selectMyPlayer(state)
        if (me?.weapon && me.ammo < WEAPONS[me.weapon].magSize && !me.reloadingUntil) {
          multiplayerClient.reload()
          soundEngine.playReload()
        }
      }

      if (e.code === 'Space' && groundedRef.current && state.room?.phase === 'playing') {
        velocityYRef.current = JUMP_VELOCITY
        groundedRef.current = false
        soundEngine.playJump(false)
      }

      if (e.code === 'KeyF' && state.room?.phase === 'playing') {
        attemptShoot()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code)
      if (e.code === 'Tab') {
        useGameStore.getState().setScoreboardOpen(false)
      }
    }

    const onBlur = () => {
      keysRef.current.clear()
      mouseDownRef.current = false
      useGameStore.getState().setAdsZoom(false)
      useGameStore.getState().setScoreboardOpen(false)
    }

    const onHudSkillEvent = (ev: Event) => {
      const slot = (ev as CustomEvent<SkillSlot>).detail
      if (slot === 'Q' || slot === 'C' || slot === 'X') {
        castSkill(slot)
      }
    }

    document.addEventListener('pointerlockchange', onPointerLockChange)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('math-rivals-cast-skill', onHudSkillEvent)

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('math-rivals-cast-skill', onHudSkillEvent)
    }
  }, [gl.domElement, attemptShoot, castSkill])

  useFrame((frameState, rawDelta) => {
    const cam = frameState.camera
    const dt = Math.min(rawDelta, 0.05)
    const state = useGameStore.getState()

    if (state.screen !== 'arena' || !state.room) {
      const t = frameState.clock.elapsedTime * 0.16
      const radius = 26
      cam.position.set(Math.sin(t) * radius, 11.5 + Math.sin(t * 1.4) * 1.4, Math.cos(t) * radius)
      cam.lookAt(0, 2.2, 0)
      if (cam instanceof THREE.PerspectiveCamera && Math.abs(cam.fov - 65) > 0.2) {
        cam.fov = 65
        cam.updateProjectionMatrix()
      }
      return
    }

    const me = selectMyPlayer(state)
    if (!me) return

    // Snap on phase change, respawn, or server-authorized Dash / Phase Blink
    const pendingSnap = state.consumePendingSnap()
    if (pendingSnap) {
      posRef.current = { ...pendingSnap }
    } else if (prevPhaseRef.current !== state.room.phase || (!prevAliveRef.current && me.alive)) {
      posRef.current = { ...me.position }
      yawRef.current = me.yaw
      pitchRef.current = 0
      velocityYRef.current = 0
      groundedRef.current = true
    }
    prevPhaseRef.current = state.room.phase
    prevAliveRef.current = me.alive

    // Smooth ADS FOV zoom
    if (cam instanceof THREE.PerspectiveCamera) {
      const targetFov =
        state.isAdsZoom && me.weapon && me.alive && !state.mathModalOpen
          ? WEAPONS[me.weapon].adsFov
          : DEFAULT_FOV
      if (Math.abs(cam.fov - targetFov) > 0.1) {
        cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, Math.min(1, dt * 14))
        cam.updateProjectionMatrix()
      }
    }

    if (!state.mathModalOpen && !state.pauseOpen) {
      const keys = keysRef.current
      if (keys.has('ArrowLeft')) yawRef.current += 2.2 * dt
      if (keys.has('ArrowRight')) yawRef.current -= 2.2 * dt
      if (keys.has('ArrowUp')) pitchRef.current = Math.min(Math.PI / 2 - 0.08, pitchRef.current + 1.6 * dt)
      if (keys.has('ArrowDown')) pitchRef.current = Math.max(-Math.PI / 2 + 0.08, pitchRef.current - 1.6 * dt)
    }

    cam.rotation.order = 'YXZ'
    cam.rotation.y = yawRef.current
    cam.rotation.x = pitchRef.current
    cam.rotation.z = 0

    if (!me.alive) {
      cam.position.set(posRef.current.x, posRef.current.y + 3.4, posRef.current.z + 2.5)
      cam.lookAt(posRef.current.x, posRef.current.y + 1, posRef.current.z)
      return
    }

    if (state.room.phase === 'playing' && !state.mathModalOpen && !state.pauseOpen) {
      const keys = keysRef.current
      let forwardInput = 0
      let strafeInput = 0
      if (keys.has('KeyW')) forwardInput += 1
      if (keys.has('KeyS')) forwardInput -= 1
      if (keys.has('KeyD')) strafeInput += 1
      if (keys.has('KeyA')) strafeInput -= 1

      const serverNow = Date.now() + state.clockOffsetMs
      const overdriveMult = me.overdriveUntil && serverNow < me.overdriveUntil ? 1.32 : 1.0
      const sprinting = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && forwardInput > 0 && !state.isAdsZoom
      const speed = (sprinting ? SPRINT_SPEED : state.isAdsZoom ? WALK_SPEED * 0.6 : WALK_SPEED) * overdriveMult

      let moveX = 0
      let moveZ = 0
      if (forwardInput !== 0 || strafeInput !== 0) {
        const len = Math.hypot(forwardInput, strafeInput)
        const nf = forwardInput / len
        const ns = strafeInput / len
        const sinY = Math.sin(yawRef.current)
        const cosY = Math.cos(yawRef.current)
        moveX = (-sinY * nf + cosY * ns) * speed * dt
        moveZ = (-cosY * nf - sinY * ns) * speed * dt
      }

      // Collect active 3D Aegis Barrier Walls for physical collision
      const dynamicBarriers: ArenaBox[] = []
      for (const eff of state.room.worldEffects) {
        if (eff.kind === 'barrier' && eff.box && eff.expiresAt > serverNow) {
          dynamicBarriers.push({
            id: eff.id,
            minX: eff.box.minX,
            maxX: eff.box.maxX,
            minY: eff.box.minY,
            maxY: eff.box.maxY,
            minZ: eff.box.minZ,
            maxZ: eff.box.maxZ,
            kind: 'glass',
            accent: eff.ownerTeam,
          })
        }
      }

      velocityYRef.current -= GRAVITY * dt
      const desired = {
        x: posRef.current.x + moveX,
        y: posRef.current.y + velocityYRef.current * dt,
        z: posRef.current.z + moveZ,
      }

      const resolved = resolvePlayerMovement(
        posRef.current,
        desired,
        velocityYRef.current,
        dynamicBarriers,
      )
      posRef.current = resolved.position
      velocityYRef.current = resolved.velocityY
      groundedRef.current = resolved.grounded

      if (resolved.hitJumpPad) {
        soundEngine.playJump(true)
      }

      if (mouseDownRef.current && me.weapon && WEAPONS[me.weapon].automatic) {
        attemptShoot()
      }
    }

    cam.position.set(
      posRef.current.x,
      posRef.current.y + PLAYER_DIMENSIONS.eyeHeight,
      posRef.current.z,
    )

    state.setLocalTransform(posRef.current, yawRef.current, pitchRef.current)
    multiplayerClient.sendMove(posRef.current, yawRef.current, pitchRef.current)
  })

  return null
}
