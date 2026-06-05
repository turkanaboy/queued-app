import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'
const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p/w300'
const OL_BASE = 'https://openlibrary.org'
const OL_COVER = 'https://covers.openlibrary.org/b/id'
const ITUNES_BASE = 'https://itunes.apple.com'
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
  Adventure: 12,
  Crime: 80,
  Dramedy: 35,
  Mystery: 9648,
  'Ghost stories': 27,
  Superhero: 28,
  'Animated series': 16,
  Docuseries: 99,
}

const BOOK_SUBJECTS: Record<string, string> = {
  Biography: 'biography',
  'Book club fiction': 'fiction',
  Fantasy: 'fantasy',
  'Historical fiction': 'historical_fiction',
  Horror: 'horror',
  'Literary fiction': 'literary_fiction',
  Memoir: 'memoir',
  Mystery: 'mystery',
  Nonfiction: 'nonfiction',
  Romance: 'romance',
  'Sci-Fi': 'science_fiction',
  'Short stories': 'short_stories',
  Thriller: 'thriller',
}

const ALBUM_GENRES: Record<string, string> = {
  Alternative: 'alternative',
  Country: 'country',
  Electronic: 'electronic',
  Folk: 'folk',
  'Hip-Hop': 'hip-hop',
  Indie: 'indie',
  Jazz: 'jazz',
  Pop: 'pop',
  'R&B': 'r&b',
  Rock: 'rock',
  'Singer-songwriter': 'singer-songwriter',
  Soul: 'soul',
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

function pickMappedTerm(genres: string[] | null | undefined, map: Record<string, string>, fallback: string) {
  return (genres ?? []).map(g => map[g]).find(Boolean) ?? fallback
}

function preferredMediaTypes(log: any[] = []) {
  const scores: Record<string, number> = { movie: 0, tv: 0, book: 0, album: 0 }
  for (const item of log) {
    const rating = Number(item.rating ?? 0)
    if (scores[item.media_type] == null) continue
    scores[item.media_type] += rating > 0 ? rating : 1
  }
  return Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([type]) => type)
}

function scoreCandidate(candidate: any, typePreference: string[], genres: string[] = []) {
  const base = candidate.score ?? 0
  const typeBoost = Math.max(0, 4 - typePreference.indexOf(candidate.type)) * 0.3
  const haystack = `${candidate.media_title} ${candidate.media_creator ?? ''} ${candidate.genre ?? ''}`.toLowerCase()
  const genreBoost = genres.some(g => haystack.includes(String(g).toLowerCase())) ? 0.8 : 0
  return base + typeBoost + genreBoost
}

function recommendationNote(item: any, user: any, reason: string) {
  const score = item.vote_average ? `${item.vote_average.toFixed(1)} stars` : 'strong audience response'
  const style = user?.watching_style ? ` Your intake says ${user.watching_style.replace('_', ' ')} is your usual mode.` : ''
  const genres = user?.favorite_genres?.length ? ` It is nudged toward ${user.favorite_genres.slice(0, 3).join(', ')}.` : ''
  return `${reason} ${score} from ${(item.vote_count ?? 0).toLocaleString()} ratings.${genres}${style}`.slice(0, 500)
}

