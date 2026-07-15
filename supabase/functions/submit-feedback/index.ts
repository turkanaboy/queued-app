import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.107.0'

const MAX_FEEDBACK_LENGTH = 4000
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey')
  if (!anonKey) return json({ error: 'Supabase public key is not configured.' }, 500)

  const userClient = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'unauthorized' }, 401)

  let body: { message?: unknown; path?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return json({ error: 'Feedback is required.' }, 400)
  if (message.length > MAX_FEEDBACK_LENGTH) return json({ error: `Feedback must be ${MAX_FEEDBACK_LENGTH} characters or fewer.` }, 400)
  if (!RESEND_API_KEY) return json({ error: 'Feedback email is not configured.' }, 500)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: allowed, error: limitError } = await admin.rpc('consume_edge_rate_limit', {
    p_user_id: authData.user.id,
    p_action: 'submit_feedback',
    p_limit: 5,
    p_window_seconds: 3600,
  })
  if (limitError) return json({ error: 'Feedback could not be sent. Please try again.' }, 500)
  if (!allowed) return json({ error: 'Too much feedback was sent. Please try again later.' }, 429)

  const path = typeof body.path === 'string' ? body.path.slice(0, 500) : 'Unknown'
  const email = authData.user.email ?? 'Unknown'
  const emailPayload = {
    from: 'Queued Feedback <feedback@myqueued.com>',
    to: ['info@myqueued.com'],
    reply_to: authData.user.email || undefined,
    subject: 'New Queued feedback',
    text: [
      message,
      '',
      '---',
      `User: ${email}`,
      `User ID: ${authData.user.id}`,
      `Path: ${path || 'Unknown'}`,
      `Platform: ${(req.headers.get('User-Agent') ?? 'Unknown').slice(0, 500)}`,
      `Sent: ${new Date().toISOString()}`,
    ].join('\n'),
  }

  let emailResponse: Response
  try {
    emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    console.error('Feedback email request failed:', error instanceof Error ? error.message : String(error))
    return json({ error: 'Feedback could not be sent. Please try again.' }, 502)
  }

  if (!emailResponse.ok) {
    console.error('Feedback email provider returned:', emailResponse.status)
    return json({ error: 'Feedback could not be sent. Please try again.' }, 502)
  }

  return json({ ok: true })
})
