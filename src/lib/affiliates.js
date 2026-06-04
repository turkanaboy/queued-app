const AMAZON_TAG     = import.meta.env.VITE_AMAZON_AFFILIATE_TAG   // e.g. 'queued-20'
const BOOKSHOP_ID    = import.meta.env.VITE_BOOKSHOP_AFFILIATE_ID   // e.g. 'queued'

// ── Video provider IDs ───────────────────────────────────────
const AMAZON_IDS = new Set([9, 119, 10])
const APPLE_IDS  = new Set([350])
const GOOGLE_IDS = new Set([3])
const VUDU_IDS   = new Set([7])

export function getProviderLink(provider, title, tmdbJwLink) {
  const q = encodeURIComponent(title)

  if (AMAZON_IDS.has(provider.provider_id)) {
    const base = `https://www.amazon.com/s?k=${q}&i=instant-video`
    return AMAZON_TAG ? `${base}&tag=${AMAZON_TAG}` : base
  }
  if (APPLE_IDS.has(provider.provider_id))  return `https://tv.apple.com/search?term=${q}`
  if (GOOGLE_IDS.has(provider.provider_id)) return `https://play.google.com/store/search?q=${q}&c=movies`
  if (VUDU_IDS.has(provider.provider_id))   return `https://www.vudu.com/content/movies/search?searchString=${q}`

  return tmdbJwLink || `https://www.justwatch.com/us/search?q=${q}`
}

export function getJustWatchLink(title) {
  return `https://www.justwatch.com/us/search?q=${encodeURIComponent(title)}`
}

// ── Books ────────────────────────────────────────────────────
export function getBookLinks(title, creator) {
  const q = encodeURIComponent(`${title}${creator ? ` ${creator}` : ''}`)

  return {
    bookshop: BOOKSHOP_ID
      ? `https://bookshop.org/a/${BOOKSHOP_ID}/search?keywords=${q}`
      : `https://bookshop.org/search?keywords=${q}`,
    amazon: (() => {
      const base = `https://www.amazon.com/s?k=${q}&i=stripbooks`
      return AMAZON_TAG ? `${base}&tag=${AMAZON_TAG}` : base
    })(),
  }
}

// ── Albums ───────────────────────────────────────────────────
export function getAlbumLinks(title, creator) {
  const q = encodeURIComponent(`${creator ? `${creator} ` : ''}${title}`)

  return {
    spotify:    `https://open.spotify.com/search/${q}`,
    appleMusic: `https://music.apple.com/search?term=${q}`,
  }
}
