import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import RatingModal from '../components/RatingModal'
import { EmptyState, MEDIA_ORDER, MediumTabs, PosterTile, ScreenHeader, SectionTitle } from '../lib/queuedDesign'

async function searchMedia(path) {
  const token = (await supabase.auth.getSession()).data.session?.access_token
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-media${path}`,
    { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  )
  return res.json()
}

async function fetchTrending(mediaType, page = 1) {
  return searchMedia(`?action=trending&media_type=${mediaType}&page=${page}`)
}

export default function CollectionPage() {
  const { session } = useAuth()
  const [medium, setMedium] = useState('movie')
  const [items, setItems] = useState({ movie: [], tv: [], book: [], album: [] })
  const [pages, setPages] = useState({ movie: 1, tv: 1, book: 1, album: 1 })
  const [loading, setLoading] = useState({ movie: true, tv: true, book: true, album: true })
  const [logMap, setLogMap] = useState({})
  const [ratingItem, setRatingItem] = useState(null)

  useEffect(() => {
    MEDIA_ORDER.forEach(type => loadSection(type, 1))
    fetchUserLog()
  }, [session])

  async function fetchUserLog() {
    const { data } = await supabase.from('user_media_log').select('*').eq('user_id', session.user.id)
    const map = {}
    for (const entry of data ?? []) map[entry.media_id] = entry
    setLogMap(map)
  }

  async function loadSection(mediaType, page) {
    setLoading(prev => ({ ...prev, [mediaType]: true }))
    const json = await fetchTrending(mediaType, page)
    setItems(prev => {
      const next = page === 1 ? (json.results ?? []) : [...prev[mediaType], ...(json.results ?? [])]
      return { ...prev, [mediaType]: [...new Map(next.map(item => [item.media_id, item])).values()] }
    })
    setPages(prev => ({ ...prev, [mediaType]: page }))
    setLoading(prev => ({ ...prev, [mediaType]: false }))
  }

  async function handleQueue(item) {
    const providers = ['movie', 'tv'].includes(item.media_type)
      ? (await searchMedia(`?action=providers&media_type=${item.media_type}&media_id=${item.media_id}`)).providers ?? []
      : []
    await supabase.from('user_media_log').upsert({
      user_id: session.user.id,
      media_type: item.media_type,
      media_id: item.media_id,
      media_title: item.media_title,
      media_creator: item.media_creator ?? null,
      media_poster_url: item.media_poster_url,
      rating: null,
      status: 'queued',
      source_type: 'self',
      streaming_providers: providers,
    }, { onConflict: 'user_id,media_id' })
    fetchUserLog()
  }

  const counts = Object.fromEntries(MEDIA_ORDER.map(type => [type, items[type]?.length ?? 0]))
  const activeItems = items[medium] ?? []
  const queued = Object.values(logMap).filter(item => item.media_type === medium && !item.rating)

  return (
    <div className="pb-5">
      <ScreenHeader title="Discover" subtitle="Find what to queue or mark finished" />
      <MediumTabs value={medium} counts={counts} onChange={setMedium} />

      <div className="space-y-5 px-[18px] pt-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-[11px] font-bold text-[rgba(214,240,224,0.7)]">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2DD48F]" />In your queue</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#D8A84A]" />Rated</span>
          </div>
          <button onClick={() => loadSection(medium, pages[medium] + 1)} disabled={loading[medium]}
            className="btn-press rounded-full border border-[rgba(150,214,180,0.16)] bg-[rgba(9,46,32,0.66)] px-3 py-1.5 text-xs font-bold text-[rgba(214,240,224,0.7)] disabled:opacity-40">
            {loading[medium] ? '...' : 'Load more'}
          </button>
        </div>

        {loading[medium] && activeItems.length === 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {[...Array(9)].map((_, i) => <div key={i} className="h-[120px] animate-pulse rounded-xl bg-white/10" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {activeItems.map(item => (
                <DiscoverCard key={item.media_id} item={item} logEntry={logMap[item.media_id]} onTap={() => setRatingItem(item)} onQueue={() => handleQueue(item)} />
              ))}
            </div>
            <button onClick={() => loadSection(medium, pages[medium] + 1)} disabled={loading[medium]}
              className="btn-press btn-outline-cream w-full rounded-2xl py-3 text-sm font-bold disabled:opacity-40">
              {loading[medium] ? 'Loading...' : 'Load more'}
            </button>
          </>
        )}

        <section>
          <SectionTitle count={queued.length}>Queued</SectionTitle>
          {queued.length === 0 ? (
            <div className="rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] shadow-[inset_3px_0_0_rgba(184,115,51,0.62)]">
              <EmptyState title="No queued titles" body="Tap + on a poster to save it here." />
            </div>
          ) : (
            <div className="overflow-hidden rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] shadow-[inset_3px_0_0_rgba(184,115,51,0.62)]">
              {queued.map((item, i) => (
                <div key={item.media_id} className={`flex items-center gap-3 px-[13px] py-[11px] ${i ? 'border-t border-[rgba(150,214,180,0.12)]' : ''}`}>
                  <PosterTile item={item} w={34} h={52} radius={8} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#F7F1E4]">{item.media_title}</p>
                    <p className="truncate text-[11.5px] text-[rgba(214,240,224,0.5)]">{item.media_creator || item.media_type}</p>
                  </div>
                  <button onClick={() => setRatingItem(item)} className="btn-press rounded-full border border-[#D8A84A]/40 px-3 py-1.5 text-xs font-bold text-[#D8A84A]">★ Rate</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {ratingItem && <RatingModal item={ratingItem} existingEntry={logMap[ratingItem.media_id]} onClose={() => setRatingItem(null)} onSaved={fetchUserLog} />}
    </div>
  )
}

function DiscoverCard({ item, logEntry, onTap, onQueue }) {
  const queued = logEntry && !logEntry.rating
  return (
    <article className="min-w-0">
      <button onClick={onTap} className="btn-press w-full text-left">
        <PosterTile item={item} className="w-full" h={120} radius={12}>
          <button onClick={e => { e.stopPropagation(); onQueue() }}
            className={`btn-press absolute right-1.5 top-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full text-sm font-bold backdrop-blur ${logEntry ? 'bg-[#2DD48F] text-[#052016]' : 'bg-[rgba(2,12,8,0.7)] text-[#F4E9D1]'}`}>
            {logEntry ? '✓' : '+'}
          </button>
          {logEntry?.rating && <div className="font-mono-q absolute bottom-1.5 left-1.5 rounded-full bg-[rgba(2,12,8,0.82)] px-2 py-1 text-[10.5px] font-semibold text-[#D8A84A] backdrop-blur">★ {logEntry.rating}</div>}
          {queued && <span className="absolute bottom-2 left-2 h-2 w-2 rounded-full bg-[#2DD48F]" />}
        </PosterTile>
      </button>
      <p className="mt-1.5 line-clamp-2 text-xs font-bold leading-tight text-[#F7F1E4]">{item.media_title}</p>
      <p className="mt-0.5 truncate text-[10.5px] text-[rgba(214,240,224,0.5)]">{item.media_creator || item.year}</p>
    </article>
  )
}
