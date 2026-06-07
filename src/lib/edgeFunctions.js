import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export function assertSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase is missing its public URL or anon key. Check the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')
  }
}

export async function invokeEdgeFunction(name, { method = 'GET', path = '', body } = {}) {
  assertSupabaseConfig()

  const token = (await supabase.auth.getSession()).data.session?.access_token
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
  }

  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || json.message || `${name} failed with status ${res.status}`)
  }

  return json
}
