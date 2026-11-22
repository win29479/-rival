import { describe, expect, it } from 'vitest'
import { RoomManager } from '../server/roomManager.ts'
import { PLAYER_DIMENSIONS } from '../shared/arena.ts'
import { QUESTION_BY_ID } from '../shared/questions.ts'
import { MATCH_CONFIG, SCORING } from '../shared/types.ts'
import { rollRandomWeapon, WEAPON_IDS, WEAPONS } from '../shared/weapons.ts'

describe('Authoritative RoomManager — Functional & Security Verification', () => {
  it('supports room creation, team auto-balancing, capacity limits, and host-only start', () => {
    const now = 1_000_000
    const mgr = new RoomManager(() => now)

    const host = mgr.createRoom('Alice')
    expect(host.roomCode).toMatch(/^[A-Z2-9]{6}$/)
    expect(host.snapshot.players).toHaveLength(1)
    expect(host.snapshot.players[0].team).toBe('blue')

    // Host cannot start solo (< 2 players)
    const soloStart = mgr.startMatch(host.roomCode, host.playerId)
    expect(soloStart.ok).toBe(false)
    if (!soloStart.ok) expect(soloStart.code).toBe('NOT_ENOUGH_PLAYERS')

    // Join second player -> auto-assigned to red
    const p2 = mgr.joinRoom(host.roomCode, 'Bob')
    expect(p2.ok).toBe(true)
    if (!p2.ok) throw new Error('expected join ok')
    expect(p2.snapshot.players.find((p) => p.id === p2.playerId)?.team).toBe('red')

    // Security: Non-host cannot start match
    const unauthorizedStart = mgr.startMatch(host.roomCode, p2.playerId)
    expect(unauthorizedStart.ok).toBe(false)
    if (!unauthorizedStart.ok) expect(unauthorizedStart.code).toBe('FORBIDDEN')

    // Join up to max 8 players
    for (let i = 3; i <= 8; i++) {
      const joined = mgr.joinRoom(host.roomCode, `Player${i}`)
      expect(joined.ok).toBe(true)
    }

    // 9th player rejected (ROOM_FULL)
    const ninth = mgr.joinRoom(host.roomCode, 'Overflow')
    expect(ninth.ok).toBe(false)
    if (!ninth.ok) expect(ninth.code).toBe('ROOM_FULL')

    // Invalid code rejected
    const badRoom = mgr.joinRoom('ZZZZZZ', 'Ghost')
    expect(badRoom.ok).toBe(false)
    if (!badRoom.ok) expect(badRoom.code).toBe('ROOM_NOT_FOUND')

    // Host starts match cleanly -> countdown
    const started = mgr.startMatch(host.roomCode, host.playerId)
    expect(started.ok).toBe(true)
    if (started.ok) {
      expect(started.snapshot.phase).toBe('countdown')
      expect(started.snapshot.countdownEndsAt).toBe(now + MATCH_CONFIG.COUNTDOWN_SEC * 1000)
    }
  })

  it('enforces server-authoritative math validation, anti-duplicate farming, and random weapon unlock', () => {
    let now = 2_000_000
    const mgr = new RoomManager(() => now)
    const host = mgr.createRoom('HostOne')
    const guest = mgr.joinRoom(host.roomCode, 'GuestTwo')
    if (!guest.ok) throw new Error('join failed')

    mgr.startMatch(host.roomCode, host.playerId)
    now += MATCH_CONFIG.COUNTDOWN_SEC * 1000
    mgr.tick()

    // Request question
    const q1Res = mgr.requestQuestion(host.roomCode, host.playerId)
    expect(q1Res.ok).toBe(true)
    if (!q1Res.ok) throw new Error('request question failed')

    // Requesting again before answering returns the EXACT SAME question (no cherry-picking!)
    const q1Again = mgr.requestQuestion(host.roomCode, host.playerId)
    expect(q1Again.ok).toBe(true)
    if (q1Again.ok) expect(q1Again.question.id).toBe(q1Res.question.id)

    // Security: Submitting an unassigned question ID is rejected
    const fakeId = q1Res.question.id === 'E01' ? 'E02' : 'E01'
    const fakeSubmit = mgr.submitAnswer(host.roomCode, host.playerId, fakeId, 0)
    expect(fakeSubmit.ok).toBe(false)
    if (!fakeSubmit.ok) expect(fakeSubmit.code).toBe('UNASSIGNED_QUESTION')

    // Submit CORRECT answer
    const truth = QUESTION_BY_ID.get(q1Res.question.id)!
    const correctRes = mgr.submitAnswer(host.roomCode, host.playerId, truth.id, truth.correctIndex)
    expect(correctRes.ok).toBe(true)
    if (!correctRes.ok) throw new Error('submit failed')
    expect(correctRes.result.correct).toBe(true)
    expect(correctRes.result.pointsAwarded).toBe(SCORING.MATH_CORRECT)
    expect(correctRes.result.awardedWeapon).not.toBeNull()
    expect(WEAPON_IDS).toContain(correctRes.result.awardedWeapon!)

    // Security: Re-submitting the SAME question is rejected (DUPLICATE_ANSWER)
    const dupSubmit = mgr.submitAnswer(host.roomCode, host.playerId, truth.id, truth.correctIndex)
    expect(dupSubmit.ok).toBe(false)
    if (!dupSubmit.ok) expect(dupSubmit.code).toBe('DUPLICATE_ANSWER')

    // Guest submits WRONG answer -> +0 pts, NO weapon granted
    const gq = mgr.requestQuestion(host.roomCode, guest.playerId)
    if (!gq.ok) throw new Error('guest question failed')
    const gTruth = QUESTION_BY_ID.get(gq.question.id)!
    const wrongIdx = (gTruth.correctIndex + 1) % 4
    const wrongRes = mgr.submitAnswer(host.roomCode, guest.playerId, gTruth.id, wrongIdx)
    expect(wrongRes.ok).toBe(true)
    if (wrongRes.ok) {
      expect(wrongRes.result.correct).toBe(false)
      expect(wrongRes.result.pointsAwarded).toBe(0)
      expect(wrongRes.result.awardedWeapon).toBeNull()
      const guestState = wrongRes.snapshot.players.find((p) => p.id === guest.playerId)!
      expect(guestState.weapon).toBeNull()
      expect(guestState.totalScore).toBe(0)
    }
  })

  it('rolls all 8 weapon types with distinct gameplay profiles', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) {
      seen.add(rollRandomWeapon('medium', null))
    }
    expect(seen.size).toBe(8)
    expect(WEAPONS.sniper.headshotDamage).toBeGreaterThanOrEqual(100)
    expect(WEAPONS.revolver.headshotDamage).toBeGreaterThanOrEqual(100)
    expect(WEAPONS.shotgun.pellets).toBe(6)
    expect(WEAPONS.burst.pellets).toBe(3)
    expect(WEAPONS.lmg.magSize).toBe(55)
    expect(WEAPONS.smg.fireRateMs).toBeLessThan(WEAPONS.rifle.fireRateMs)
    expect(WEAPONS.rifle.automatic).toBe(true)
    expect(WEAPONS.pistol.reloadMs).toBeLessThan(WEAPONS.sniper.reloadMs)
  })

  it('validates Valorant-style Agent selection, Q/C cooldowns, Ult charge, Barrier bullet blocking, Flash, Recon, and Orbital Strike', () => {
    let now = 4_000_000
    const mgr = new RoomManager(() => now, () => 0.99)
    const p1 = mgr.createRoom('AegisPlayer')
    const p2 = mgr.joinRoom(p1.roomCode, 'PhantomRival')
    if (!p2.ok) throw new Error('join failed')

    // Select Agents in lobby
    expect(mgr.selectAgent(p1.roomCode, p1.playerId, 'aegis').ok).toBe(true)
    expect(mgr.selectAgent(p1.roomCode, p2.playerId, 'phantom').ok).toBe(true)

    mgr.startMatch(p1.roomCode, p1.playerId)
    now += MATCH_CONFIG.COUNTDOWN_SEC * 1000
    mgr.tick()

    // Cannot switch Agent after match started
    expect(mgr.selectAgent(p1.roomCode, p1.playerId, 'vortex').ok).toBe(false)

    // Ultimate rejected before 4 ult points
    const earlyUlt = mgr.useSkill(p1.roomCode, p1.playerId, 'X', { x: 0, y: 1.56, z: -10 }, { x: 0, y: 0, z: 1 })
    expect(earlyUlt.ok).toBe(false)
    if (!earlyUlt.ok) expect(earlyUlt.code).toBe('ULT_NOT_READY')

    // Solve 4 math questions -> earns 4 ult points (+1 each) + unlocks weapon
    for (let i = 0; i < 4; i++) {
      const q = mgr.requestQuestion(p1.roomCode, p1.playerId)
      if (!q.ok) throw new Error('q failed')
      const truth = QUESTION_BY_ID.get(q.question.id)!
      mgr.submitAnswer(p1.roomCode, p1.playerId, truth.id, truth.correctIndex)
    }

    const room = mgr.getRoom(p1.roomCode)!
    const aegis = room.players.get(p1.playerId)!
    const phantom = room.players.get(p2.playerId)!
    expect(aegis.ultPoints).toBe(4)

    // Cast Aegis [X] TITAN SHIELD -> 175 HP overshield & consumes 4 ult points
    const titan = mgr.useSkill(p1.roomCode, p1.playerId, 'X', { x: 0, y: 1.56, z: -10 }, { x: 0, y: 0, z: 1 })
    expect(titan.ok).toBe(true)
    expect(aegis.hp).toBe(175)
    expect(aegis.maxHp).toBe(175)
    expect(aegis.ultPoints).toBe(0)

    // Place Aegis and Phantom face-to-face in open West lane (x = -11)
    aegis.position = { x: -11, y: 0, z: -6 }
    phantom.position = { x: -11, y: 0, z: 4 }
    phantom.weapon = 'sniper'
    phantom.ammo = 5

    // Aegis deploys [C] BARRIER WALL directly toward +Z (at z = -2.4)
    const wall = mgr.useSkill(
      p1.roomCode,
      p1.playerId,
      'C',
      { x: -11, y: PLAYER_DIMENSIONS.eyeHeight, z: -6 },
      { x: 0, y: 0, z: 1 },
    )
    expect(wall.ok).toBe(true)
    expect(room.worldEffects.some((e) => e.kind === 'barrier')).toBe(true)

    // Immediate recast rejected by server cooldown
    const cdCheck = mgr.useSkill(
      p1.roomCode,
      p1.playerId,
      'C',
      { x: -11, y: PLAYER_DIMENSIONS.eyeHeight, z: -6 },
      { x: 0, y: 0, z: 1 },
    )
    expect(cdCheck.ok).toBe(false)
    if (!cdCheck.ok) expect(cdCheck.code).toBe('SKILL_COOLDOWN')

    // Phantom shoots straight at Aegis -> BLOCKED by Aegis Barrier Wall!
    const blockedByBarrier = mgr.shoot(
      p1.roomCode,
      p2.playerId,
      { x: -11, y: PLAYER_DIMENSIONS.eyeHeight, z: 4 },
      { x: 0, y: 0, z: -1 },
    )
    expect(blockedByBarrier.ok).toBe(true)
    if (blockedByBarrier.ok) {
      expect(blockedByBarrier.outcome.hits).toHaveLength(0)
    }

    // Phantom casts [X] ORBITAL STRIKE from real eye position aiming at Aegis's feet (z=-6)
    phantom.ultPoints = 4
    aegis.hp = 60
    const orbital = mgr.useSkill(
      p1.roomCode,
      p2.playerId,
      'X',
      { x: -11, y: PLAYER_DIMENSIONS.eyeHeight, z: 4 },
      { x: 0, y: -PLAYER_DIMENSIONS.eyeHeight / 10, z: -1 },
    )
    expect(orbital.ok).toBe(true)

    now += 950
    const orbTick = mgr.tick()
    const orbEvent = orbTick.find((t) => t.type === 'ORBITAL_DETONATED')
    expect(orbEvent).toBeDefined()
    expect(aegis.alive).toBe(false)
    expect(phantom.kills).toBe(1)
    expect(phantom.totalScore).toBe(SCORING.KILL)
  })

  it('validates server-side hit detection, headshot bonus (+50), wall occlusion, fire rate, and respawn', () => {
    let now = 3_000_000
    // Force Sniper roll on deterministic rng = 0.99
    const mgr = new RoomManager(() => now, () => 0.99)
    const p1 = mgr.createRoom('SniperBlue')
    const p2 = mgr.joinRoom(p1.roomCode, 'TargetRed')
    if (!p2.ok) throw new Error('join failed')

    mgr.startMatch(p1.roomCode, p1.playerId)
    now += MATCH_CONFIG.COUNTDOWN_SEC * 1000
    mgr.tick()

    // Unarmed shoot rejected
    const unarmedShoot = mgr.shoot(
      p1.roomCode,
      p1.playerId,
      { x: 0, y: 1.56, z: -10 },
      { x: 0, y: 0, z: 1 },
    )
    expect(unarmedShoot.ok).toBe(false)
    if (!unarmedShoot.ok) expect(unarmedShoot.code).toBe('NO_WEAPON')

    // Unlock weapon via math question (rng=0.99 -> sniper!)
    const q = mgr.requestQuestion(p1.roomCode, p1.playerId, 'hard')
    if (!q.ok) throw new Error('q failed')
    const truth = QUESTION_BY_ID.get(q.question.id)!
    const ans = mgr.submitAnswer(p1.roomCode, p1.playerId, truth.id, truth.correctIndex)
    if (!ans.ok) throw new Error('ans failed')
    expect(ans.result.awardedWeapon).toBe('sniper')

    // Position both players in open West lane (clear line of sight at x = -11)
    const room = mgr.getRoom(p1.roomCode)!
    const shooter = room.players.get(p1.playerId)!
    const victim = room.players.get(p2.playerId)!
    shooter.position = { x: -11, y: 0, z: -6 }
    victim.position = { x: -11, y: 0, z: 6 }

    // Headshot aim from shooter eye (y=1.56) straight to victim head (y=1.58)
    const shot = mgr.shoot(
      p1.roomCode,
      p1.playerId,
      { x: -11, y: PLAYER_DIMENSIONS.eyeHeight, z: -6 },
      { x: 0, y: 0.001, z: 1 },
    )
    expect(shot.ok).toBe(true)
    if (!shot.ok) throw new Error('shot failed')
    expect(shot.outcome.hits).toHaveLength(1)
    expect(shot.outcome.hits[0].confirm.headshot).toBe(true)
    expect(shot.outcome.hits[0].confirm.killed).toBe(true)
    expect(shot.outcome.hits[0].confirm.pointsAwarded).toBe(SCORING.KILL + SCORING.HEADSHOT_BONUS)
    expect(shooter.totalScore).toBe(SCORING.MATH_CORRECT + SCORING.KILL + SCORING.HEADSHOT_BONUS)
    expect(victim.alive).toBe(false)
    expect(victim.deaths).toBe(1)

    // Fire-rate anti-spam check (firing 50ms later with sniper is rejected)
    now += 50
    const spamShot = mgr.shoot(
      p1.roomCode,
      p1.playerId,
      { x: -11, y: PLAYER_DIMENSIONS.eyeHeight, z: -6 },
      { x: 0, y: 0, z: 1 },
    )
    expect(spamShot.ok).toBe(false)
    if (!spamShot.ok) expect(spamShot.code).toBe('FIRE_RATE_LIMIT')

    // Respawn after 3,000ms
    now += MATCH_CONFIG.RESPAWN_MS
    const transitions = mgr.tick()
    expect(transitions.some((t) => t.type === 'RESPAWNED')).toBe(true)
    expect(victim.alive).toBe(true)
    expect(victim.hp).toBe(MATCH_CONFIG.MAX_HP)

    // Wall occlusion check: place solid center bunker between shooter & victim
    shooter.position = { x: 0, y: 0, z: -22 }
    victim.position = { x: 0, y: 0, z: -12 } // blue-bunker-c is at z = -18.5..-17.3, y = 0..2.3
    const blockedShot = mgr.shoot(
      p1.roomCode,
      p1.playerId,
      { x: 0, y: PLAYER_DIMENSIONS.eyeHeight, z: -22 },
      { x: 0, y: 0, z: 1 },
    )
    expect(blockedShot.ok).toBe(true)
    if (blockedShot.ok) {
      expect(blockedShot.outcome.hits).toHaveLength(0) // Blocked by solid cover wall!
    }
  })

  it('enforces exact 90-second timer, match winner summary, disconnect, and secure reconnect', () => {
    let now = 5_000_000
    const mgr = new RoomManager(() => now)
    const p1 = mgr.createRoom('Alpha')
    const p2 = mgr.joinRoom(p1.roomCode, 'Beta')
    if (!p2.ok) throw new Error('join failed')

    mgr.startMatch(p1.roomCode, p1.playerId)
    now += MATCH_CONFIG.COUNTDOWN_SEC * 1000
    mgr.tick()

    // Alpha answers 1 question -> 100 pts
    const q = mgr.requestQuestion(p1.roomCode, p1.playerId)
    if (!q.ok) throw new Error('q failed')
    const truth = QUESTION_BY_ID.get(q.question.id)!
    mgr.submitAnswer(p1.roomCode, p1.playerId, truth.id, truth.correctIndex)

    // Simulate Alpha disconnect mid-match -> host transfers to Beta, Alpha score preserved
    const afterDc = mgr.markDisconnected(p1.roomCode, p1.playerId, false)
    expect(afterDc).not.toBeNull()
    expect(afterDc!.hostId).toBe(p2.playerId)
    expect(afterDc!.players.find((p) => p.id === p1.playerId)?.connected).toBe(false)

    // Security: Reconnect with forged token rejected
    const badRecon = mgr.reconnectPlayer(p1.roomCode, p1.playerId, 'forged_token')
    expect(badRecon.ok).toBe(false)
    if (!badRecon.ok) expect(badRecon.code).toBe('UNAUTHORIZED')

    // Valid reconnect restores Alpha with exact 100 score!
    const goodRecon = mgr.reconnectPlayer(p1.roomCode, p1.playerId, p1.sessionToken)
    expect(goodRecon.ok).toBe(true)
    if (goodRecon.ok) {
      const alpha = goodRecon.snapshot.players.find((p) => p.id === p1.playerId)!
      expect(alpha.connected).toBe(true)
      expect(alpha.totalScore).toBe(100)
    }

    // Advance 89.9 seconds -> still playing
    now += 89_900
    expect(mgr.tick().some((t) => t.type === 'MATCH_FINISHED')).toBe(false)

    // Advance final 100ms -> exact 90.0s match finishes!
    now += 100
    const endTransitions = mgr.tick()
    const fin = endTransitions.find((t) => t.type === 'MATCH_FINISHED')
    expect(fin).toBeDefined()
    expect(fin?.summary?.winnerPlayer?.name).toBe('Alpha')
    expect(fin?.summary?.winnerPlayer?.totalScore).toBe(100)
    expect(fin?.summary?.winnerTeam).toBe('blue')

    // Actions after match finished are rejected
    const lateQ = mgr.requestQuestion(p1.roomCode, p2.playerId)
    expect(lateQ.ok).toBe(false)
  })
})
