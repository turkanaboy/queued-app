import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.107.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_FILL_ANSWER_LENGTH = 200

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Fuzzy matching helpers ────────────────────────────────────
function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')      // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an)\s+/i, '') // strip leading articles
}

function levenshtein(a: string, b: string): number {
  if (a.length < b.length) [a, b] = [b, a]
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = a[i - 1] === b[j - 1]
        ? previous[j - 1]
        : 1 + Math.min(previous[j], current[j - 1], previous[j - 1])
    }
    previous = current
  }
  return previous[b.length]
}

function isFuzzyMatch(userInput: string, acceptedAnswers: string[]): boolean {
  if (!userInput) return false
  const normalized = normalizeAnswer(userInput)
  if (!normalized) return false

  for (const accepted of acceptedAnswers) {
    const normalizedAccepted = normalizeAnswer(accepted)
    if (normalized === normalizedAccepted) return true
    const threshold = normalizedAccepted.length <= 8 ? 2 : 3
    if (levenshtein(normalized, normalizedAccepted) <= threshold) return true
  }
  return false
}

// ── Scoring ───────────────────────────────────────────────────
interface MCQQuestion {
  type: 'multiple_choice'
  correct_index: number
}

interface FillInBlankQuestion {
  type: 'fill_in_blank'
  accepted_answers: string[]
  correct_display: string
  points: number
}

type Question = MCQQuestion | FillInBlankQuestion

function scoreAnswers(
  questions: Question[],
  answers: (number | string)[]
): { score: number; per_question: boolean[] } {
  const per_question: boolean[] = []
  let score = 0

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const answer = answers[i]

    if (q.type === 'fill_in_blank') {
      const userText = typeof answer === 'string' ? answer : ''
      const correct = isFuzzyMatch(userText, q.accepted_answers)
      per_question.push(correct)
      if (correct) score += q.points ?? 3
    } else {
      // multiple_choice
      const correct = typeof answer === 'number' && answer >= 0 && answer === q.correct_index
      per_question.push(correct)
      if (correct) score += 1
    }
  }

  return { score, per_question }
}

// ── Main handler ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: { challenge_id?: string; answers?: (number | string)[] }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const { challenge_id, answers } = body
  if (!challenge_id || !UUID_RE.test(challenge_id) || !Array.isArray(answers)) {
    return json({ error: 'challenge_id and answers array are required' }, 400)
  }
  if (answers.length !== 11) {
    return json({ error: `answers must have exactly 11 entries, got ${answers.length}` }, 400)
  }
  if (answers.some(answer =>
    typeof answer === 'string'
      ? answer.length > MAX_FILL_ANSWER_LENGTH
      : !Number.isInteger(answer) || answer < 0 || answer > 3
  )) {
    return json({ error: 'answers must be option indexes 0-3 or text up to 200 characters' }, 400)
  }

  // Auth: verify bearer token
  const authHeader = req.headers.get('Authorization') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey')
  if (!anonKey) return json({ error: 'Supabase anon key not configured' }, 500)

  const userClient = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'unauthorized' }, 401)

  const userId = authData.user.id

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: allowed, error: limitError } = await supabase.rpc('consume_edge_rate_limit', {
    p_user_id: userId,
    p_action: 'trivia_submit',
    p_limit: 30,
    p_window_seconds: 60,
  })
  if (limitError) return json({ error: limitError.message }, 500)
  if (!allowed) return json({ error: 'Too many submissions. Try again in a minute.' }, 429)

  // Fetch the challenge row
  const { data: challenge, error: fetchError } = await supabase
    .from('trivia_challenges')
    .select('*')
    .eq('id', challenge_id)
    .single()

  if (fetchError || !challenge) {
    return json({ error: 'challenge not found' }, 404)
  }

  // Determine role
  const isInitiator = userId === challenge.initiator_id
  const isChallenger = userId === challenge.challenger_id
  if (!isInitiator && !isChallenger) {
    return json({ error: 'forbidden' }, 403)
  }

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    const { error: expireError } = await supabase.rpc('wipe_expired_trivia_questions')
    if (expireError) return json({ error: expireError.message }, 500)
    return json({ error: 'challenge expired', status: 'expired' }, 410)
  }

  // Check it's the right turn
  if (isInitiator && challenge.status !== 'pending_initiator') {
    return json({ error: 'not your turn', status: challenge.status }, 409)
  }
  if (isChallenger && challenge.status !== 'pending_challenger') {
    return json({ error: 'not your turn', status: challenge.status }, 409)
  }

  // Score against the private answer key — the public questions column is
  // sanitized (no correct_index / accepted_answers) so clients can't cheat.
  const { data: keyQuestions, error: keyError } = await supabase.rpc('get_trivia_answer_key', {
    p_challenge_id: challenge_id,
  })
  if (keyError || !Array.isArray(keyQuestions)) {
    return json({ error: 'answer key unavailable for this challenge' }, 500)
  }
  const questions = keyQuestions as Question[]
  if (questions.length !== answers.length) {
    return json({ error: 'answer key is invalid for this challenge' }, 500)
  }
  const { score, per_question } = scoreAnswers(questions, answers)

  // Correct answers are only revealed AFTER the player submits — the answer key
  // never ships with the quiz, so this is the first time the client sees them.
  const questionDetails = (questions as any[]).map((q) => ({
    question: q.question,
    correct_answer: q.type === 'fill_in_blank' ? q.correct_display : q.options[q.correct_index],
    type: q.type,
    points: q.type === 'fill_in_blank' ? (q.points ?? 3) : 1,
    media_title: q.media_title ?? null,
    media_type: q.media_type ?? null,
  }))

  const { data: commitData, error: commitError } = await supabase.rpc('commit_trivia_score', {
    p_challenge_id: challenge_id,
    p_user_id: userId,
    p_score: score,
  })
  if (commitError) {
    const status = commitError.message.includes('forbidden') ? 403
      : commitError.message.includes('not your turn') ? 409
      : commitError.message.includes('not found') ? 404
      : 500
    return json({ error: commitError.message }, status)
  }
  const committed = Array.isArray(commitData) ? commitData[0] : commitData
  if (!committed) return json({ error: 'challenge update returned no result' }, 500)
  if (committed.status === 'expired') return json({ error: 'challenge expired', status: 'expired' }, 410)

  if (isInitiator) {
    if (committed.status !== 'pending_challenger') return json({ error: 'not your turn', status: committed.status }, 409)

    return json({
      ok: true,
      my_score: score,
      status: 'pending_challenger',
      question_details: questionDetails,
      my_per_question: per_question,
    })
  }

  if (committed.status !== 'completed') return json({ error: 'not your turn', status: committed.status }, 409)
  const initiatorScore = committed.initiator_score as number

  const winner =
    score > initiatorScore ? 'challenger'
    : score < initiatorScore ? 'initiator'
    : 'tie'

  return json({
    ok: true,
    my_score: score,
    their_score: initiatorScore,
    initiator_score: initiatorScore,
    challenger_score: score,
    winner,
    // Per-question breakdown for the results screen (submitter's perspective).
    question_details: questionDetails,
    my_per_question: per_question,
    challenger_per_question: per_question,
  })
})
