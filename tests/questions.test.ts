import { describe, expect, it } from 'vitest'
import { pickNextQuestion, QUESTION_BANK, toPublicQuestion } from '../shared/questions.ts'

describe('Grade 10 Term 2 Math Question Bank (ค31102 หลักการนับเบื้องต้น)', () => {
  it('contains 48 unique, well-formed questions across easy, medium, and hard', () => {
    expect(QUESTION_BANK.length).toBe(48)

    const ids = new Set<string>()
    const counts = { easy: 0, medium: 0, hard: 0 }

    for (const q of QUESTION_BANK) {
      expect(ids.has(q.id)).toBe(false)
      ids.add(q.id)

      counts[q.difficulty]++
      expect(q.prompt.trim().length).toBeGreaterThan(10)
      expect(q.explanation.trim().length).toBeGreaterThan(10)
      expect(q.formulaHint.trim().length).toBeGreaterThan(3)
      expect(q.sourceRef.trim().length).toBeGreaterThan(3)
      expect(q.choices).toHaveLength(4)
      expect(new Set(q.choices).size).toBe(4) // All 4 choices distinct
      expect([0, 1, 2, 3]).toContain(q.correctIndex)
    }

    expect(counts.easy).toBe(14)
    expect(counts.medium).toBe(20)
    expect(counts.hard).toBe(14)
  })

  it('sanitizes questions before sending to clients (never leaks correctIndex)', () => {
    const pub = toPublicQuestion(QUESTION_BANK[0])
    expect('correctIndex' in pub).toBe(false)
    expect('explanation' in pub).toBe(false)
    expect(pub.id).toBe(QUESTION_BANK[0].id)
    expect(pub.choices).toHaveLength(4)
  })

  it('never repeats previously attempted questions until bank is exhausted', () => {
    const used = new Set<string>()
    for (let i = 0; i < QUESTION_BANK.length; i++) {
      const next = pickNextQuestion(used)
      expect(next).not.toBeNull()
      expect(used.has(next!.id)).toBe(false)
      used.add(next!.id)
    }
    expect(pickNextQuestion(used)).toBeNull()
  })
})
