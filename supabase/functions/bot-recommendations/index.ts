import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'
const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p/w300'
const DEFAULT_PLATFORMS = [8, 9, 15, 337, 384] // Netflix, Prime, Hulu, Disney+, Max
const ACTIVE_STATUSES = ['not_yet_viewed', 'queued', 'in_progress']

const GENRE_IDS: Record<string, number> = {
  Action: 28,
  Comedy: 35,
  Drama: 18,
  Horror: 27,
  'Sci-Fi': 878,
  Romance: 10749,
  Thriller: 53,
  Documentary: 99,
  Animation: 16,
  Fantasy: 14,
}

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

function pickGenreFilter(genres: string[] | null | undefined) {
  const ids = (genres ?? []).map(g => GENRE_IDS[g]).filter(Boolean)
  return ids.length ? `&with_genres=${ids.slice(0, 3).join('|')}` : ''
}

function recommendationNote(item: any, user: any, reason: string) {
  const score = item.vote_average ? `${item.vote_average.toFixed(1)} stars` : 'strong audience response'
  const style = user?.watching_style ? ` Your intake says ${user.watching_style.replace('_', ' ')} is your usual mode.` : ''
  const genres = user?.favorite_genres?.length ? ` It is nudged toward ${user.favorite_genres.slice(0, 3).join(', ')}.` : ''
  return `${reason} ${score} from ${(item.vote_count ?? 0).toLocaleString()} ratings.${genres}${style}`.slice(0, 500)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { user_id } = await req.json()
  if (!user_id) return json({ error: 'user_id required' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const { data: active } = await supabase
    .from('recommendations')
    .select('id, media_title, media_type, recipient_status, created_at')
    .eq('sender_id', BOT_USER_ID)
    .eq('recipient_id', user_id)
    .in('recipient_status', ACTIVE_STATUSES)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (active) {
    return json({ ok: true, sent: 0, active: true, recommendation: active })
  }

  const { data: user } = await supabase
    .from('users')
    .select('platforms, favorite_genres, watching_style')
    .eq('id', user_id)
    .single()

  const [{ data: previousRecs }, { data: previousLog }] = await Promise.all([
    supabase
      .from('recommendations')
      .select('media_id')
      .eq('recipient_id', user_id)
      .eq('sender_id', BOT_USER_ID)
      .is('deleted_at', null),
    supabase
      .from('user_media_log')
      .select('media_id')
      .eq('user_id', user_id),
  ])

  const seen = new Set([
    ...(previousRecs ?? []).map((r: any) => r.media_id),
    ...(previousLog ?? []).map((r: any) => r.media_id),
  ])

  await supabase.from('friendships').upsert({
    user_a_id: BOT_USER_ID,
    user_b_id: user_id,
    requester_id: BOT_USER_ID,
    status: 'accepted',
  }, { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: true })

  const platforms = (user?.platforms?.length ?? 0) > 0 ? user!.platforms : DEFAULT_PLATFORMS
  const providerFilter = platforms.join('|')
  const apiKey = Deno.env.get('TMDB_API_KEY')
  const genreFilter = pickGenreFilter(user?.favorite_genres)

  const urls = [
    {
      type: 'movie',
      reason: 'Queued Bot picked this as one strong movie candidate on your platforms.',
      url: `${TMDB_BASE}/discover/movie?api_key=${apiKey}&with_watch_providers=${providerFilter}&watch_region=US&sort_by=vote_average.desc&vote_count.gte=200&include_adult=false&language=en-US${genreFilter}`,
    },
    {
      type: 'tv',
      reason: 'Queued Bot picked this as one strong TV candidate on your platforms.',
      url: `${TMDB_BASE}/discover/tv?api_key=${apiKey}&with_watch_providers=${providerFilter}&watch_region=US&sort_by=vote_average.desc&vote_count.gte=100&include_adult=false&language=en-US${genreFilter}`,
    },
  ]

  const responses = await Promise.all(urls.map(item => fetch(item.url).then(res => res.json()).then(data => ({ ...item, data }))))
  const candidates = responses.flatMap(({ type, reason, data }) =>
    (data.results ?? []).map((item: any) => ({ type, reason, item }))
  )

  candidates.sort((a, b) => {
    const aScore = (a.item.vote_average ?? 0) * Math.log10((a.item.vote_count ?? 0) + 10)
    const bScore = (b.item.vote_average ?? 0) * Math.log10((b.item.vote_count ?? 0) + 10)
    return bScore - aScore
  })

  for (const candidate of candidates) {
    const mediaId = String(candidate.item.id)
    if (seen.has(mediaId)) continue

    const rec = {
      sender_id: BOT_USER_ID,
      recipient_id: user_id,
      media_type: candidate.type,
      media_id: mediaId,
      media_title: candidate.type === 'movie' ? candidate.item.title : candidate.item.name,
      media_poster_url: candidate.item.poster_path ? `${IMG_BASE}${candidate.item.poster_path}` : null,
      note: recommendationNote(candidate.item, user, candidate.reason),
      streaming_providers: [],
    }

    const { data, error } = await supabase
      .from('recommendations')
      .insert(rec)
      .select('id, media_title, media_type, recipient_status, created_at')
      .single()

    if (!error) return json({ ok: true, sent: 1, active: false, recommendation: data })
  }

  return json({ ok: true, sent: 0, active: false, exhausted: true })
})
