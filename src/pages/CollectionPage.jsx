import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import RatingModal from '../components/RatingModal'
import { IconBookmark, IconStar, PageHeader, TypeGlyph } from '../components/DesignPrimitives'

const MEDIA_TYPES = [
  { key: 'movie', label: 'Movies',   square: false },
  { key: 'tv',    label: 'TV Shows', square: false },
  { key: 'book',  label: 'Books',    square: false },
  { key: 'album', label: 'Albums',   square: true  },
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
    <div className="space-y-8 pb-4">
      <PageHeader title="Discover" subtitle="Tabbed shelves for movies, TV, books, and albums worth adding to your queue." />

      {MEDIA_TYPES.map(({ key, label, square }) => (
        <section key={key} className="anim-up">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-lg font-extrabold text-[#F7F1E4]">
              <TypeGlyph type={key} className="text-[#D8A84A]" />
              {label}
            </p>
            <button
              onClick={() => refresh(key)}
              disabled={loading[key]}
              className="btn-press rounded-full border border-[#96D6B4]/20 bg-[#092E20]/70 px-3 py-1.5 text-xs font-bold text-[#D6F0E0]/55 hover:text-[#F7F1E4] disabled:opacity-30"
            >
              {loading[key] ? '…' : 'Refresh'}
            </button>
          </div>

          {loading[key] && items[key].length === 0 ? (
            <div className="flex gap-3 overflow-hidden">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`shrink-0 animate-pulse rounded-2xl ${square ? 'h-[130px] w-[130px]' : 'h-[195px] w-[130px]'}`}
                  style={{ background: 'rgba(150,214,180,0.12)' }} />
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

              {key !== 'album' && (
                <button
                  onClick={() => loadSection(key, pages[key] + 1)}
                  disabled={loading[key]}
                  className={`btn-press q-panel flex shrink-0 flex-col items-center justify-center gap-1 rounded-2xl text-[#D6F0E0]/55 hover:text-[#F7F1E4] disabled:opacity-30 ${square ? 'h-[130px] w-[130px]' : 'h-[195px] w-[130px]'}`}
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
    <button onClick={onTap} className={`btn-press group shrink-0 ${w} text-left`}>
      <div className="relative overflow-hidden rounded-2xl border border-[#96D6B4]/14 bg-[#082E20] shadow-lg">
        <img src={item.media_poster_url} alt={item.media_title} className={`${w} ${h} object-cover`} />

        {logEntry && logEntry.rating ? (
          <div className="absolute inset-0 flex flex-col justify-end"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }}>
            <div className="px-2 pb-2">
              <div className="mb-0.5 flex items-center gap-1">
                <IconStar className="h-3 w-3 text-[#D8A84A]" />
                <span className="text-xs font-bold text-white">{logEntry.rating}</span>
              </div>
              {logEntry.review && <p className="line-clamp-2 text-[9px] italic text-white/50">&quot;{logEntry.review}&quot;</p>}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl opacity-0 transition-opacity group-hover:opacity-100"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <IconStar className="h-7 w-7 text-[#F4E9D1]" />
          </div>
        )}

        {logEntry && (
          <div className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shadow ${isQueued ? 'bg-[#C99A52] text-white' : 'bg-[#2DD48F] text-[#052016]'}`}>
            {isQueued ? <IconBookmark className="h-3 w-3" /> : '✓'}
          </div>
        )}

        {!logEntry && (
          <button
            onClick={e => { e.stopPropagation(); onQueue() }}
            className="btn-press absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
            style={{ background: 'rgba(5,32,22,0.88)' }}
            title="Add to queue"
          >
            <IconBookmark className="h-4 w-4 text-[#F4E9D1]" />
          </button>
        )}
      </div>

      <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-tight text-[#D6F0E0]/70">{item.media_title}</p>
      {item.media_creator && <p className="mt-0.5 truncate text-[10px] text-[#D6F0E0]/40">{item.media_creator}</p>}
      {item.year && <p className="mt-0.5 text-[10px] text-[#D6F0E0]/30">{item.year}</p>}
    </button>
  )
}
