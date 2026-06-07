import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const OTDB_BASE = 'https://opentdb.com/api.php'
const CLAUDE_API = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-haiku-4-5'

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

// ── Levenshtein (used server-side for Q11 scoring too) ───────
// Kept here for self-containment; submit-trivia duplicates it.
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

// ── Claude call helper ────────────────────────────────────────
async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

// ── Generate Q1–Q10 multiple-choice questions via Claude ──────
interface MediaItem {
  title: string
  creator: string | null
  type: string
  is_random_fill: boolean
}

interface MultipleChoiceQuestion {
  type: 'multiple_choice'
  question: string
  options: [string, string, string, string]
  correct_index: 0 | 1 | 2 | 3
  media_title: string | null
  media_type: string | null
}

async function generateMCQQuestions(pool: MediaItem[], excludedTitles: string[]): Promise<MultipleChoiceQuestion[]> {
  const poolJson = JSON.stringify(pool.map(item => ({
    title: item.title,
    creator: item.creator,
    type: item.type,
    is_random_fill: item.is_random_fill,
  })))

  const systemPrompt = `You are a trivia question generator for a media-tracking app. Generate exactly one multiple-choice trivia question per media item provided.

Rules:
- Each question must be clearly about the specified media item
- For regular items (is_random_fill: false): ask questions answerable by someone who has seen/read/heard/played the work (plot, characters, cast, director/author/developer, themes, mechanics)
- For random fill items (is_random_fill: true): generate a question about a well-known, culturally popular title of that media type — pick your own well-known title, do NOT use any of these excluded titles: ${excludedTitles.join(', ')}
- Provide exactly 4 options (A, B, C, D) with exactly 1 correct answer
- Wrong answers must be plausible (same genre/era, sounds like it could be right)
- Mix difficulty: some easy, some medium, some hard
- Output ONLY a valid JSON array of objects with NO markdown, NO code fences, NO extra text
- Each object: { "type": "multiple_choice", "question": "...", "options": ["A","B","C","D"], "correct_index": 0, "media_title": "...", "media_type": "..." }
- correct_index is 0-based (0 = A, 1 = B, 2 = C, 3 = D)
- media_title should match the actual title (your chosen title for random fills)
- media_type should be one of: movie, tv, book, album, game`

  const userMessage = `Generate one trivia question for each of these ${pool.length} media items:\n${poolJson}`

  const parseResponse = (text: string): MultipleChoiceQuestion[] | null => {
    try {
      // Strip potential markdown code fences
      const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(cleaned)
      if (!Array.isArray(parsed) || parsed.length !== pool.length) return null
      for (const q of parsed) {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correct_index !== 'number') return null
      }
      return parsed
    } catch {
      return null
    }
  }

  let text = await callClaude(systemPrompt, userMessage)
  let questions = parseResponse(text)
  if (!questions) {
    // Retry with stricter prompt
    text = await callClaude(
      systemPrompt + '\n\nCRITICAL: Return ONLY the raw JSON array. No markdown. No explanation. Start your response with [ and end with ].',
      userMessage
    )
    questions = parseResponse(text)
  }
  if (!questions) throw new Error('Claude failed to return valid MCQ JSON after 2 attempts')
  return questions
}

// ── Generate Q11 fill-in-the-blank via Claude ─────────────────
interface FillInBlankQuestion {
  type: 'fill_in_blank'
  question: string
  accepted_answers: string[]
  correct_display: string
  points: 3
  media_title: null
  media_type: null
}

