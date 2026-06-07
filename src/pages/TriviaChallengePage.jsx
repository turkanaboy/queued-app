import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { fetchChallenge, submitAnswers } from '../lib/trivia'
import { InitialsAvatar } from '../components/Layout'
import { ScreenHeader } from '../lib/queuedDesign'

const FILL_IN_BLANK_TIMER_SECONDS = 20
const MCQ_TIMER_SECONDS = 10
const REVEAL_DURATION_MS = 1500
const SLIDE_OUT_MS = 280
const SLIDE_IN_MS = 320

// ── Helpers ───────────────────────────────────────────────────
function displayName(user) {
  return user?.display_name || user?.username || 'Player'
}

function winnerLabel(myScore, theirScore, myRole) {
  if (myScore > theirScore) return { text: 'You won! 🏆', color: '#2DD48F' }
  if (myScore < theirScore) return { text: `${myRole === 'challenger' ? 'They' : 'They'} won this time`, color: '#C96B4B' }
  return { text: "It's a tie! 🤝", color: '#D8A84A' }
}

// ── Sub-components ────────────────────────────────────────────

function CountdownBar({ timerSeconds, running, key: barKey }) {
  const style = running
    ? {
        animation: `countdown ${timerSeconds}s linear forwards`,
        animationPlayState: 'running',
      }
    : { width: running === false ? '0%' : '100%' }

  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-[rgba(150,214,180,0.13)]">
      <div
        key={barKey}
        className="h-full rounded-full bg-[#D8A84A]"
        style={style}
      />
    </div>
  )
}

