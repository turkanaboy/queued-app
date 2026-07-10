export const NATIVE_AUTH_CALLBACK_URL = 'queued://auth/callback'

export function parseNativeAuthCallbackUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'queued:' || parsed.hostname !== 'auth' || parsed.pathname !== '/callback' || parsed.hash) return null
    return parsed.searchParams
  } catch {
    return null
  }
}