async function generateBonusQuestion(excludedTitles: string[]): Promise<FillInBlankQuestion> {
  const systemPrompt = `You are generating a bonus fill-in-the-blank trivia question for a media trivia game.

Pick a culturally well-known media title (movie, TV show, book, album, or video game) that is NOT in this list: ${excludedTitles.join(', ')}

The question should:
- Be a fill-in-the-blank sentence where the blank is the title of the work
- Be clearly identifiable from context clues in the sentence
- Be about something most people would recognize (blockbuster, classic, or massively popular)
- NOT give away the answer in the question text

Output ONLY a valid JSON object with NO markdown, NO code fences, NO extra text:
{
  "type": "fill_in_blank",
  "question": "..._____...",
  "accepted_answers": ["normalized answer", "alternate spelling if any"],
  "correct_display": "The Canonical Title",
  "points": 3,
  "media_title": null,
  "media_type": null
}

accepted_answers must be lowercase, no punctuation, no leading articles like "the"/"a"/"an".
Example: if the answer is "The Dark Knight", accepted_answers should be ["dark knight"]`

  const userMessage = 'Generate one fill-in-the-blank bonus trivia question.'

  const parseResponse = (text: string): FillInBlankQuestion | null => {
    try {
      const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(cleaned)
      if (
        parsed.type !== 'fill_in_blank' ||
        !parsed.question ||
        !Array.isArray(parsed.accepted_answers) ||
        parsed.accepted_answers.length === 0 ||
        !parsed.correct_display ||
        parsed.points !== 3
      ) return null
      return parsed
    } catch {
      return null
    }
  }

  let text = await callClaude(systemPrompt, userMessage)
  let question = parseResponse(text)
  if (!question) {
    text = await callClaude(
      systemPrompt + '\n\nCRITICAL: Return ONLY the raw JSON object. Start with { and end with }.',
      userMessage
    )
    question = parseResponse(text)
  }
  if (!question) throw new Error('Claude failed to return valid fill-in-blank JSON after 2 attempts')
  return question
}

