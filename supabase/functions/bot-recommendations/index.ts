import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'
const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p/w300'
const OL_BASE = 'https://openlibrary.org'
const OL_COVER = 'https://covers.openlibrary.org/b/id'
const ITUNES_BASE = 'https://itunes.apple.com'
const IGDB_BASE = 'https://api.igdb.com/v4'
const IGDB_COVER = 'https://images.igdb.com/igdb/image/upload/t_cover_big'
const DEFAULT_PLATFORMS = [8, 9, 15, 337, 384] // Netflix, Prime, Hulu, Disney+, Max
const ACTIVE_STATUSES = ['not_yet_viewed', 'queued', 'in_progress']

const FALLBACK_CANDIDATES = [
  {
    type: 'movie',
    media_id: 'queued-fallback-movie-arrival',
    media_title: 'Arrival',
    media_creator: 'Denis Villeneuve',
    media_poster_url: null,
    genre: 'Sci-Fi Drama',
    score: 4.7,
  },
  {
    type: 'movie',
    media_id: 'queued-fallback-movie-paddington-2',
    media_title: 'Paddington 2',
    media_creator: 'Paul King',
    media_poster_url: null,
    genre: 'Comedy Family',
    score: 4.6,
  },
  {
    type: 'movie',
    media_id: 'queued-fallback-movie-portrait-of-a-lady-on-fire',
    media_title: 'Portrait of a Lady on Fire',
    media_creator: 'Celine Sciamma',
    media_poster_url: null,
    genre: 'Drama Romance',
    score: 4.5,
  },
  {
    type: 'tv',
    media_id: 'queued-fallback-tv-the-bear',
    media_title: 'The Bear',
    media_creator: 'Christopher Storer',
    media_poster_url: null,
    genre: 'Drama Comedy Food',
    score: 4.6,
  },
  {
    type: 'tv',
    media_id: 'queued-fallback-tv-station-eleven',
    media_title: 'Station Eleven',
    media_creator: 'Patrick Somerville',
    media_poster_url: null,
    genre: 'Drama Sci-Fi',
    score: 4.5,
  },
  {
    type: 'tv',
    media_id: 'queued-fallback-tv-over-the-garden-wall',
    media_title: 'Over the Garden Wall',
    media_creator: 'Patrick McHale',
    media_poster_url: null,
    genre: 'Animation Fantasy Mystery',
    score: 4.5,
  },
  {
    type: 'book',
    media_id: 'queued-fallback-book-tomorrow-and-tomorrow-and-tomorrow',
    media_title: 'Tomorrow, and Tomorrow, and Tomorrow',
    media_creator: 'Gabrielle Zevin',
    media_poster_url: null,
    genre: 'Literary fiction',
    score: 4.4,
  },
  {
    type: 'book',
    media_id: 'queued-fallback-book-the-wager',
    media_title: 'The Wager',
    media_creator: 'David Grann',
    media_poster_url: null,
    genre: 'Nonfiction Biography',
    score: 4.4,
  },
  {
    type: 'book',
    media_id: 'queued-fallback-book-exhalation',
    media_title: 'Exhalation',
    media_creator: 'Ted Chiang',
    media_poster_url: null,
    genre: 'Short stories Sci-Fi',
    score: 4.5,
  },
  {
    type: 'album',
    media_id: 'queued-fallback-album-dragon-new-warm-mountain',
    media_title: 'Dragon New Warm Mountain I Believe in You',
    media_creator: 'Big Thief',
    media_poster_url: null,
    genre: 'Indie Folk',
    score: 4.4,
  },
  {
    type: 'album',
    media_id: 'queued-fallback-album-random-access-memories',
    media_title: 'Random Access Memories',
    media_creator: 'Daft Punk',
    media_poster_url: null,
    genre: 'Electronic Pop',
    score: 4.5,
  },
  {
    type: 'album',
    media_id: 'queued-fallback-album-songs-in-the-key-of-life',
    media_title: 'Songs in the Key of Life',
    media_creator: 'Stevie Wonder',
    media_poster_url: null,
    genre: 'Soul Pop',
    score: 4.7,
  },
  {
    type: 'game',
    media_id: 'queued-fallback-game-hades',
    media_title: 'Hades',
    media_creator: 'Supergiant Games',
    media_poster_url: null,
    genre: 'RPG Action Indie',
    score: 4.7,
  },
  {
    type: 'game',
    media_id: 'queued-fallback-game-celeste',
    media_title: 'Celeste',
    media_creator: 'Maddy Makes Games',
    media_poster_url: null,
    genre: 'Platform Indie',
    score: 4.6,
  },
  {
    type: 'game',
    media_id: 'queued-fallback-game-portal-2',
    media_title: 'Portal 2',
    media_creator: 'Valve',
    media_poster_url: null,
    genre: 'Puzzle Adventure',
    score: 4.7,
  },
]

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
  'Food & travel': 10764,
  Reality: 10764,
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

