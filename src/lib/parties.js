import { supabase } from './supabase'

const PARTY_INVITE_KEY = 'queued.partyInviteToken'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ── Invite helpers ────────────────────────────────────────────

export function buildPartyInviteLink(inviteToken) {
  const url = new URL('/login', window.location.origin)
  url.searchParams.set('party_invite', inviteToken)
  return url.toString()
}

export function getPartyInviteFromUrl(search = window.location.search) {
  const token = new URLSearchParams(search).get('party_invite')
  return token && UUID_RE.test(token) ? token : null
}

export function rememberPartyInvite(token) {
  if (!token) return
  window.localStorage.setItem(PARTY_INVITE_KEY, token)
}

export function getStoredPartyInvite() {
  const token = window.localStorage.getItem(PARTY_INVITE_KEY)
  return token && UUID_RE.test(token) ? token : null
}

export function clearStoredPartyInvite() {
  window.localStorage.removeItem(PARTY_INVITE_KEY)
}

// ── Party CRUD ────────────────────────────────────────────────

export async function createParty(name, mode = 'curated') {
  const { data: partyId, error: rpcError } = await supabase.rpc('create_party', { p_name: name, p_mode: mode })
  if (rpcError) throw rpcError
  const { data, error } = await supabase.from('parties').select('*').eq('id', partyId).single()
  if (error) throw error
  return data
}

export async function getUserParties(userId) {
  const { data, error } = await supabase
    .from('party_members')
    .select('party:parties(*, party_members(count))')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => row.party).filter(Boolean)
}

export async function getParty(partyId) {
  const { data, error } = await supabase
    .from('parties')
    .select(`
      *,
      party_members(*, user:users(id, username, display_name)),
      party_list_items(*, party_votes!party_votes_party_item_id_fkey(*))
    `)
    .eq('id', partyId)
    .single()
  if (error) throw error
  return data
}

export async function renameParty(partyId, name) {
  const { error } = await supabase.rpc('rename_party', { p_party_id: partyId, p_name: name })
  if (error) throw error
}

export async function leaveParty(partyId) {
  const { error } = await supabase.rpc('leave_party', { p_party_id: partyId })
  if (error) throw error
}

export async function deleteParty(partyId) {
  const { error } = await supabase.from('parties').delete().eq('id', partyId)
  if (error) throw error
}

export async function removePartyItem(itemId) {
  const { error } = await supabase.rpc('remove_party_item', { p_item_id: itemId })
  if (error) throw error
}

export async function removePartyMember(partyId, userId) {
  const { error } = await supabase.rpc('remove_party_member', { p_party_id: partyId, p_user_id: userId })
  if (error) throw error
}

// ── List items ────────────────────────────────────────────────

