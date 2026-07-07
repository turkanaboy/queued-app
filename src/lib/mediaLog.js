import { supabase } from './supabase'

export async function upsertMediaLog(row) {
  const payload = Object.fromEntries(
    Object.entries({
      ...row,
      created_at: row.created_at ?? new Date().toISOString(),
    }).filter(([, value]) => value !== undefined)
  )

  return supabase
    .from('user_media_log')
    .upsert(payload, { onConflict: 'user_id,media_type,media_id' })
}
