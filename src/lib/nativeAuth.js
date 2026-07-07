import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import { rememberInvite } from './invites'

export const NATIVE_AUTH_CALLBACK_URL = 'queued://auth/callback'

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

export function buildAuthRedirectUrl(invite) {
  const redirectUrl = new URL(isNativeApp() ? NATIVE_AUTH_CALLBACK_URL : '/', window.location.origin)
  if (invite) redirectUrl.searchParams.set('invite', invite)
  return redirectUrl.toString()
}

function paramsFromCallbackUrl(url) {
  const parsed = new URL(url)
  const params = new URLSearchParams(parsed.search)
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash
  const hashParams = new URLSearchParams(hash)
  for (const [key, value] of hashParams.entries()) params.set(key, value)
  return params
}

export async function handleAuthCallbackUrl(url) {
  if (!url?.startsWith(NATIVE_AUTH_CALLBACK_URL)) return false

  const params = paramsFromCallbackUrl(url)
  const invite = params.get('invite')
  if (invite) rememberInvite(invite)

  const error = params.get('error_description') || params.get('error')
  if (error) throw new Error(error)

  const code = params.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    return true
  }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) throw error
    return true
  }

  return false
}

export function startNativeAuthListener(onHandled) {
  if (!isNativeApp()) return () => {}

  let listener

  CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
    try {
      const handled = await handleAuthCallbackUrl(url)
      if (handled) onHandled?.()
    } catch (error) {
      console.error('Unable to complete native auth callback', error)
    }
  }).then(handle => {
    listener = handle
  })

  CapacitorApp.getLaunchUrl().then(async launchUrl => {
    if (!launchUrl?.url) return
    try {
      const handled = await handleAuthCallbackUrl(launchUrl.url)
      if (handled) onHandled?.()
    } catch (error) {
      console.error('Unable to complete native launch auth callback', error)
    }
  })

  return () => {
    listener?.remove()
  }
}