const GAME_GENRES: Record<string, number> = {
  Adventure: 31,
  Arcade: 33,
  Fighting: 4,
  Indie: 32,
  Platform: 8,
  Puzzle: 9,
  RPG: 12,
  Shooter: 5,
  Simulator: 13,
  Sport: 14,
  Strategy: 15,
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function normalizedEntries<T>(map: Record<string, T>) {
  return Object.fromEntries(Object.entries(map).map(([key, value]) => [normalizeText(key), value]))
}

const NORMALIZED_GENRE_IDS = normalizedEntries(GENRE_IDS)
const NORMALIZED_BOOK_SUBJECTS = normalizedEntries(BOOK_SUBJECTS)
const NORMALIZED_ALBUM_GENRES = normalizedEntries(ALBUM_GENRES)
const NORMALIZED_GAME_GENRES = normalizedEntries(GAME_GENRES)
let igdbAccessToken: string | null = null
let igdbAccessTokenExpiresAt = 0

function pickNormalized<T>(map: Record<string, T>, key: string) {
  return map[normalizeText(key)] ?? null
}

function pickGenreFilter(genres: string[] | null | undefined) {
  const ids = (genres ?? []).map(g => pickNormalized(NORMALIZED_GENRE_IDS, g)).filter(Boolean)
  return ids.length ? `&with_genres=${ids.slice(0, 3).join('|')}` : ''
}

function pickMappedTerm(genres: string[] | null | undefined, map: Record<string, string>, fallback: string) {
  return (genres ?? []).map(g => pickNormalized(map, g)).find(Boolean) ?? fallback
}

function preferredMediaTypes(log: any[] = []) {
  const scores: Record<string, number> = { movie: 0, tv: 0, book: 0, album: 0, game: 0 }
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
  const genres = user?.favorite_genres?.length ? ` It is nudged toward ${user.favorite_genres.slice(0, 3).join(', ')}.` : ''
  return `${reason} ${score} from ${(item.vote_count ?? 0).toLocaleString()} ratings.${genres}`.slice(0, 500)
}

async function fetchJson(item: any) {
  try {
    const res = await fetch(item.url, {
      method: item.method ?? 'GET',
      headers: item.headers,
      body: item.body,
    })
    const data = await res.json()
    return { ...item, ok: res.ok, status: res.status, data }
  } catch (error) {
    return { ...item, ok: false, status: 0, data: null, error: error instanceof Error ? error.message : String(error) }
  }
}

function gameYear(timestamp: number | null | undefined) {
  if (!timestamp) return ''
  return String(new Date(timestamp * 1000).getUTCFullYear())
}

async function getIgdbAccessToken(clientId: string | undefined | null) {
  const directToken = Deno.env.get('IGDB_ACCESS_TOKEN')
  if (directToken) return directToken
  if (igdbAccessToken && Date.now() < igdbAccessTokenExpiresAt) return igdbAccessToken

  const clientSecret = Deno.env.get('IGDB_API_KEY') ?? Deno.env.get('IGDB_CLIENT_SECRET')
  if (!clientId || !clientSecret) return null

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`IGDB token error ${res.status}: ${text}`)
  }

  const data = await res.json()
  igdbAccessToken = data.access_token
  igdbAccessTokenExpiresAt = Date.now() + Math.max(0, Number(data.expires_in ?? 0) - 60) * 1000
  return igdbAccessToken
}

