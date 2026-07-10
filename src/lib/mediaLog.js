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

export async function setRecommendationState(recommendationId, { status, rating = null, review, streamingProviders } = {}) {
  const payload = Object.fromEntries(Object.entries({
    p_recommendation_id: recommendationId,
    p_status: status,
    p_rating: rating,
    p_review: review,
    p_streaming_providers: streamingProviders,
  }).filter(([, value]) => value !== undefined))

  return supabase.rpc('set_recommendation_state', payload)
}
