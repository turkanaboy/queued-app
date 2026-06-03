import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w300'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('query')
  const type = searchParams.get('type') ?? 'multi' // 'movie' | 'tv' | 'multi'

  if (!query) {
    return new Response(JSON.stringify({ error: 'query is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const apiKey = Deno.env.get('TMDB_API_KEY')
  const endpoint = type === 'multi'
    ? `${TMDB_BASE}/search/multi`
    : `${TMDB_BASE}/search/${type}`

  const url = `${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`

  const tmdbRes = await fetch(url)
  const data = await tmdbRes.json()

  const results = (data.results ?? [])
    .filter((r: any) => r.media_type !== 'person' && (r.title || r.name))
    .slice(0, 10)
    .map((r: any) => ({
      media_id: String(r.id),
      media_type: r.media_type === 'tv' || type === 'tv' ? 'tv' : 'movie',
      media_title: r.title ?? r.name,
      media_poster_url: r.poster_path ? `${TMDB_IMAGE_BASE}${r.poster_path}` : null,
      year: (r.release_date ?? r.first_air_date ?? '').slice(0, 4),
      overview: r.overview,
    }))

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
