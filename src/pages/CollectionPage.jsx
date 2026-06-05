import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import RatingModal from '../components/RatingModal'

const MEDIA_TYPES = [
  { key: 'movie', label: '🎬 Movies',   square: false },
  { key: 'tv',    label: '📺 TV Shows', square: false },
  { key: 'book',  label: '📚 Books',    square: false },
  { key: 'album', label: '🎵 Albums',   square: true  },
]

async function fetchTrending(mediaType, page = 1) {
  const token = (await supabase.auth.getSession()).data.session?.access_token
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-media?action=trending&media_type=${mediaType}&page=${page}`,
    { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  )
  return res.json()
}

export default function CollectionPage() {
  const { session } = useAuth()

  const [items, setItems] = useState({ movie: [], tv: [], book: [], album: [] })
  const [pages, setPages] = useState({ movie: 1, tv: 1, book: 1, album: 1 })
  const [loading, setLoading] = useState({ movie: true, tv: true, book: true, album: true })
  const [logMap, setLogMap] = useState({})
  const [ratingItem, setRatingItem] = useState(null)

  useEffect(() => {
    loadSection('movie', 1)
    loadSection('tv', 1)
    loadSection('book', 1)
    loadSection('album', 1)
    fetchUserLog()
  }, [session])

  async function fetchUserLog() {
    const { data } = await supabase
      .from('user_media_log')
      .select('media_id, rating, review')
      .eq('user_id', session.user.id)
    const map = {}
    for (const entry of data ?? []) map[entry.media_id] = entry
    setLogMap(map)
  }

  async function loadSection(mediaType, page) {
    setLoading(prev => ({ ...prev, [mediaType]: true }))
    const json = await fetchTrending(mediaType, page)
    setItems(prev => ({
      ...prev,
      [mediaType]: page === 1 ? (json.results ?? []) : [...prev[mediaType], ...(json.results ?? [])],
    }))
    setPages(prev => ({ ...prev, [mediaType]: page }))
    setLoading(prev => ({ ...prev, [mediaType]: false }))
  }

  async function refresh(mediaType) {
    const next = pages[mediaType] >= 5 ? 1 : pages[mediaType] + 1
    loadSection(mediaType, next)
  }

  async function handleQueue(item) {
    // Save to personal log with no rating (want to watch)
    await supabase.from('user_media_log').upsert({
      user_id:          session.user.id,
      media_type:       item.media_type,
      media_id:         item.media_id,
      media_title:      item.media_title,
      media_creator:    item.media_creator ?? null,
      media_poster_url: item.media_poster_url,
      rating:           null,
      status:           'queued',
      source_type:      'self',
    }, { onConflict: 'user_id,media_id' })
    fetchUserLog()
  }

  function handleSaved() {
    fetchUserLog()
  }

  return (
    <div className="space-y-8">
      <div className="anim-scale">
        <h1 className="text-3xl font-extrabold text-white">Discover</h1>
        <p className="text-white/50 text-sm mt-0.5">Rate what you've watched to build your collection</p>
      </div>

      {MEDIA_TYPES.map(({ key, label, square }) => (
        <section key={key} className="anim-up">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-extrabold text-lg">{label}</p>
            <button
              onClick={() => refresh(key)}
              disabled={loading[key]}
              className="btn-press text-xs font-bold text-white/50 hover:text-white border border-white/20 px-3 py-1.5 rounded-full disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              {loading[key] ? '…' : '↻ Refresh'}
            </button>
          </div>

          {loading[key] && items[key].length === 0 ? (
            <div className="flex gap-3 overflow-hidden">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`shrink-0 rounded-2xl animate-pulse ${square ? 'w-[130px] h-[130px]' : 'w-[130px] h-[195px]'}`}
                  style={{ background: 'rgba(255,255,255,0.1)' }} />
              ))}
            </div>
          ) : (
            <div className="poster-scroll -mx-4 px-4">
              {items[key].map(item => {
                const logged = logMap[item.media_id]
                return (
                  <PosterCard
                    key={item.media_id}
                    item={item}
                    logEntry={logged}
                    square={square}
                    onTap={() => setRatingItem(item)}
                    onQueue={() => handleQueue(item)}
                  />
                )
              })}

              {/* Load more — albums have page 1 only from RSS */}
              {key !== 'album' && (
                <button
                  onClick={() => loadSection(key, pages[key] + 1)}
                  disabled={loading[key]}
                  className={`btn-press shrink-0 rounded-2xl flex flex-col items-center justify-center gap-1 text-white/50 hover:text-white border border-white/20 disabled:opacity-30 ${square ? 'w-[130px] h-[130px]' : 'w-[130px] h-[195px]'}`}
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  <span className="text-2xl">{loading[key] ? '…' : '+'}</span>
                  <span className="text-[10px] font-semibold">More</span>
                </button>
              )}
            </div>
          )}
        </section>
      ))}

      {ratingItem && (
        <RatingModal
          item={ratingItem}
          existingEntry={logMap[ratingItem.media_id]}
          onClose={() => setRatingItem(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function PosterCard({ item, logEntry, square = false, onTap, onQueue }) {
  const w = square ? 'w-[130px]' : 'w-[130px]'
  const h = square ? 'h-[130px]' : 'h-[195px]'
  const isQueued = logEntry && !logEntry.rating

  return (
    <button
      onClick={onTap}
      className={`btn-press shrink-0 ${w} text-left group`}
    >
      <div className="relative rounded-2xl overflow-hidden shadow-lg">
        <img
          src={item.media_poster_url}
          alt={item.media_title}
          className={`${w} ${h} object-cover`}
        />

        {/* Rated overlay */}
        {logEntry && logEntry.rating ? (
          <div className="absolute inset-0 flex flex-col justify-end"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }}>
            <div className="px-2 pb-2">
              <div className="flex items-center gap-0.5 mb-0.5">
                <span className="text-amber-300 text-xs">★</span>
                <span className="text-white text-xs font-bold">{logEntry.rating}</span>
              </div>
              {logEntry.review && (
                <p className="text-white/50 text-[9px] line-clamp-2 italic">"{logEntry.review}"</p>
              )}
            </div>
          </div>
        ) : (
          /* Hover/tap prompt */
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <span className="text-white text-2xl">★</span>
          </div>
        )}

        {/* Status badge: green check = rated, bookmark = queued */}
        {logEntry && (
          <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow text-[9px] font-bold ${isQueued ? 'bg-sky-400 text-white' : 'bg-green-400 text-white'}`}>
            {isQueued ? '🔖' : '✓'}
          </div>
        )}

        {/* Add to queue button — only shown when not yet logged */}
        {!logEntry && (
          <button
            onClick={e => { e.stopPropagation(); onQueue() }}
            className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity btn-press"
            style={{ background: 'rgba(0,0,0,0.7)', fontSize: '0.75rem' }}
            title="Add to queue"
          >
            🔖
          </button>
        )}
      </div>

      <p className="text-white/70 text-[11px] font-semibold mt-1.5 leading-tight line-clamp-2">
        {item.media_title}
      </p>
      {item.media_creator && (
        <p className="text-white/40 text-[10px] mt-0.5 truncate">{item.media_creator}</p>
      )}
      {item.year && <p className="text-white/30 text-[10px] mt-0.5">{item.year}</p>}
    </button>
  )
}
