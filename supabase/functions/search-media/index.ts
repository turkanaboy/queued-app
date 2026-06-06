import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TMDB_BASE        = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_W300  = 'https://image.tmdb.org/t/p/w300'
const TMDB_LOGO_ORIG   = 'https://image.tmdb.org/t/p/original'
const OL_BASE          = 'https://openlibrary.org'
const OL_COVER         = 'https://covers.openlibrary.org/b/id'
const ITUNES_BASE      = 'https://itunes.apple.com'

const TMDB_GENRES: Record<string, number> = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Dramedy: 35,
  Fantasy: 14,
  'Ghost stories': 27,
  Horror: 27,
  Mystery: 9648,
  Romance: 10749,
  'Sci-Fi': 878,
  Superhero: 28,
  Thriller: 53,
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

const ALBUM_TERMS: Record<string, string> = {
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
  'Singer-songwriter': 'singer songwriter',
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

function mapProviders(list: any[] = []) {
  return list.map((p: any) => ({
    provider_id:   p.provider_id,
    provider_name: p.provider_name,
    logo_path:     p.logo_path ? `${TMDB_LOGO_ORIG}${p.logo_path}` : null,
  }))
}

// ── Open Library helpers ─────────────────────────────────────
function mapBook(doc: any) {
  return {
    media_id:         doc.key?.replace('/works/', '') ?? String(doc.cover_edition_key ?? Math.random()),
    media_type:       'book',
    media_title:      doc.title ?? 'Unknown Title',
    media_creator:    doc.author_name?.[0] ?? null,
    media_poster_url: doc.cover_i ? `${OL_COVER}/${doc.cover_i}-M.jpg` : null,
    year:             String(doc.first_publish_year ?? ''),
  }
}

function mapSubjectBook(work: any) {
  return {
    media_id:         work.key?.replace('/works/', '') ?? String(work.cover_id ?? Math.random()),
    media_type:       'book',
    media_title:      work.title ?? 'Unknown Title',
    media_creator:    work.authors?.[0]?.name ?? null,
    media_poster_url: work.cover_id ? `${OL_COVER}/${work.cover_id}-M.jpg` : null,
    year:             String(work.first_publish_year ?? ''),
  }
}

// ── iTunes helpers ───────────────────────────────────────────
function mapItunesAlbum(r: any) {
  const artwork = (r.artworkUrl100 ?? '').replace('100x100bb', '300x300bb')
  return {
    media_id:         String(r.collectionId ?? r.trackId ?? Math.random()),
    media_type:       'album',
    media_title:      r.collectionName ?? r.trackName ?? 'Unknown Album',
    media_creator:    r.artistName ?? null,
    media_poster_url: artwork || null,
    year:             (r.releaseDate ?? '').slice(0, 4),
  }
}

function mapItunesRssEntry(e: any) {
  const images: any[] = e['im:image'] ?? []
  const poster = images[images.length - 1]?.label ?? null
  return {
    media_id:         e.id?.attributes?.['im:id'] ?? String(Math.random()),
    media_type:       'album',
    media_title:      e['im:name']?.label ?? 'Unknown Album',
    media_creator:    e['im:artist']?.label ?? null,
    media_poster_url: poster,
    year:             (e['im:releaseDate']?.attributes?.label ?? '').slice(0, 4),
  }
}

function mapTmdbResult(r: any, mediaType: string) {
  return {
    media_id:         String(r.id),
    media_type:       r.media_type === 'tv' || mediaType === 'tv' ? 'tv' : 'movie',
    media_title:      r.title ?? r.name,
    media_creator:    null,
    media_poster_url: r.poster_path ? `${TMDB_IMAGE_W300}${r.poster_path}` : null,
    year:             (r.release_date ?? r.first_air_date ?? '').slice(0, 4),
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { searchParams } = new URL(req.url)
  const action   = searchParams.get('action') ?? 'search'
  const apiKey   = Deno.env.get('TMDB_API_KEY')

  // ── Trending / popular carousels ─────────────────────────────
  if (action === 'trending') {
    const mediaType = searchParams.get('media_type') ?? 'movie'
    const page      = Number(searchParams.get('page') ?? '1')
    const offset    = Math.max(0, page - 1) * 24
    const genre     = searchParams.get('genre')

    // Books — Open Library weekly trending
    if (mediaType === 'book') {
      const subject = genre ? BOOK_SUBJECTS[genre] : null
      const res  = await fetch(subject ? `${OL_BASE}/subjects/${subject}.json?limit=24&offset=${offset}` : `${OL_BASE}/trending/weekly.json?limit=24&offset=${offset}`)
      const data = await res.json()
      const results = subject
        ? (data.works ?? []).filter((w: any) => w.cover_id).map(mapSubjectBook)
        : (data.works ?? []).filter((w: any) => w.cover_i).map(mapBook)
      return json({ results, total_pages: 5 })
    }

    // Albums — iTunes top albums RSS
    if (mediaType === 'album') {
      if (!genre && page === 1) {
        const res  = await fetch(`${ITUNES_BASE}/us/rss/topalbums/limit=25/json`)
        const data = await res.json()
        const results = (data.feed?.entry ?? []).map(mapItunesRssEntry).filter((r: any) => r.media_poster_url)
        return json({ results, total_pages: 5 })
      }
      const term = genre ? ALBUM_TERMS[genre] ?? genre : 'new music'
      const res  = await fetch(`${ITUNES_BASE}/search?term=${encodeURIComponent(term)}&entity=album&media=music&limit=24&offset=${offset}&country=US`)
      const data = await res.json()
      const results = (data.results ?? []).filter((r: any) => r.artworkUrl100).map(mapItunesAlbum)
      return json({ results, total_pages: 5 })
    }

    // Movies / TV — TMDB weekly trending
    const genreId = genre ? TMDB_GENRES[genre] : null
    const tmdbUrl = genreId
      ? `${TMDB_BASE}/discover/${mediaType}?api_key=${apiKey}&page=${page}&language=en-US&include_adult=false&sort_by=popularity.desc&with_genres=${genreId}`
      : `${TMDB_BASE}/trending/${mediaType}/week?api_key=${apiKey}&page=${page}&language=en-US`
    const res  = await fetch(tmdbUrl)
    const data = await res.json()
    const results = (data.results ?? [])
      .filter((r: any) => r.poster_path)
      .map((r: any) => ({
        media_id:         String(r.id),
        media_type:       r.media_type ?? mediaType,
        media_title:      r.title ?? r.name,
        media_creator:    null,
        media_poster_url: `${TMDB_IMAGE_W300}${r.poster_path}`,
        year:             (r.release_date ?? r.first_air_date ?? '').slice(0, 4),
        vote_average:     r.vote_average,
      }))
    return json({ results, total_pages: data.total_pages ?? 1 })
  }

  // ── Watch providers (movies / tv only) ───────────────────────
  if (action === 'providers') {
    const mediaType = searchParams.get('media_type')
    const mediaId   = searchParams.get('media_id')
    const region    = searchParams.get('region') ?? 'US'
    if (!mediaType || !mediaId) return json({ error: 'media_type and media_id are required' }, 400)

    const res  = await fetch(`${TMDB_BASE}/${mediaType}/${mediaId}/watch/providers?api_key=${apiKey}`)
    const data = await res.json()
    const r    = data.results?.[region] ?? {}
    return json({
      providers: {
        flatrate: mapProviders(r.flatrate),
        rent:     mapProviders(r.rent),
        buy:      mapProviders(r.buy),
        link:     r.link ?? null,
      }
    })
  }

  // ── Search — all four types ───────────────────────────────────
  const query = searchParams.get('query')
  const type  = searchParams.get('type') ?? 'multi'

  if (!query) return json({ error: 'query is required' }, 400)

  // Books via Open Library
  if (type === 'book') {
    const res  = await fetch(`${OL_BASE}/search.json?q=${encodeURIComponent(query)}&fields=key,title,author_name,cover_i,first_publish_year&limit=10`)
    const data = await res.json()
    const results = (data.docs ?? []).filter((d: any) => d.cover_i).slice(0, 10).map(mapBook)
    return json({ results })
  }

  // Albums via iTunes
  if (type === 'album') {
    const res  = await fetch(`${ITUNES_BASE}/search?term=${encodeURIComponent(query)}&entity=album&media=music&limit=10&country=US`)
    const data = await res.json()
    const results = (data.results ?? []).filter((r: any) => r.artworkUrl100).slice(0, 10).map(mapItunesAlbum)
    return json({ results })
  }

  // Movies / TV via TMDB
  const endpoint = type === 'multi'
    ? `${TMDB_BASE}/search/multi`
    : `${TMDB_BASE}/search/${type}`
  const res  = await fetch(`${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`)
  const data = await res.json()
  const titleResults = (data.results ?? [])
    .filter((r: any) => r.media_type !== 'person' && (r.title || r.name))
    .slice(0, 10)
    .map((r: any) => mapTmdbResult(r, type))

  let peopleResults: any[] = []
  if (type === 'movie' || type === 'tv' || type === 'multi') {
    const peopleRes = await fetch(`${TMDB_BASE}/search/person?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`)
    const peopleData = await peopleRes.json()
    const personIds = (peopleData.results ?? []).slice(0, 3).map((person: any) => person.id)
    const creditResponses = await Promise.all(personIds.map((id: number) =>
      fetch(`${TMDB_BASE}/person/${id}/combined_credits?api_key=${apiKey}&language=en-US`).then(res => res.json())
    ))
    peopleResults = creditResponses
      .flatMap((credits: any) => [...(credits.cast ?? []), ...(credits.crew ?? [])])
      .filter((r: any) => (type === 'multi' || r.media_type === type) && (r.media_type === 'movie' || r.media_type === 'tv') && (r.title || r.name) && r.poster_path)
      .slice(0, 12)
      .map((r: any) => mapTmdbResult(r, r.media_type))
  }

  const results = [...new Map([...titleResults, ...peopleResults].map((item: any) => [`${item.media_type}:${item.media_id}`, item])).values()].slice(0, 12)
  return json({ results })
})
