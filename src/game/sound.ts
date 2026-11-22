import type { WeaponId } from '../../shared/types.ts'
import { useGameStore } from '../store/useGameStore.ts'

class SoundEngine {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext | null {
    if (useGameStore.getState().muted) return null
    if (typeof window === 'undefined') return null
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null
    if (!this.ctx) {
      this.ctx = new AudioCtx()
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType,
    volume: number,
    delaySec = 0,
  ): void {
    const ctx = this.getContext()
    if (!ctx) return
    const now = ctx.currentTime + delaySec
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(Math.max(20, freqStart), now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + durationSec)
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0008, now + durationSec)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + durationSec + 0.02)
  }

  private playNoise(durationSec: number, filterFreq: number, volume: number, delaySec = 0): void {
    const ctx = this.getContext()
    if (!ctx) return
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * durationSec))
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    const gain = ctx.createGain()
    const now = ctx.currentTime + delaySec
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0008, now + durationSec)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    src.start(now)
    src.stop(now + durationSec)
  }

  playWeaponFire(weapon: WeaponId, scale = 1): void {
    switch (weapon) {
      case 'pistol':
        this.playTone(920, 210, 0.09, 'sawtooth', 0.14 * scale)
        this.playNoise(0.055, 2200, 0.09 * scale)
        break
      case 'revolver':
        this.playTone(460, 72, 0.22, 'sawtooth', 0.24 * scale)
        this.playTone(1240, 320, 0.12, 'triangle', 0.16 * scale)
        this.playNoise(0.14, 1100, 0.22 * scale)
        break
      case 'smg':
        this.playTone(1080, 310, 0.055, 'square', 0.095 * scale)
        this.playNoise(0.04, 2400, 0.08 * scale)
        break
      case 'rifle':
        this.playTone(680, 140, 0.075, 'square', 0.12 * scale)
        this.playNoise(0.05, 1600, 0.11 * scale)
        break
      case 'burst':
        // Crisp 3-round staggered pulse burst
        for (let i = 0; i < 3; i++) {
          this.playTone(860 - i * 40, 180, 0.06, 'sawtooth', 0.12 * scale, i * 0.048)
          this.playNoise(0.04, 1900, 0.09 * scale, i * 0.048)
        }
        break
      case 'shotgun':
        this.playTone(220, 48, 0.22, 'sawtooth', 0.24 * scale)
        this.playNoise(0.18, 700, 0.24 * scale)
        break
      case 'lmg':
        this.playTone(420, 95, 0.085, 'sawtooth', 0.14 * scale)
        this.playNoise(0.065, 1050, 0.14 * scale)
        break
      case 'sniper':
        this.playTone(1550, 90, 0.32, 'sawtooth', 0.22 * scale)
        this.playTone(440, 110, 0.28, 'triangle', 0.18 * scale)
        this.playNoise(0.14, 3000, 0.16 * scale)
        break
    }
  }

  playSkillCast(skillId: string, scale = 1): void {
    switch (skillId) {
      case 'dash':
        this.playTone(320, 1450, 0.16, 'sine', 0.16 * scale)
        this.playNoise(0.14, 2800, 0.14 * scale)
        break
      case 'flash':
        this.playTone(1850, 2900, 0.22, 'sine', 0.18 * scale)
        this.playNoise(0.16, 4200, 0.14 * scale)
        break
      case 'overdrive':
        this.playTone(260, 1320, 0.38, 'sawtooth', 0.16 * scale)
        this.playTone(520, 1760, 0.32, 'triangle', 0.14 * scale, 0.08)
        break
      case 'heal':
        this.playTone(520, 780, 0.16, 'sine', 0.14 * scale, 0)
        this.playTone(780, 1170, 0.22, 'sine', 0.14 * scale, 0.1)
        break
      case 'barrier':
        this.playTone(140, 480, 0.28, 'triangle', 0.2 * scale)
        this.playNoise(0.2, 900, 0.12 * scale)
        break
      case 'overshield':
        this.playTone(180, 660, 0.34, 'sawtooth', 0.16 * scale)
        this.playTone(360, 990, 0.32, 'sine', 0.16 * scale, 0.09)
        break
      case 'smoke':
        this.playNoise(0.38, 650, 0.18 * scale)
        this.playTone(240, 110, 0.3, 'sine', 0.12 * scale)
        break
      case 'blink':
        this.playTone(980, 220, 0.14, 'sine', 0.16 * scale)
        this.playTone(220, 1240, 0.15, 'triangle', 0.14 * scale, 0.08)
        break
      case 'orbital':
        this.playTone(1200, 90, 0.75, 'sawtooth', 0.2 * scale)
        this.playTone(160, 44, 0.6, 'sawtooth', 0.24 * scale, 0.85)
        this.playNoise(0.45, 500, 0.22 * scale, 0.85)
        break
      case 'recon':
        this.playTone(720, 1480, 0.24, 'sine', 0.16 * scale, 0)
        this.playTone(1480, 720, 0.26, 'sine', 0.12 * scale, 0.22)
        break
      case 'cluster':
      case 'barrage':
        this.playTone(360, 45, 0.36, 'sawtooth', 0.24 * scale)
        this.playNoise(0.32, 550, 0.26 * scale)
        break
    }
  }

  playReload(): void {
    this.playTone(340, 520, 0.06, 'triangle', 0.09, 0)
    this.playTone(580, 880, 0.08, 'triangle', 0.1, 0.14)
  }

  playHitMarker(headshot: boolean, killed: boolean): void {
    if (headshot) {
      this.playTone(1680, 2240, 0.09, 'sine', 0.2)
      this.playTone(2400, 1800, 0.08, 'triangle', 0.14, 0.03)
    } else {
      this.playTone(1120, 740, 0.06, 'triangle', 0.14)
    }
    if (killed) {
      this.playTone(520, 1040, 0.14, 'sine', 0.18, 0.04)
      this.playTone(1040, 1560, 0.18, 'triangle', 0.16, 0.11)
    }
  }

  playDamageTaken(): void {
    this.playTone(160, 55, 0.14, 'sawtooth', 0.18)
    this.playNoise(0.08, 420, 0.12)
  }

  playJump(jumpPad = false): void {
    if (jumpPad) {
      this.playTone(220, 980, 0.24, 'sine', 0.16)
      this.playTone(440, 1320, 0.2, 'triangle', 0.1, 0.04)
    } else {
      this.playTone(180, 340, 0.09, 'sine', 0.07)
    }
  }

  playMathCorrect(): void {
    this.playTone(523.25, 523.25, 0.11, 'triangle', 0.14, 0)
    this.playTone(659.25, 659.25, 0.11, 'triangle', 0.14, 0.08)
    this.playTone(783.99, 1046.5, 0.22, 'sine', 0.16, 0.16)
  }

  playMathWrong(): void {
    this.playTone(220, 180, 0.14, 'sawtooth', 0.12, 0)
    this.playTone(170, 130, 0.18, 'sawtooth', 0.12, 0.12)
  }

  playWeaponReveal(): void {
    this.playTone(330, 660, 0.18, 'sine', 0.12, 0)
    this.playTone(660, 1320, 0.26, 'triangle', 0.14, 0.08)
  }

  playCountdown(go = false): void {
    if (go) {
      this.playTone(880, 1320, 0.24, 'triangle', 0.2)
    } else {
      this.playTone(540, 540, 0.11, 'sine', 0.14)
    }
  }

  playMatchEnd(): void {
    this.playTone(523.25, 523.25, 0.2, 'triangle', 0.16, 0)
    this.playTone(659.25, 659.25, 0.2, 'triangle', 0.16, 0.16)
    this.playTone(783.99, 783.99, 0.22, 'triangle', 0.16, 0.32)
    this.playTone(1046.5, 1046.5, 0.45, 'sine', 0.18, 0.48)
  }
}

export const soundEngine = new SoundEngine()
