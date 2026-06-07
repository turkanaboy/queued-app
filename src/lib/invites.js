import { supabase } from './supabase'

const INVITE_STORAGE_KEY = 'queued.inviteToken'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function getInviteFromUrl(search = window.location.search) {
  const invite = new URLSearchParams(search).get('invite')
  return invite && UUID_RE.test(invite) ? invite : null
}

export function rememberInvite(inviteToken) {
  if (!inviteToken) return
  window.localStorage.setItem(INVITE_STORAGE_KEY, inviteToken)
}

export function getStoredInvite() {
  const invite = window.localStorage.getItem(INVITE_STORAGE_KEY)
  return invite && UUID_RE.test(invite) ? invite : null
}

export function clearStoredInvite() {
  window.localStorage.removeItem(INVITE_STORAGE_KEY)
}

export function buildInviteLink(inviteToken) {
  const url = new URL('/login', window.location.origin)
  url.searchParams.set('invite', inviteToken)
  return url.toString()
}

export async function getOrCreateInviteToken(inviterId) {
  const { data: existing, error: selectError } = await supabase
    .from('invite_links')
    .select('token')
    .eq('inviter_id', inviterId)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing?.token) return existing.token

  const { data, error } = await supabase
    .from('invite_links')
    .insert({ inviter_id: inviterId })
    .select('token')
    .single()

  if (!error) return data.token
  if (error.code !== '23505') throw error

  const { data: raced, error: racedError } = await supabase
    .from('invite_links')
    .select('token')
    .eq('inviter_id', inviterId)
    .single()

  if (racedError) throw racedError
  return raced.token
}

export async function acceptStoredInvite() {
  const inviteToken = getStoredInvite()
  if (!inviteToken) {
    clearStoredInvite()
    return false
  }

  const { error } = await supabase.rpc('accept_friend_invite', { invite_token: inviteToken })
  if (error) throw error

  clearStoredInvite()
  return true
}