export async function addToPartyList(partyId, mediaItem, userId) {
  const { data, error } = await supabase
    .from('party_list_items')
    .insert({
      party_id:        partyId,
      media_type:      mediaItem.media_type,
      media_id:        mediaItem.media_id,
      media_title:     mediaItem.media_title,
      media_creator:   mediaItem.media_creator ?? null,
      media_poster_url: mediaItem.media_poster_url ?? null,
      added_by:        userId,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

// ── Voting ────────────────────────────────────────────────────

export async function castVote(partyItemId, partyId, userId, isUp) {
  if (isUp === null) {
    const { error } = await supabase
      .from('party_votes')
      .delete()
      .eq('party_item_id', partyItemId)
      .eq('user_id', userId)
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('party_votes')
    .upsert(
      { party_item_id: partyItemId, party_id: partyId, user_id: userId, vote: isUp },
      { onConflict: 'party_item_id,user_id' }
    )
  if (error) throw error
}

// ── Pick ──────────────────────────────────────────────────────

export async function pickItem(itemId) {
  const { error } = await supabase.rpc('pick_party_item', { p_item_id: itemId })
  if (error) throw error
}

export async function finishPickedItem(itemId) {
  const { error } = await supabase.rpc('finish_party_item', { p_item_id: itemId })
  if (error) throw error
}

// ── Join ──────────────────────────────────────────────────────

export async function joinParty(inviteToken) {
  const { data, error } = await supabase.rpc('join_party', { p_invite_token: inviteToken })
  if (error) throw error
  return data
}

export async function inviteFriendToParty(partyId, friendId) {
  const { error } = await supabase.rpc('invite_friend_to_party', {
    p_party_id: partyId,
    p_friend_id: friendId,
  })
  if (error) throw error
}

export async function getPartyInviteCandidates(partyId, userId) {
  const { data: members, error: membersError } = await supabase
    .from('party_members')
    .select('user_id')
    .eq('party_id', partyId)

  if (membersError) throw membersError
  const memberIds = new Set((members ?? []).map(m => m.user_id))

  const { data, error } = await supabase
    .from('friendships')
    .select('*, user_a:users!friendships_user_a_id_fkey(id, username, display_name), user_b:users!friendships_user_b_id_fkey(id, username, display_name)')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .eq('status', 'accepted')

  if (error) throw error

  return (data ?? [])
    .map(f => (f.user_a_id === userId ? f.user_b : f.user_a))
    .filter(friend => friend && !memberIds.has(friend.id))
    .sort((a, b) => (a.display_name || a.username || '').localeCompare(b.display_name || b.username || ''))
}

// ── Queue & overlap ───────────────────────────────────────────

// Everything from the user's log (any status) that isn't already on the group list.
export async function getMyLogItems(partyId, userId) {
  const { data: listed } = await supabase
    .from('party_list_items')
    .select('media_type, media_id')
    .eq('party_id', partyId)

  const listedKeys = new Set((listed ?? []).map(i => `${i.media_type}:${i.media_id}`))

  const { data, error } = await supabase
    .from('user_media_log')
    .select('media_type, media_id, media_title, media_creator, media_poster_url, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).filter(i => !listedKeys.has(`${i.media_type}:${i.media_id}`))
}

export async function getOverlapSuggestions(partyId) {
  // Fetch all party members
  const { data: members, error: membersError } = await supabase
    .from('party_members')
    .select('user_id')
    .eq('party_id', partyId)

  if (membersError) throw membersError
  if (!members || members.length < 2) return []

  const memberIds = members.map(m => m.user_id)

  // Fetch already-listed media to exclude
  const { data: listed } = await supabase
    .from('party_list_items')
    .select('media_type, media_id')
    .eq('party_id', partyId)

  const listedKeys = new Set((listed ?? []).map(i => `${i.media_type}:${i.media_id}`))

  // Queued (not yet watched) items across all party members — suggesting
  // titles people already finished defeats the watch-together purpose.
  const { data: queueItems, error: queueError } = await supabase
    .from('user_media_log')
    .select('user_id, media_type, media_id, media_title, media_creator, media_poster_url')
    .in('user_id', memberIds)
    .eq('status', 'queued')

  if (queueError) throw queueError

  // Group by (media_type, media_id) and count distinct members
  const groups = {}
  for (const item of queueItems ?? []) {
    const key = `${item.media_type}:${item.media_id}`
    if (listedKeys.has(key)) continue
    if (!groups[key]) {
      groups[key] = {
        media_type: item.media_type,
        media_id: item.media_id,
        media_title: item.media_title,
        media_creator: item.media_creator,
        media_poster_url: item.media_poster_url,
        member_count: new Set(),
      }
    }
    groups[key].member_count.add(item.user_id)
  }

  return Object.values(groups)
    .filter(g => g.member_count.size >= 2)
    .map(g => ({ ...g, member_count: g.member_count.size }))
    .sort((a, b) => b.member_count - a.member_count)
}

// ── Rotation ──────────────────────────────────────────────────

export function getCurrentPicker(members, watchedCount) {
  if (!members || members.length === 0) return null
  const sorted = [...members].sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at))
  return sorted[watchedCount % sorted.length]
}