async function upsertRecommendationLog(supabase: any, recommendation: any, userId: string) {
  const row = {
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
  }

  const result = await supabase
    .from('user_media_log')
    .upsert(row, { onConflict: 'user_id,media_type,media_id' })

  if (!result.error) return result

  return await supabase
    .from('user_media_log')
    .upsert(row, { onConflict: 'user_id,media_id' })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: { user_id?: string; force_new?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const { user_id, force_new = false } = body
  if (!user_id) return json({ error: 'user_id required' }, 400)

  const authHeader = req.headers.get('Authorization') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey')
  if (!anonKey) return json({ error: 'Supabase anon key is not configured for Queued Bot.' }, 500)

  const userClient = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user || authData.user.id !== user_id) {
    return json({ error: 'forbidden' }, 403)
  }

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
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
      .select('media_id, media_type')
      .eq('recipient_id', user_id)
      .eq('sender_id', BOT_USER_ID)
      .is('deleted_at', null),
    supabase
      .from('user_media_log')
      .select('media_id, media_type, media_title, media_creator, rating, status')
      .eq('user_id', user_id),
  ])

  const seen = new Set([
    ...(previousRecs ?? []).map((r: any) => `${r.media_type}:${r.media_id}`),
    ...(previousLog ?? []).map((r: any) => `${r.media_type}:${r.media_id}`),
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
  const bookSubject = pickMappedTerm(genreList, NORMALIZED_BOOK_SUBJECTS, 'fiction')
  const albumTerm = pickMappedTerm(genreList, NORMALIZED_ALBUM_GENRES, 'new music')
  const gameGenre = (genreList ?? []).map(g => pickNormalized(NORMALIZED_GAME_GENRES, g)).find(Boolean)
  const igdbClientId = Deno.env.get('IGDB_CLIENT_ID')
  const igdbToken = await getIgdbAccessToken(igdbClientId)

  const urls: any[] = [
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
    {
      type: 'movie',
      reason: 'Queued Bot broadened the search after your platform filters were too tight.',
      url: `${TMDB_BASE}/discover/movie?api_key=${apiKey}&sort_by=vote_average.desc&vote_count.gte=50&include_adult=false&language=en-US${genreFilter}`,
    },
    {
      type: 'tv',
      reason: 'Queued Bot broadened the search after your platform filters were too tight.',
      url: `${TMDB_BASE}/discover/tv?api_key=${apiKey}&sort_by=vote_average.desc&vote_count.gte=40&include_adult=false&language=en-US${genreFilter}`,
    },
    {
      type: 'book',
      reason: 'Queued Bot broadened the book search to popular weekly titles.',
      url: `${OL_BASE}/trending/weekly.json?limit=30`,
    },
    {
      type: 'album',
      reason: 'Queued Bot broadened the music search to current popular albums.',
      url: `${ITUNES_BASE}/search?term=popular%20music&entity=album&media=music&limit=30&country=US`,
    },
  ]

  if (igdbClientId && igdbToken) {
    const gameHeaders = {
      'Accept': 'application/json',
      'Client-ID': igdbClientId,
      'Authorization': `Bearer ${igdbToken}`,
    }
    urls.push(
      {
        type: 'game',
        reason: gameGenre
          ? 'Queued Bot picked this game from your genre taste signal.'
          : 'Queued Bot picked this highly regarded game candidate.',
        url: `${IGDB_BASE}/games`,
        method: 'POST',
        headers: gameHeaders,
        body: [
          'fields name,summary,first_release_date,total_rating,total_rating_count,cover.image_id,genres.name,involved_companies.developer,involved_companies.company.name;',
          `where cover != null & total_rating_count > 10${gameGenre ? ` & genres = (${gameGenre})` : ''};`,
          'sort total_rating_count desc;',
          'limit 20;',
        ].join(' '),
      },
      {
        type: 'game',
        reason: 'Queued Bot broadened the game search to widely rated titles.',
        url: `${IGDB_BASE}/games`,
        method: 'POST',
        headers: gameHeaders,
        body: [
          'fields name,summary,first_release_date,total_rating,total_rating_count,cover.image_id,genres.name,involved_companies.developer,involved_companies.company.name;',
          'where cover != null & total_rating_count > 25;',
          'sort total_rating_count desc;',
          'limit 30;',
        ].join(' '),
      },
    )
  }

  const responses = await Promise.all(urls.map(fetchJson))
  const candidates = responses.flatMap(({ type, reason, data }) => {
    const sourceData = data ?? {}
    if (type === 'book') {
      return (sourceData.works ?? [])
        .filter((item: any) => item.cover_id)
        .map((item: any) => ({
          type,
          reason,
          media_id: item.key?.replace('/works/', '') ?? String(item.cover_id),
          media_title: item.title,
          media_creator: item.authors?.[0]?.name ?? null,
          media_poster_url: item.cover_id ? `${OL_COVER}/${item.cover_id}-M.jpg` : null,
          genre: bookSubject,
          score: Math.log10(Number(item.edition_count ?? 1) + 1) * 10,
        }))
    }

    if (type === 'album') {
      return (sourceData.results ?? [])
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

    if (type === 'game') {
      return (Array.isArray(sourceData) ? sourceData : [])
        .filter((item: any) => item.cover?.image_id)
        .map((item: any) => {
          const developer = (item.involved_companies ?? []).find((entry: any) => entry.developer)
          return {
            type,
            reason,
            media_id: String(item.id),
            media_title: item.name,
            media_creator: developer?.company?.name ?? item.involved_companies?.[0]?.company?.name ?? null,
            media_poster_url: `${IGDB_COVER}/${item.cover.image_id}.jpg`,
            genre: item.genres?.map((g: any) => g.name).join(' ') ?? '',
            year: gameYear(item.first_release_date),
            score: Number(item.total_rating ?? 0) * Math.log10((item.total_rating_count ?? 0) + 10) / 20,
            vote_average: item.total_rating ? item.total_rating / 10 : null,
            vote_count: item.total_rating_count ?? 0,
          }
        })
    }

    return (sourceData.results ?? []).map((item: any) => ({
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

  candidates.push(...FALLBACK_CANDIDATES.map(candidate => ({
    ...candidate,
    reason: 'Queued Bot used a trusted fallback pick after live media sources came up short.',
  })))

  candidates.sort((a, b) => {
    return scoreCandidate(b, typePreference, genreList) - scoreCandidate(a, typePreference, genreList)
  })

  let lastInsertError: string | null = null
  for (const candidate of candidates) {
    const mediaId = candidate.media_id
    if (seen.has(`${candidate.type}:${mediaId}`)) continue

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

    lastInsertError = error.message
  }

  if (lastInsertError) {
    return json({ error: `Queued Bot found candidates but could not save one: ${lastInsertError}` }, 500)
  }

  return json({
    ok: true,
    sent: 0,
    active: false,
    exhausted: true,
    diagnostics: {
      source_count: responses.length,
      candidate_count: candidates.length,
      seen_count: seen.size,
      source_statuses: responses.map(({ type, ok, status, data, error }) => ({
        type,
        ok,
        status,
        result_count: type === 'album' ? (data?.results?.length ?? 0) : (data?.results?.length ?? data?.works?.length ?? 0),
        error,
      })),
    },
  })
})
