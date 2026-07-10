import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import { rememberInvite } from './invites'
import { NATIVE_AUTH_CALLBACK_URL, parseNativeAuthCallbackUrl } from './nativeAuthUrl'

export { NATIVE_AUTH_CALLBACK_URL }

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

export function buildAuthRedirectUrl(invite) {
  const redirectUrl = new URL(isNativeApp() ? NATIVE_AUTH_CALLBACK_URL : '/', window.location.origin)
  if (invite) redirectUrl.searchParams.set('invite', invite)
  return redirectUrl.toString()
}

export async function handleAuthCallbackUrl(url) {
  const params = parseNativeAuthCallbackUrl(url)
  if (!params) return false

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

  return false
}

export function startNativeAuthListener(onHandled, onError) {
  if (!isNativeApp()) return () => {}

  let listener
  let disposed = false

  CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
    if (disposed) return
    try {
      const handled = await handleAuthCallbackUrl(url)
      if (handled) onHandled?.()
    } catch (error) {
      onError?.(error)
    }
  }).then(handle => {
    if (disposed) handle.remove()
    else listener = handle
  }).catch(error => onError?.(error))

  CapacitorApp.getLaunchUrl().then(async launchUrl => {
    if (disposed || !launchUrl?.url) return
    try {
      const handled = await handleAuthCallbackUrl(launchUrl.url)
      if (handled) onHandled?.()
    } catch (error) {
      onError?.(error)
    }
  }).catch(error => onError?.(error))

  return () => {
    disposed = true
    listener?.remove()
  }
}
