import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.107.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'unauthorized' }, 401)

  let body: { action?: string; confirmation?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }
  if (!['export', 'delete'].includes(body.action ?? '')) return json({ error: 'unsupported action' }, 400)

  const userId = authData.user.id
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: allowed, error: limitError } = await admin.rpc('consume_edge_rate_limit', {
    p_user_id: userId,
    p_action: `account_${body.action}`,
    p_limit: 3,
    p_window_seconds: 3600,
  })
  if (limitError) return json({ error: limitError.message }, 500)
  if (!allowed) return json({ error: 'Too many account requests. Try again later.' }, 429)

  if (body.action === 'delete') {
    if (body.confirmation !== 'DELETE') return json({ error: 'confirmation required' }, 400)
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })
  }

  const results = await Promise.all([
    admin.from('users').select('*').eq('id', userId).maybeSingle(),
    admin.from('friendships').select('*').or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`),
    admin.from('recommendations').select('*, comments(*)').or(`sender_id.eq.${userId},recipient_id.eq.${userId}`),
    admin.from('user_media_log').select('*').eq('user_id', userId),
    admin.from('party_members').select('*, party:parties(*)').eq('user_id', userId),
    admin.from('party_list_items').select('*').eq('added_by', userId),
    admin.from('party_votes').select('*').eq('user_id', userId),
    admin.from('trivia_challenges').select('*').or(`initiator_id.eq.${userId},challenger_id.eq.${userId}`),
    admin.from('invite_links').select('*').eq('inviter_id', userId),
  ])
  const failed = results.find(result => result.error)
  if (failed?.error) return json({ error: failed.error.message }, 500)

  return json({
    exported_at: new Date().toISOString(),
    account: results[0].data,
    friendships: results[1].data ?? [],
    recommendations: results[2].data ?? [],
    media_log: results[3].data ?? [],
    groups: results[4].data ?? [],
    group_items_added: results[5].data ?? [],
    group_votes: results[6].data ?? [],
    trivia_challenges: results[7].data ?? [],
    invite_links: results[8].data ?? [],
  })
})
