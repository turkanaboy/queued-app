import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'
const TMDB_BASE   = 'https://api.themoviedb.org/3'
const IMG_BASE    = 'https://image.tmdb.org/t/p/w300'
const DEFAULT_PLATFORMS = [8, 9, 15, 337, 384] // Netflix, Prime, Hulu, Disney+, Max

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { user_id } = await req.json()
  if (!user_id) return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400, headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  // Get user's platforms
  const { data: user } = await supabase.from('users').select('platforms').eq('id', user_id).single()
  const platforms = (user?.platforms?.length ?? 0) > 0 ? user!.platforms : DEFAULT_PLATFORMS
  const providerFilter = platforms.join('|')
  const apiKey = Deno.env.get('TMDB_API_KEY')

  // Fetch trending content on the user's platforms
  const [movieRes, tvRes] = await Promise.all([
    fetch(`${TMDB_BASE}/discover/movie?api_key=${apiKey}&with_watch_providers=${providerFilter}&watch_region=US&sort_by=popularity.desc&vote_count.gte=200&include_adult=false&language=en-US`),
    fetch(`${TMDB_BASE}/discover/tv?api_key=${apiKey}&with_watch_providers=${providerFilter}&watch_region=US&sort_by=popularity.desc&vote_average.gte=7&vote_count.gte=100&include_adult=false&language=en-US`),
  ])
  const [movies, shows] = await Promise.all([movieRes.json(), tvRes.json()])

  const movieRecs = (movies.results ?? []).slice(0, 5).map((m: any) => ({
    sender_id:           BOT_USER_ID,
    recipient_id:        user_id,
    media_type:          'movie',
    media_id:            String(m.id),
    media_title:         m.title,
    media_poster_url:    m.poster_path ? `${IMG_BASE}${m.poster_path}` : null,
    note:                `Trending on your platforms · ${(m.vote_average ?? 0).toFixed(1)}⭐ from ${(m.vote_count ?? 0).toLocaleString()} ratings`,
    streaming_providers: [],
  }))

  const tvRecs = (shows.results ?? []).slice(0, 5).map((t: any) => ({
    sender_id:           BOT_USER_ID,
    recipient_id:        user_id,
    media_type:          'tv',
    media_id:            String(t.id),
    media_title:         t.name,
    media_poster_url:    t.poster_path ? `${IMG_BASE}${t.poster_path}` : null,
    note:                `Trending on your platforms · ${(t.vote_average ?? 0).toFixed(1)}⭐ from ${(t.vote_count ?? 0).toLocaleString()} ratings`,
    streaming_providers: [],
  }))

  // Create accepted friendship: bot is always user_a (smaller UUID)
  await supabase.from('friendships').upsert({
    user_a_id:    BOT_USER_ID,
    user_b_id:    user_id,
    requester_id: BOT_USER_ID,
    status:       'accepted',
  }, { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: true })

  // Insert recommendations — skip duplicates silently
  for (const rec of [...movieRecs, ...tvRecs]) {
    await supabase.from('recommendations').insert(rec)
  }

  return new Response(JSON.stringify({ ok: true, sent: movieRecs.length + tvRecs.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