async function upsertRecommendationLog(supabase: any, recommendation: any, userId: string) {
  return await supabase
    .from('user_media_log')
    .upsert({
      user_id: userId,
      media_type: recommendation.media_type,
      media_id: recommendation.media_id,
      media_title: recommendation.media_title,
      media_creator: recommendation.media_creator ?? null,
      media_poster_url: recommendation.media_poster_url,
      status: recommendation.recipient_status,
      source_type: 'recommendation',
      source_user_id: recommendation.sender_id ?? BOT_USER_ID,
      streaming_providers: recommendation.streaming_providers ?? [],
      created_at: recommendation.created_at,
    }, { onConflict: 'user_id,media_id' })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { user_id, force_new = false } = await req.json()
  if (!user_id) return json({ error: 'user_id required' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const { data: active } = await supabase
    .from('recommendations')
    .select('id, sender_id, media_title, media_type, media_id, media_creator, media_poster_url, streaming_providers, recipient_status, created_at')
    .eq('sender_id', BOT_USER_ID)
    .eq('recipient_id', user_id)
    .in('recipient_status', ACTIVE_STATUSES)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (active && !force_new) {
    const { error: logError } = await upsertRecommendationLog(supabase, active, user_id)
    if (logError) return json({ error: logError.message }, 500)

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
      .select('media_id, media_type, media_title, media_creator, rating, status')
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
  const genreList = user?.favorite_genres ?? []
  const typePreference = preferredMediaTypes(previousLog ?? [])
  const bookSubject = pickMappedTerm(genreList, BOOK_SUBJECTS, 'fiction')
  const albumTerm = pickMappedTerm(genreList, ALBUM_GENRES, 'new music')

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
    {
      type: 'book',
      reason: `Queued Bot picked this book from your ${bookSubject.replaceAll('_', ' ')} taste signal.`,
      url: `${OL_BASE}/subjects/${bookSubject}.json?limit=20`,
    },
    {
      type: 'album',
      reason: `Queued Bot picked this album from your ${albumTerm} taste signal.`,
      url: `${ITUNES_BASE}/search?term=${encodeURIComponent(albumTerm)}&entity=album&media=music&limit=20&country=US`,
    },
  ]

  const responses = await Promise.all(urls.map(item => fetch(item.url).then(res => res.json()).then(data => ({ ...item, data }))))
  const candidates = responses.flatMap(({ type, reason, data }) => {
    if (type === 'book') {
      return (data.works ?? [])
        .filter((item: any) => item.cover_id)
        .map((item: any) => ({
          type,
          reason,
          media_id: item.key?.replace('/works/', '') ?? String(item.cover_id),
          media_title: item.title,
          media_creator: item.authors?.[0]?.name ?? null,
          media_poster_url: item.cover_id ? `${OL_COVER}/${item.cover_id}-M.jpg` : null,
          genre: bookSubject,
          score: Number(item.edition_count ?? 1),
        }))
    }

    if (type === 'album') {
      return (data.results ?? [])
        .filter((item: any) => item.artworkUrl100)
        .map((item: any) => ({
          type,
          reason,
          media_id: String(item.collectionId ?? item.trackId),
          media_title: item.collectionName ?? item.trackName,
          media_creator: item.artistName ?? null,
          media_poster_url: (item.artworkUrl100 ?? '').replace('100x100bb', '300x300bb'),
          genre: item.primaryGenreName ?? albumTerm,
          score: Number(item.trackCount ?? 1),
        }))
    }

    return (data.results ?? []).map((item: any) => ({
      type,
      reason,
      media_id: String(item.id),
      media_title: type === 'movie' ? item.title : item.name,
      media_creator: null,
      media_poster_url: item.poster_path ? `${IMG_BASE}${item.poster_path}` : null,
      genre: (item.genre_ids ?? []).join(','),
      score: (item.vote_average ?? 0) * Math.log10((item.vote_count ?? 0) + 10),
      vote_average: item.vote_average,
      vote_count: item.vote_count,
    }))
  })

  candidates.sort((a, b) => {
    return scoreCandidate(b, typePreference, genreList) - scoreCandidate(a, typePreference, genreList)
  })

  for (const candidate of candidates) {
    const mediaId = candidate.media_id
    if (seen.has(mediaId)) continue

    const rec = {
      sender_id: BOT_USER_ID,
      recipient_id: user_id,
      media_type: candidate.type,
      media_id: mediaId,
      media_title: candidate.media_title,
      media_creator: candidate.media_creator,
      media_poster_url: candidate.media_poster_url,
      note: recommendationNote(candidate, user, candidate.reason),
      streaming_providers: [],
    }

    const { data, error } = await supabase
      .from('recommendations')
      .insert(rec)
      .select('id, sender_id, media_title, media_type, media_id, media_creator, media_poster_url, streaming_providers, recipient_status, created_at')
      .single()

    if (!error) {
      const { error: logError } = await upsertRecommendationLog(supabase, data, user_id)
      if (logError) return json({ error: logError.message }, 500)

      return json({ ok: true, sent: 1, active: false, recommendation: data })
    }
  }

  return json({ ok: true, sent: 0, active: false, exhausted: true })
})
