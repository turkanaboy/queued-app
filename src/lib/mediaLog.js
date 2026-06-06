import { supabase } from './supabase'

export async function upsertMediaLog(row) {
  const { error } = await supabase
    .from('user_media_log')
    .upsert(row, { onConflict: 'user_id,media_type,media_id' })

  if (!error) return { error: null }

  const needsLegacyConflict = /unique|constraint|conflict|schema cache/i.test(error.message ?? '')
  if (!needsLegacyConflict) return { error }

  return supabase
    .from('user_media_log')
    .upsert(row, { onConflict: 'user_id,media_id' })
}
