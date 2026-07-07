// TMDB streaming provider IDs for the platforms we support.
// provider_id matches TMDB's watch/providers API.
export const PLATFORMS = [
  { id: 8,   name: 'Netflix',      color: '#E50914' },
  { id: 9,   name: 'Prime Video',  color: '#00A8E0' },
  { id: 15,  name: 'Hulu',         color: '#1CE783' },
  { id: 337, name: 'Disney+',      color: '#113CCF' },
  { id: 384, name: 'Max',          color: '#002BE7' },
  { id: 350, name: 'Apple TV+',    color: '#555555' },
  { id: 386, name: 'Peacock',      color: '#000000' },
  { id: 531, name: 'Paramount+',   color: '#0064FF' },
  { id: 283, name: 'Crunchyroll',  color: '#F47521' },
  { id: 37,  name: 'Showtime',     color: '#C8102E' },
]

// Returns initials-style abbreviation for pill display
export function platformInitials(name) {
  if (name === 'Prime Video') return 'Prime'
  if (name === 'Apple TV+') return 'ATV+'
  if (name === 'Paramount+') return 'P+'
  if (name === 'Crunchyroll') return 'CR'
  return name
}