// ── OTDB fetch for random mode ────────────────────────────────
async function fetchOTDBQuestions(count: number): Promise<MultipleChoiceQuestion[]> {
  const url = `${OTDB_BASE}?amount=${count}&type=multiple&encode=url3986`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OTDB fetch failed: ${res.status}`)
  const data = await res.json()
  if (data.response_code !== 0 || !Array.isArray(data.results)) {
    throw new Error(`OTDB returned response_code ${data.response_code}`)
  }
  return data.results.map((item: any) => {
    const correct = decodeURIComponent(item.correct_answer)
    const incorrects = (item.incorrect_answers as string[]).map(a => decodeURIComponent(a))
    // Insert correct answer at a random position among the 4 options
    const options: string[] = [...incorrects]
    const correctIdx = Math.floor(Math.random() * 4)
    options.splice(correctIdx, 0, correct)
    return {
      type: 'multiple_choice' as const,
      question: decodeURIComponent(item.question),
      options: options.slice(0, 4) as [string, string, string, string],
      correct_index: correctIdx as 0 | 1 | 2 | 3,
      media_title: null,
      media_type: null,
    }
  })
}

// ── Media pool builder ────────────────────────────────────────
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface LogEntry {
  media_id: string
  media_title: string
  media_creator: string | null
  media_type: string
}

function buildBalancedPool(
  initiatorLog: LogEntry[],
  challengerLog: LogEntry[],
  targetCount: number
): { pool: MediaItem[]; allTitles: string[] } {
  const challengerById = new Map(challengerLog.map(e => [e.media_id, e]))
  const shared: LogEntry[] = []
  const initiatorOnly: LogEntry[] = []
  const challengerOnly: LogEntry[] = []

  for (const entry of initiatorLog) {
    if (challengerById.has(entry.media_id)) shared.push(entry)
    else initiatorOnly.push(entry)
  }
  const sharedIds = new Set(shared.map(e => e.media_id))
  for (const entry of challengerLog) {
    if (!sharedIds.has(entry.media_id)) challengerOnly.push(entry)
  }

  const sharedShuffled = shuffleArray(shared)
  const initiatorShuffled = shuffleArray(initiatorOnly)
  const challengerShuffled = shuffleArray(challengerOnly)

  // Allocation
  let sharedCount: number
  if (shared.length >= 4) sharedCount = 4
  else if (shared.length >= 2) sharedCount = shared.length
  else sharedCount = Math.min(shared.length, 1)

  const remaining = targetCount - sharedCount
  const initiatorQuota = Math.ceil(remaining / 2)
  const challengerQuota = Math.floor(remaining / 2)

  const selectedShared = sharedShuffled.slice(0, sharedCount)
  const selectedInitiator = initiatorShuffled.slice(0, initiatorQuota)
  const selectedChallenger = challengerShuffled.slice(0, challengerQuota)

  // Count how many real items we have and how many fills are needed
  const realItems = [...selectedShared, ...selectedInitiator, ...selectedChallenger]
  const fillsNeeded = targetCount - realItems.length

  const pool: MediaItem[] = realItems.map(e => ({
    title: e.media_title,
    creator: e.media_creator,
    type: e.media_type,
    is_random_fill: false,
  }))

  // Random fills use is_random_fill: true — Claude picks a popular title
  for (let i = 0; i < fillsNeeded; i++) {
    pool.push({ title: '', creator: null, type: 'movie', is_random_fill: true })
  }

  const allTitles = realItems.map(e => e.media_title)
  return { pool: shuffleArray(pool), allTitles }
}

function buildMyMediaPool(
  initiatorLog: LogEntry[],
  targetCount: number
): { pool: MediaItem[]; allTitles: string[] } {
  const shuffled = shuffleArray(initiatorLog)
  const selected = shuffled.slice(0, targetCount)
  const fillsNeeded = targetCount - selected.length

  const pool: MediaItem[] = selected.map(e => ({
    title: e.media_title,
    creator: e.media_creator,
    type: e.media_type,
    is_random_fill: false,
  }))
  for (let i = 0; i < fillsNeeded; i++) {
    pool.push({ title: '', creator: null, type: 'movie', is_random_fill: true })
  }

  return { pool, allTitles: selected.map(e => e.media_title) }
}

// ── Main handler ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: { initiator_id?: string; challenger_id?: string; mode?: string; media_types?: string[] }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const { initiator_id, challenger_id, mode, media_types = [] } = body
  if (!initiator_id || !challenger_id || !mode) {
    return json({ error: 'initiator_id, challenger_id, and mode are required' }, 400)
  }
  if (!['balanced', 'my_media', 'random'].includes(mode)) {
    return json({ error: 'mode must be balanced, my_media, or random' }, 400)
  }

  // Auth: verify bearer token belongs to initiator_id
  const authHeader = req.headers.get('Authorization') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey')
  if (!anonKey) return json({ error: 'Supabase anon key not configured' }, 500)

  const userClient = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user || authData.user.id !== initiator_id) {
    return json({ error: 'forbidden' }, 403)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  try {
    let questions: (MultipleChoiceQuestion | FillInBlankQuestion)[]
    let allKnownTitles: string[] = []

    if (mode === 'random') {
      // Q1–Q10 from Open Trivia DB; Q11 from Claude
      const mcqQuestions = await fetchOTDBQuestions(10)
      const bonusQuestion = await generateBonusQuestion([])
      questions = [...mcqQuestions, bonusQuestion]
    } else {
      // Fetch logs
      const mediaTypeFilter = media_types.length > 0 ? media_types : ['movie', 'tv', 'book', 'album', 'game']

      const { data: initiatorLog } = await supabase
        .from('user_media_log')
        .select('media_id, media_title, media_creator, media_type')
        .eq('user_id', initiator_id)
        .in('status', ['finished', 'in_progress'])
        .in('media_type', mediaTypeFilter)

      const { data: challengerLog } = await supabase
        .from('user_media_log')
        .select('media_id, media_title, media_creator, media_type')
        .eq('user_id', challenger_id)
        .in('status', ['finished', 'in_progress'])
        .in('media_type', mediaTypeFilter)

      const iLog = (initiatorLog ?? []) as LogEntry[]
      const cLog = (challengerLog ?? []) as LogEntry[]

      // Build pool of 10 items for Q1–Q10
      let pool: MediaItem[]
      if (mode === 'balanced') {
        const result = buildBalancedPool(iLog, cLog, 10)
        pool = result.pool
        allKnownTitles = result.allTitles
      } else {
        // my_media
        const result = buildMyMediaPool(iLog, 10)
        pool = result.pool
        allKnownTitles = result.allTitles
      }

      // Generate Q1–Q10 via Claude
      const mcqQuestions = await generateMCQQuestions(pool, allKnownTitles)

      // Collect all titles Claude may have chosen for random fills so Q11 avoids them
      const allTitlesForBonus = [
        ...allKnownTitles,
        ...mcqQuestions.map(q => q.media_title).filter(Boolean) as string[],
      ]

      // Generate Q11 bonus question
      const bonusQuestion = await generateBonusQuestion(allTitlesForBonus)
      questions = [...mcqQuestions, bonusQuestion]
    }

    // Insert the challenge row
    const { data: challenge, error: insertError } = await supabase
      .from('trivia_challenges')
      .insert({
        initiator_id,
        challenger_id,
        mode,
        media_types: media_types.length > 0 ? media_types : ['movie', 'tv', 'book', 'album', 'game'],
        status: 'pending_initiator',
        questions,
      })
      .select('id')
      .single()

    if (insertError || !challenge) {
      return json({ error: insertError?.message ?? 'Failed to insert challenge' }, 500)
    }

    return json({ challenge_id: challenge.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message }, 500)
  }
})
