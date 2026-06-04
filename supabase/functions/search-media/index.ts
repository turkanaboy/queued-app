import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w300'
const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/original'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') ?? 'search'
  const apiKey = Deno.env.get('TMDB_API_KEY')

  // ── Watch providers ──────────────────────────────────────────
  if (action === 'providers') {
    const mediaType = searchParams.get('media_type') // 'movie' | 'tv'
    const mediaId   = searchParams.get('media_id')
    const region    = searchParams.get('region') ?? 'US'

    if (!mediaType || !mediaId) return json({ error: 'media_type and media_id are required' }, 400)

    const url = `${TMDB_BASE}/${mediaType}/${mediaId}/watch/providers?api_key=${apiKey}`
    const res  = await fetch(url)
    const data = await res.json()

    const regionData = data.results?.[region] ?? {}
    // flatrate = subscription streaming (Netflix, Hulu, etc.)
    const providers = (regionData.flatrate ?? []).map((p: any) => ({
      provider_id:   p.provider_id,
      provider_name: p.provider_name,
      logo_path:     p.logo_path ? `${TMDB_LOGO_BASE}${p.logo_path}` : null,
    }))

    return json({ providers })
  }

  // ── Search ───────────────────────────────────────────────────
  const query = searchParams.get('query')
  const type  = searchParams.get('type') ?? 'multi'

  if (!query) return json({ error: 'query is required' }, 400)

  const endpoint = type === 'multi' ? `${TMDB_BASE}/search/multi` : `${TMDB_BASE}/search/${type}`
  const url = `${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`

  const tmdbRes = await fetch(url)
  const data    = await tmdbRes.json()

  const results = (data.results ?? [])
    .filter((r: any) => r.media_type !== 'person' && (r.title || r.name))
    .slice(0, 10)
    .map((r: any) => ({
      media_id:        String(r.id),
      media_type:      r.media_type === 'tv' || type === 'tv' ? 'tv' : 'movie',
      media_title:     r.title ?? r.name,
      media_poster_url: r.poster_path ? `${TMDB_IMAGE_BASE}${r.poster_path}` : null,
      year:            (r.release_date ?? r.first_air_date ?? '').slice(0, 4),
      overview:        r.overview,
    }))

  return json({ results })
})
