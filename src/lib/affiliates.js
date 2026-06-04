// Affiliate tag env vars — add your IDs to .env.local
const AMAZON_TAG = import.meta.env.VITE_AMAZON_AFFILIATE_TAG // e.g. 'queued-20'

// Provider IDs that belong to Amazon's ecosystem
const AMAZON_PROVIDER_IDS = new Set([9, 119, 10]) // Prime Video, Amazon Video, Amazon Prime
// Apple TV+
const APPLE_PROVIDER_IDS  = new Set([350])
// Google Play Movies
const GOOGLE_PROVIDER_IDS = new Set([3])
// Vudu / Fandango at Home
const VUDU_PROVIDER_IDS   = new Set([7])
// Microsoft / Movies Anywhere
const MSFT_PROVIDER_IDS   = new Set([68, 192])

export function getProviderLink(provider, title, tmdbJwLink) {
  const q = encodeURIComponent(title)

  if (AMAZON_PROVIDER_IDS.has(provider.provider_id)) {
    const base = `https://www.amazon.com/s?k=${q}&i=instant-video`
    return AMAZON_TAG ? `${base}&tag=${AMAZON_TAG}` : base
  }

  if (APPLE_PROVIDER_IDS.has(provider.provider_id)) {
    return `https://tv.apple.com/search?term=${q}`
  }

  if (GOOGLE_PROVIDER_IDS.has(provider.provider_id)) {
    return `https://play.google.com/store/search?q=${q}&c=movies`
  }

  if (VUDU_PROVIDER_IDS.has(provider.provider_id)) {
    return `https://www.vudu.com/content/movies/search?searchString=${q}`
  }

  // Default: JustWatch page for the specific title (already has JustWatch affiliate tracking)
  return tmdbJwLink || `https://www.justwatch.com/us/search?q=${q}`
}

export function getJustWatchLink(title) {
  return `https://www.justwatch.com/us/search?q=${encodeURIComponent(title)}`
}