function OptionButton({ label, text, state, onClick, disabled }) {
  // state: 'idle' | 'correct' | 'wrong' | 'faded'
  const base = 'btn-press relative w-full rounded-[16px] border px-4 py-3.5 text-left text-sm font-semibold transition-all'

  const stateStyles = {
    idle: 'border-[rgba(150,214,180,0.2)] bg-[rgba(9,46,32,0.6)] text-[#F7F1E4]',
    correct: 'border-[#2DD48F] bg-[rgba(45,212,143,0.18)] text-[#2DD48F]',
    wrong: 'border-rose-400 bg-rose-500/15 text-rose-300',
    faded: 'border-[rgba(150,214,180,0.1)] bg-[rgba(9,46,32,0.3)] opacity-30 text-[rgba(214,240,224,0.5)]',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${stateStyles[state] || stateStyles.idle}`}
      style={state === 'correct' ? { animation: 'qBounceIn 380ms cubic-bezier(0.16,1,0.3,1) both' } : undefined}
    >
      <span className="mr-3 font-mono text-xs font-bold opacity-60">{label}</span>
      {text}
      {state === 'correct' && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2DD48F]">✓</span>
      )}
      {state === 'wrong' && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-400">✗</span>
      )}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function TriviaChallengePage() {
  const { challengeId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const uid = session?.user?.id

  const [challenge, setChallenge] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // Quiz state
  const [screen, setScreen] = useState('loading') // loading | quiz | submitting | results | waiting | expired | error
  const [questionIndex, setQuestionIndex] = useState(0)
  const [phase, setPhase] = useState('active') // active | reveal | exit
  const [answers, setAnswers] = useState([]) // (number|string)[]
  const [selectedOption, setSelectedOption] = useState(null)
  const [timedOut, setTimedOut] = useState(false)
  const [fillInput, setFillInput] = useState('')
  const [fillSubmitted, setFillSubmitted] = useState(false)
  const [bonusBanner, setBonusBanner] = useState(false)

  // Results
  const [results, setResults] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Timer
  const timerRef = useRef(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const [barKey, setBarKey] = useState(0)

  // Load challenge
  useEffect(() => {
    if (!challengeId || !uid) return
    fetchChallenge(challengeId)
      .then(data => {
        setChallenge(data)
        setLoading(false)
        // Determine initial screen based on status + role
        if (data.initiator_id === uid && data.status === 'pending_initiator') {
          setScreen('quiz')
        } else if (data.challenger_id === uid && data.status === 'pending_challenger') {
          setScreen('quiz')
        } else if (data.status === 'completed') {
          setScreen('results')
        } else if (data.status === 'expired') {
          setScreen('expired')
        } else if (data.initiator_id === uid && data.status === 'pending_challenger') {
          setScreen('waiting')
        } else if (data.initiator_id !== uid && data.challenger_id !== uid) {
          navigate('/friends', { replace: true })
        } else {
          setScreen('waiting')
        }
      })
      .catch(err => {
        setLoadError(err.message)
        setLoading(false)
        setScreen('error')
      })
  }, [challengeId, uid, navigate])

  // Start timer when screen becomes quiz and phase becomes active
  const startTimer = useCallback((seconds) => {
    clearInterval(timerRef.current)
    setTimerRunning(true)
    setBarKey(k => k + 1)

    const deadline = Date.now() + seconds * 1000
    timerRef.current = setInterval(() => {
      if (Date.now() >= deadline) {
        clearInterval(timerRef.current)
        setTimerRunning(false)
        setTimedOut(true)
      }
    }, 100)
  }, [])

  useEffect(() => {
    if (screen !== 'quiz' || phase !== 'active' || !challenge) return
    const q = challenge.questions[questionIndex]
    const isFill = q?.type === 'fill_in_blank'
    startTimer(isFill ? FILL_IN_BLANK_TIMER_SECONDS : MCQ_TIMER_SECONDS)
    return () => clearInterval(timerRef.current)
  }, [screen, phase, questionIndex, challenge, startTimer])

  // Handle timeout
  useEffect(() => {
    if (!timedOut || phase !== 'active') return
    setTimedOut(false)
    triggerReveal(null) // null = timed out
  }, [timedOut, phase])

  function triggerReveal(optionIndex) {
    clearInterval(timerRef.current)
    setTimerRunning(false)
    setSelectedOption(optionIndex)
    setPhase('reveal')

    // After reveal duration, move to exit/next
    setTimeout(() => {
      setPhase('exit')
      setTimeout(() => {
        advanceQuestion(optionIndex)
      }, SLIDE_OUT_MS)
    }, REVEAL_DURATION_MS)
  }

  function handleOptionSelect(idx) {
    if (phase !== 'active') return
    triggerReveal(idx)
  }

  function handleFillSubmit() {
    if (phase !== 'active' || fillSubmitted) return
    setFillSubmitted(true)
    triggerReveal(fillInput)
  }

  function advanceQuestion(answer) {
    const newAnswers = [...answers, answer === null ? -1 : answer]
    setAnswers(newAnswers)
    setSelectedOption(null)
    setFillInput('')
    setFillSubmitted(false)
    setPhase('active')

    const next = questionIndex + 1
    if (next < 11) {
      // Check if next is Q11 (the bonus round, index 10)
      if (next === 10) {
        setBonusBanner(true)
        setTimeout(() => setBonusBanner(false), 2000)
      }
      setQuestionIndex(next)
    } else {
      // All done — submit
      setScreen('submitting')
      handleSubmit(newAnswers)
    }
  }

  async function handleSubmit(finalAnswers) {
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await submitAnswers(challengeId, finalAnswers)
      setResults(res)
      setScreen('results')
    } catch (err) {
      setSubmitError(err?.message || 'Failed to submit. Please try again.')
      setScreen('quiz') // allow retry — but we stay on the submission screen
      setSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────
  if (loading || screen === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-white/10" />
          <p className="text-sm text-[rgba(214,240,224,0.5)]">Loading challenge…</p>
        </div>
      </div>
    )
  }

  if (screen === 'error') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-base font-bold text-[#F7F1E4]">Challenge not found</p>
        <p className="text-sm text-[rgba(214,240,224,0.5)]">{loadError}</p>
        <button onClick={() => navigate('/friends')} className="btn-press btn-cream rounded-full px-6 py-2.5 text-sm font-bold">
          Back to Friends
        </button>
      </div>
    )
  }

  if (screen === 'expired') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="mb-2 text-4xl">⏰</div>
        <p className="text-xl font-extrabold text-[#F7F1E4]">Challenge expired</p>
        <p className="text-sm text-[rgba(214,240,224,0.5)]">This challenge wasn't answered in time.</p>
        <button onClick={() => navigate('/friends')} className="btn-press btn-cream mt-2 rounded-full px-6 py-2.5 text-sm font-bold">
          Back to Friends
        </button>
      </div>
    )
  }

  if (screen === 'waiting') {
    const opponentName = challenge?.initiator_id === uid
      ? displayName(challenge?.challenger)
      : displayName(challenge?.initiator)
    const myScore = results?.my_score
      ?? (challenge?.initiator_id === uid ? challenge?.initiator_score : challenge?.challenger_score)

    return (
      <div className="flex min-h-dvh flex-col">
        <ScreenHeader title="Challenge sent" eyebrow="Trivia" back={
          <button onClick={() => navigate('/friends')} className="btn-press mr-1 text-[rgba(214,240,224,0.5)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        } />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="text-5xl">🎯</div>
          {myScore != null && (
            <div className="rounded-[18px] border border-[#D8A84A]/30 bg-[rgba(216,168,74,0.08)] px-6 py-4">
              <p className="font-mono-q text-xs font-semibold uppercase tracking-[2px] text-[#D8A84A]">Your score</p>
              <p className="mt-1 text-4xl font-extrabold text-[#F7F1E4]">{myScore}<span className="text-xl text-[rgba(214,240,224,0.4)]">/13</span></p>
              {myScore >= 11 && <p className="mt-1 text-xs text-[#D8A84A]">+3 bonus included! ⭐</p>}
            </div>
          )}
          <div>
            <p className="text-base font-bold text-[#F7F1E4]">Waiting for {opponentName}…</p>
            <p className="mt-1 text-sm text-[rgba(214,240,224,0.5)]">
              They'll be notified and can answer anytime in the next 48 hours.
            </p>
          </div>
          <button onClick={() => navigate('/friends')} className="btn-press btn-cream mt-2 rounded-full px-6 py-2.5 text-sm font-bold">
            Back to Friends
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'submitting') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
        <div className="text-4xl">📡</div>
        <p className="text-base font-bold text-[#F7F1E4]">Submitting your answers…</p>
        {submitError && (
          <div className="mx-6 space-y-3">
            <p className="rounded-[12px] border border-rose-300/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{submitError}</p>
            <button onClick={() => handleSubmit(answers)} className="btn-press btn-cream rounded-full px-6 py-2.5 text-sm font-bold">
              Retry
            </button>
          </div>
        )}
      </div>
    )
  }

  if (screen === 'results') {
    return <ResultsScreen challenge={challenge} results={results} uid={uid} onBack={() => navigate('/friends')} />
  }

  // ── Quiz screen ───────────────────────────────────────────────
  if (!challenge?.questions) return null
  const questions = challenge.questions
  const currentQ = questions[questionIndex]
  const isBonus = questionIndex === 10
  const isFill = currentQ?.type === 'fill_in_blank'
  const timerSeconds = isFill ? FILL_IN_BLANK_TIMER_SECONDS : MCQ_TIMER_SECONDS

  // Compute option states for reveal
  function getOptionState(idx) {
    if (phase === 'active') return 'idle'
    if (timedOut) return 'faded' // shouldn't happen but guard
    const correctIdx = currentQ.correct_index
    if (selectedOption === null) {
      // Timed out — show correct
      return idx === correctIdx ? 'correct' : 'faded'
    }
    if (idx === correctIdx) return 'correct'
    if (idx === selectedOption && idx !== correctIdx) return 'wrong'
    return 'faded'
  }

  const slideStyle = phase === 'exit'
    ? { animation: `qSlideOutLeft ${SLIDE_OUT_MS}ms ease-in both` }
    : phase === 'active' || phase === 'reveal'
    ? { animation: `qSlideInRight ${SLIDE_IN_MS}ms cubic-bezier(0.16,1,0.3,1) both` }
    : {}

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden">
      {/* Header */}
      <div className="px-[18px] pb-2 pt-[52px]">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/friends')} className="btn-press text-[rgba(214,240,224,0.5)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="text-center">
            {isBonus ? (
              <p className="font-mono-q text-[10.5px] font-semibold uppercase tracking-[2px] text-[#D8A84A]">
                ⭐ Bonus Round
              </p>
            ) : (
              <p className="font-mono-q text-[10.5px] font-semibold uppercase tracking-[2px] text-[rgba(214,240,224,0.5)]">
                Question {questionIndex + 1} of 11
              </p>
            )}
          </div>
          <div className="w-5" />
        </div>

        {/* Progress dots */}
        <div className="mt-2 flex items-center gap-1">
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-all ${
                i < answers.length
                  ? 'h-1.5 bg-[#2DD48F]'
                  : i === questionIndex
                  ? i === 10 ? 'h-1.5 bg-[#D8A84A]' : 'h-1.5 bg-[#F4E9D1]'
                  : 'h-1 bg-[rgba(150,214,180,0.2)]'
              }`}
            />
          ))}
        </div>

        {/* Countdown bar */}
        <div className="mt-2">
          <CountdownBar timerSeconds={timerSeconds} running={phase === 'active'} key={`bar-${questionIndex}-${barKey}`} />
        </div>
      </div>

      {/* Bonus banner */}
      {bonusBanner && (
        <div className="mx-[18px] mb-2 overflow-hidden rounded-[14px] border border-[#D8A84A]/40 bg-[rgba(216,168,74,0.15)] px-4 py-3 text-center"
          style={{ animation: 'qBounceIn 380ms cubic-bezier(0.16,1,0.3,1) both' }}>
          <p className="text-sm font-extrabold text-[#D8A84A]">⭐ Bonus Round — worth 3 points!</p>
        </div>
      )}

      {/* Question card */}
      <div className="flex-1 overflow-hidden px-[18px]">
        <div style={slideStyle} key={`q-${questionIndex}`}>
          <div className="mb-4 rounded-[20px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.6)] px-5 py-5 shadow-[inset_3px_0_0_rgba(184,115,51,0.5)]">
            {currentQ?.media_title && (
              <p className="font-mono-q mb-1.5 text-[10px] font-semibold uppercase tracking-[1.6px] text-[rgba(214,240,224,0.45)]">
                {currentQ.media_title}
              </p>
            )}
            <p className="text-base font-bold leading-snug text-[#F7F1E4]">
              {currentQ?.question}
            </p>
            {isBonus && (
              <p className="mt-2 text-[11px] font-semibold text-[#D8A84A]">Fill in the blank • 3 pts</p>
            )}
          </div>

          {/* Multiple choice options */}
          {!isFill && (
            <div className="space-y-2.5">
              {(currentQ?.options ?? []).map((opt, idx) => (
                <OptionButton
                  key={idx}
                  label={['A', 'B', 'C', 'D'][idx]}
                  text={opt}
                  state={getOptionState(idx)}
                  onClick={() => handleOptionSelect(idx)}
                  disabled={phase !== 'active'}
                />
              ))}
            </div>
          )}

          {/* Fill in the blank */}
          {isFill && (
            <div className="space-y-3">
              {phase === 'reveal' ? (
                <div
                  className={`rounded-[16px] border px-4 py-3.5 text-center text-sm font-bold ${
                    selectedOption !== null && isFuzzyMatchClient(
                      typeof selectedOption === 'string' ? selectedOption : '',
                      currentQ?.accepted_answers ?? []
                    )
                      ? 'border-[#2DD48F] bg-[rgba(45,212,143,0.15)] text-[#2DD48F]'
                      : 'border-rose-400 bg-rose-500/10 text-rose-300'
                  }`}
                  style={{ animation: 'qBounceIn 380ms cubic-bezier(0.16,1,0.3,1) both' }}
                >
                  {selectedOption !== null && isFuzzyMatchClient(
                    typeof selectedOption === 'string' ? selectedOption : '',
                    currentQ?.accepted_answers ?? []
                  ) ? (
                    <span>Correct! +3 pts — {currentQ?.correct_display} ✓</span>
                  ) : selectedOption === null || selectedOption === '' ? (
                    <span>Time's up — the answer was <strong>{currentQ?.correct_display}</strong></span>
                  ) : (
                    <span>Incorrect — the answer was <strong>{currentQ?.correct_display}</strong></span>
                  )}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={fillInput}
                    onChange={e => setFillInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fillInput.trim() && handleFillSubmit()}
                    placeholder="Type your answer…"
                    autoFocus
                    disabled={fillSubmitted}
                    className="input-glass"
                  />
                  <button
                    type="button"
                    onClick={handleFillSubmit}
                    disabled={!fillInput.trim() || fillSubmitted}
                    className="btn-press btn-cream w-full rounded-full py-3 text-sm font-extrabold disabled:pointer-events-none disabled:opacity-40"
                  >
                    Submit answer
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timed-out label for MCQ */}
      {!isFill && phase === 'reveal' && selectedOption === null && (
        <div className="px-[18px] pb-4 pt-2 text-center">
          <p className="text-sm font-bold text-[rgba(214,240,224,0.5)]">⏰ Time's up!</p>
        </div>
      )}
    </div>
  )
}

// ── Client-side fuzzy match (for reveal feedback only) ────────
function normalizeClient(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an)\s+/i, '')
}

