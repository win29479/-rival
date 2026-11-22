import { BookOpen, CheckCircle2, Sparkles, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Difficulty } from '../../shared/types.ts'
import { WEAPONS } from '../../shared/weapons.ts'
import { multiplayerClient } from '../multiplayer/client.ts'
import { useGameStore } from '../store/useGameStore.ts'

const DIFF_META: Record<Difficulty, { label: string; badgeClass: string; oddsNote: string }> = {
  easy: {
    label: 'EASY',
    badgeClass: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300',
    oddsNote: 'สุ่มเร็ว • โอกาสได้ Pistol / Rifle สูง',
  },
  medium: {
    label: 'MEDIUM',
    badgeClass: 'bg-amber-500/20 border-amber-400/60 text-amber-300',
    oddsNote: 'สมดุล • โอกาสได้ Rifle / Shotgun / Sniper',
  },
  hard: {
    label: 'HARD',
    badgeClass: 'bg-rose-500/20 border-rose-400/60 text-rose-300',
    oddsNote: 'ระดับท้าทาย • โอกาสได้ Sniper / Shotgun สูงสุด!',
  },
}

export function MathModal() {
  const open = useGameStore((s) => s.mathModalOpen)
  const question = useGameStore((s) => s.activeQuestion)
  const lastAnswer = useGameStore((s) => s.lastAnswerResult)
  const setMathModalOpen = useGameStore((s) => s.setMathModalOpen)
  const clearLastAnswer = useGameStore((s) => s.clearLastAnswer)
  const errorMessage = useGameStore((s) => s.errorMessage)
  const [preferredDiff, setPreferredDiff] = useState<Difficulty | undefined>(undefined)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [hintQuestionId, setHintQuestionId] = useState<string | null>(null)

  const submitting = Boolean(question && submittingId === question.id)
  const showHint = Boolean(question && hintQuestionId === question.id)

  // Auto-close smoothly after a CORRECT answer so combat flow stays blazing fast
  useEffect(() => {
    if (!open || !lastAnswer?.correct) return
    const timer = window.setTimeout(() => {
      setMathModalOpen(false)
      clearLastAnswer()
    }, 1050)
    return () => window.clearTimeout(timer)
  }, [open, lastAnswer, setMathModalOpen, clearLastAnswer])

  // Fast keyboard answering (Keys 1, 2, 3, 4) & Enter/Space for Next Question
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (question && !lastAnswer && !submitting) {
        const keyMap: Record<string, number> = {
          Digit1: 0,
          Numpad1: 0,
          Digit2: 1,
          Numpad2: 1,
          Digit3: 2,
          Numpad3: 2,
          Digit4: 3,
          Numpad4: 3,
        }
        const idx = keyMap[e.code]
        if (idx !== undefined) {
          e.preventDefault()
          setSubmittingId(question.id)
          multiplayerClient.submitAnswer(question.id, idx)
        }
      } else if (lastAnswer && !lastAnswer.correct && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault()
        clearLastAnswer()
        multiplayerClient.requestQuestion(preferredDiff)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, question, lastAnswer, submitting, preferredDiff, clearLastAnswer])

  if (!open) return null

  const handleChoice = (idx: number) => {
    if (!question || submitting || lastAnswer) return
    setSubmittingId(question.id)
    multiplayerClient.submitAnswer(question.id, idx)
  }

  const handleNextQuestion = () => {
    clearLastAnswer()
    multiplayerClient.requestQuestion(preferredDiff)
  }

  const closeModal = () => {
    setMathModalOpen(false)
    clearLastAnswer()
  }

  const toggleHint = () => {
    if (!question) return
    setHintQuestionId((prev) => (prev === question.id ? null : question.id))
  }

  return (
    <div
      id="math-terminal-modal"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#040812]/65 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl hud-panel hud-cut border border-cyan-500/60 p-6 space-y-5 shadow-[0_0_60px_rgba(0,229,255,0.2)]">
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="font-display text-xs tracking-[0.22em] text-cyan-300 uppercase flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> TACTICAL MATH TERMINAL
            </span>
            {question && (
              <span
                className={`text-[11px] font-display font-bold px-2.5 py-0.5 border ${
                  DIFF_META[question.difficulty].badgeClass
                }`}
              >
                {DIFF_META[question.difficulty].label}
              </span>
            )}
          </div>

          <button
            id="btn-close-math"
            type="button"
            onClick={closeModal}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 cursor-pointer"
            title="ปิดหน้าต่าง (E / ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Question View */}
        {question && !lastAnswer && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-thai text-cyan-200 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1">
                หัวข้อ: {question.topic}
              </span>
              <button
                type="button"
                onClick={toggleHint}
                className="inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200 font-thai cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                {showHint ? `สูตร: ${question.formulaHint}` : 'ดูใบ้สูตร (Hint)'}
              </button>
            </div>

            <div
              id="math-question-prompt"
              className="p-4 bg-slate-950/90 border border-slate-800 text-white font-thai text-lg sm:text-xl leading-relaxed font-medium"
            >
              {question.prompt}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {question.choices.map((choice, idx) => (
                <button
                  key={idx}
                  id={`btn-math-choice-${idx}`}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleChoice(idx)}
                  className="group flex items-center gap-3 p-3.5 text-left bg-slate-900/90 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-400 transition hud-cut-sm cursor-pointer disabled:opacity-60"
                >
                  <span className="h-8 w-8 shrink-0 flex items-center justify-center font-display font-bold text-sm bg-slate-950 border border-slate-700 group-hover:border-cyan-400 text-cyan-300">
                    {idx + 1}
                  </span>
                  <span className="font-thai text-base font-semibold text-slate-100 group-hover:text-white">
                    {choice}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span className="font-thai">{DIFF_META[question.difficulty].oddsNote}</span>
              <span className="font-mono text-cyan-300">กดปุ่ม 1–4 เพื่อตอบด่วน</span>
            </div>
          </div>
        )}

        {/* Answer Feedback View */}
        {lastAnswer && (
          <div className="space-y-4">
            <div
              id="math-answer-feedback"
              className={`p-4 border flex items-start gap-3 ${
                lastAnswer.correct
                  ? 'bg-emerald-950/65 border-emerald-400/70 text-emerald-100'
                  : 'bg-rose-950/65 border-rose-500/70 text-rose-100'
              }`}
            >
              {lastAnswer.correct ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-7 h-7 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 flex-1">
                <div className="font-display text-lg font-extrabold tracking-wide">
                  {lastAnswer.correct
                    ? `CORRECT! +${lastAnswer.pointsAwarded} PTS`
                    : 'WRONG ANSWER • +0 PTS (NO WEAPON)'}
                </div>
                {lastAnswer.correct && lastAnswer.awardedWeapon && (
                  <div className="font-display text-sm text-cyan-300">
                    UNLOCKED: {WEAPONS[lastAnswer.awardedWeapon].name.toUpperCase()} — กลับสู่สนามรบ!
                  </div>
                )}
                {!lastAnswer.correct && (
                  <div className="font-thai text-sm text-amber-200 font-semibold">
                    คำตอบที่ถูกต้องคือ: {lastAnswer.correctChoiceText}
                  </div>
                )}
                <p className="font-thai text-sm text-slate-200 leading-relaxed pt-1">
                  วิธีคิด: {lastAnswer.explanation}
                </p>
              </div>
            </div>

            {/* Choose Next Difficulty & Retry with NEW Question */}
            {!lastAnswer.correct && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-thai text-slate-400 mr-1">ระดับข้อถัดไป:</span>
                  {([undefined, 'easy', 'medium', 'hard'] as Array<Difficulty | undefined>).map((d) => (
                    <button
                      key={d ?? 'any'}
                      type="button"
                      onClick={() => setPreferredDiff(d)}
                      className={`px-2.5 py-1 text-[11px] font-display uppercase border cursor-pointer ${
                        preferredDiff === d
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      {d ?? 'MIX'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-math-next"
                    type="button"
                    onClick={handleNextQuestion}
                    className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-extrabold text-xs tracking-wider uppercase hud-cut-sm cursor-pointer"
                  >
                    NEXT QUESTION (SPACE)
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-display text-xs uppercase cursor-pointer"
                  >
                    BACK TO ARENA
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading or Error Fallback */}
        {!question && !lastAnswer && (
          <div className="py-8 text-center space-y-3">
            <div className="font-thai text-slate-300">
              {errorMessage || 'กำลังสุ่มโจทย์คณิตศาสตร์จากเซิร์ฟเวอร์...'}
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 bg-slate-800 text-slate-200 text-xs font-display uppercase cursor-pointer"
            >
              RETURN TO ARENA
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