function levenshteinClient(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

function isFuzzyMatchClient(userInput, acceptedAnswers) {
  if (!userInput) return false
  const normalized = normalizeClient(userInput)
  if (!normalized) return false
  for (const accepted of acceptedAnswers) {
    const norm = normalizeClient(accepted)
    if (normalized === norm) return true
    const threshold = norm.length <= 8 ? 2 : 3
    if (levenshteinClient(normalized, norm) <= threshold) return true
  }
  return false
}

// ── Results screen ────────────────────────────────────────────
function ResultsScreen({ challenge, results, uid, onBack }) {
  const isInitiator = challenge?.initiator_id === uid
  const isChallenger = challenge?.challenger_id === uid

  // results.my_score is the fresh score from the edge function response.
  // challenge scores are fetched before submission so they're null at first render;
  // fall back to them only when viewing a previously-completed challenge.
  const myScore = results?.my_score ?? (isInitiator ? challenge?.initiator_score : challenge?.challenger_score)
  const theirScore = results?.their_score ?? (isInitiator ? challenge?.challenger_score : challenge?.initiator_score)
  const opponent = isInitiator ? challenge?.challenger : challenge?.initiator
  const opponentName = displayName(opponent)

  // If we just completed as initiator and don't have both scores yet (challenger hasn't gone)
  const challengerDone = challenge?.status === 'completed' || results?.challenger_score != null

  if (!challengerDone || theirScore == null) {
    // Initiator just finished, challenger hasn't gone
    return (
      <div className="flex min-h-dvh flex-col">
        <ScreenHeader title="Challenge sent!" eyebrow="Trivia" back={
          <button onClick={onBack} className="btn-press mr-1 text-[rgba(214,240,224,0.5)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        } />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="text-5xl">🎯</div>
          <div className="rounded-[18px] border border-[#D8A84A]/30 bg-[rgba(216,168,74,0.08)] px-8 py-5">
            <p className="font-mono-q text-xs font-semibold uppercase tracking-[2px] text-[#D8A84A]">Your score</p>
            <p className="mt-1 text-5xl font-extrabold text-[#F7F1E4]">
              {myScore}<span className="text-2xl text-[rgba(214,240,224,0.4)]">/13</span>
            </p>
            {myScore != null && myScore >= 11 && (
              <p className="mt-1.5 text-xs font-semibold text-[#D8A84A]">⭐ Bonus included!</p>
            )}
          </div>
          <div>
            <p className="text-base font-bold text-[#F7F1E4]">Waiting for {opponentName}…</p>
            <p className="mt-1 text-sm text-[rgba(214,240,224,0.5)]">
              They'll see the challenge on their Friends page.
            </p>
          </div>
          <button onClick={onBack} className="btn-press btn-cream mt-1 rounded-full px-6 py-2.5 text-sm font-bold">
            Back to Friends
          </button>
        </div>
      </div>
    )
  }

  // Both players done — full results
  const initiatorScore = isChallenger ? theirScore : myScore
  const challengerScore = isChallenger ? myScore : theirScore
  const winnerInfo = winnerLabel(myScore ?? 0, theirScore ?? 0, isChallenger ? 'challenger' : 'initiator')

  // Question details come from the results response (challenger) or aren't available (initiator viewing completed)
  const questionDetails = results?.question_details ?? null
  const challengerPerQ = results?.challenger_per_question ?? null

  return (
    <div className="min-h-dvh pb-8">
      <ScreenHeader title="Results" eyebrow="Trivia" back={
        <button onClick={onBack} className="btn-press mr-1 text-[rgba(214,240,224,0.5)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      } />

      <div className="space-y-4 px-[18px]">
        {/* Winner callout */}
        <div
          className="rounded-[20px] border border-[rgba(150,214,180,0.2)] bg-[rgba(12,62,44,0.6)] px-5 py-5 text-center"
          style={{ borderColor: winnerInfo.color + '40', animation: 'qBounceIn 420ms cubic-bezier(0.16,1,0.3,1) both' }}
        >
          <p className="text-xl font-extrabold" style={{ color: winnerInfo.color }}>
            {winnerInfo.text}
          </p>
        </div>

        {/* Score comparison */}
        <div className="flex items-center gap-3">
          <ScoreCard
            user={isInitiator ? challenge?.initiator : challenge?.challenger}
            score={myScore}
            label="You"
            highlight
          />
          <div className="font-mono-q text-lg font-bold text-[rgba(214,240,224,0.3)]">vs</div>
          <ScoreCard
            user={isInitiator ? challenge?.challenger : challenge?.initiator}
            score={theirScore}
            label={opponentName}
          />
        </div>

        {/* Question breakdown */}
        {questionDetails && (
          <div>
            <p className="mb-2.5 font-mono-q text-[10.5px] font-semibold uppercase tracking-[1.6px] text-[rgba(214,240,224,0.5)]">
              Question breakdown
            </p>
            <div className="overflow-hidden rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)]">
              {questionDetails.map((q, i) => {
                const challengerGotIt = challengerPerQ?.[i] ?? null
                const isB = i === 10
                return (
                  <div
                    key={i}
                    className={`px-4 py-3 ${i > 0 ? 'border-t border-[rgba(150,214,180,0.12)]' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono-q text-[9.5px] uppercase tracking-[1.2px] text-[rgba(214,240,224,0.4)]">
                          {isB ? '⭐ Bonus ×3' : `Q${i + 1}`}
                          {q.media_title && ` · ${q.media_title}`}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-[rgba(214,240,224,0.7)]">
                          {q.question}
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-[#2DD48F]">
                          ✓ {q.correct_answer}
                        </p>
                      </div>
                      {/* My result */}
                      {isChallenger && (
                        <div className={`shrink-0 text-lg ${challengerGotIt ? 'text-[#2DD48F]' : 'text-rose-400'}`}>
                          {challengerGotIt ? '✓' : '✗'}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button onClick={onBack} className="btn-press btn-cream w-full rounded-full py-3.5 text-sm font-extrabold">
          Back to Friends
        </button>
      </div>
    </div>
  )
}

function ScoreCard({ user, score, label, highlight = false }) {
  return (
    <div className={`flex flex-1 flex-col items-center rounded-[16px] border px-3 py-4 ${
      highlight
        ? 'border-[#D8A84A]/40 bg-[rgba(216,168,74,0.08)]'
        : 'border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.5)]'
    }`}>
      <InitialsAvatar name={user?.display_name || user?.username || label} size="sm" />
      <p className="mt-2 truncate text-xs font-bold text-[#F7F1E4]">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-[#F7F1E4]">
        {score ?? '—'}
        <span className="text-sm font-semibold text-[rgba(214,240,224,0.35)]">/13</span>
      </p>
    </div>
  )
}
