import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import RatingModal from '../components/RatingModal'
import { RecommendationSheet, ProviderRows } from './AddRecommendationPage'
import { TASTE_GENRE_GROUPS } from '../lib/taste'
import { Chip, EmptyState, MEDIA_ORDER, MediumTabs, PosterTile, ScreenHeader, SectionTitle, SearchField, SheetShell } from '../lib/queuedDesign'

async function searchMedia(path) {
  const token = (await supabase.auth.getSession()).data.session?.access_token
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-media${path}`,
    { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  )
  return res.json()
}

async function fetchTrending(mediaType, page = 1, genre = 'all') {
  const genreParam = genre === 'all' ? '' : `&genre=${encodeURIComponent(genre)}`
  return searchMedia(`?action=trending&media_type=${mediaType}&page=${page}${genreParam}`)
}

function mediaKey(item) {
  return `${item.media_type}:${item.media_id}`
}

export default function CollectionPage() {
  const { session } = useAuth()
  const [medium, setMedium] = useState('movie')
  const [items, setItems] = useState({ movie: [], tv: [], book: [], album: [] })
  const [pages, setPages] = useState({ movie: 1, tv: 1, book: 1, album: 1 })
  const [loading, setLoading] = useState({ movie: true, tv: true, book: true, album: true })
  const [logMap, setLogMap] = useState({})
  const [ratingItem, setRatingItem] = useState(null)
  const [actionItem, setActionItem] = useState(null)
  const [recommendItem, setRecommendItem] = useState(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [genre, setGenre] = useState('all')
  const searchDebounceRef = useRef(null)

  useEffect(() => {
    MEDIA_ORDER.forEach(type => loadSection(type, 1, 'all'))
    fetchUserLog()
  }, [session])

  async function fetchUserLog() {
    const { data } = await supabase.from('user_media_log').select('*').eq('user_id', session.user.id)
    const map = {}
    for (const entry of data ?? []) map[mediaKey(entry)] = entry
    setLogMap(map)
  }

  async function loadSection(mediaType, page, nextGenre = genre) {
    setLoading(prev => ({ ...prev, [mediaType]: true }))
    const json = await fetchTrending(mediaType, page, nextGenre)
    setItems(prev => {
      const next = page === 1 ? (json.results ?? []) : [...prev[mediaType], ...(json.results ?? [])]
      return { ...prev, [mediaType]: [...new Map(next.map(item => [item.media_id, item])).values()] }
    })
    setPages(prev => ({ ...prev, [mediaType]: page }))
    setLoading(prev => ({ ...prev, [mediaType]: false }))
  }

  async function fetchProviders(item) {
    if (!['movie', 'tv'].includes(item.media_type)) return []
    return (await searchMedia(`?action=providers&media_type=${item.media_type}&media_id=${item.media_id}`)).providers ?? []
  }

  async function handleQueue(item) {
    const providers = await fetchProviders(item)
    await upsertLog(item, 'queued', null, null, providers)
  }

  async function upsertLog(item, status, rating = null, review = null, providersOverride) {
    const providers = ['movie', 'tv'].includes(item.media_type)
      ? providersOverride ?? (await fetchProviders(item))
      : []
    await supabase.from('user_media_log').upsert({
      user_id: session.user.id,
      media_type: item.media_type,
      media_id: item.media_id,
      media_title: item.media_title,
      media_creator: item.media_creator ?? null,
      media_poster_url: item.media_poster_url,
      rating,
      status,
      review,
      source_type: 'self',
      streaming_providers: providers,
    }, { onConflict: 'user_id,media_type,media_id' })
    fetchUserLog()
  }

  async function openLogSheet(item) {
    const providers = await fetchProviders(item)
    setRatingItem({ ...item, streaming_providers: providers })
  }

  function changeMedium(next) {
    setMedium(next)
    setQuery('')
    setSearchResults([])
    setGenre('all')
    if (!items[next]?.length) loadSection(next, 1, 'all')
  }

  function changeGenre(nextGenre) {
    setGenre(nextGenre)
    setQuery('')
    setSearchResults([])
    loadSection(medium, 1, nextGenre)
  }

  function handleSearch(q) {
    setQuery(q)
    clearTimeout(searchDebounceRef.current)
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true)
      const json = await searchMedia(`?query=${encodeURIComponent(q)}&type=${medium}`)
      setSearchResults(json.results ?? [])
      setSearching(false)
    }, 350)
  }

  const activeItems = query.length >= 2 ? searchResults : (items[medium] ?? [])
  const queued = Object.values(logMap).filter(item => item.media_type === medium && item.status === 'queued')
  const genreOptions = useMemo(() => {
    const group = TASTE_GENRE_GROUPS.find(g => g.key === medium)
    return group?.genres ?? []
  }, [medium])

  return (
    <div className="pb-5">
      <ScreenHeader title="Discover" subtitle="Find what to queue or mark finished" />
      <MediumTabs value={medium} onChange={changeMedium} showCounts={false} />

      <div className="space-y-5 px-[18px] pt-4">
        <SearchField value={query} onChange={handleSearch} placeholder={`Search ${medium === 'tv' ? 'TV' : medium === 'album' ? 'albums' : `${medium}s`}...`} />
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          <Chip active={genre === 'all'} onClick={() => changeGenre('all')}>All genres</Chip>
          {genreOptions.map(option => (
            <Chip key={option} active={genre === option} onClick={() => changeGenre(option)}>{option}</Chip>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-[11px] font-bold text-[rgba(214,240,224,0.7)]">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2DD48F]" />In your queue</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#D8A84A]" />Rated</span>
          </div>
          <button onClick={() => loadSection(medium, pages[medium] + 1)} disabled={loading[medium] || query.length >= 2}
            className="btn-press rounded-full border border-[rgba(150,214,180,0.16)] bg-[rgba(9,46,32,0.66)] px-3 py-1.5 text-xs font-bold text-[rgba(214,240,224,0.7)] disabled:opacity-40">
            {loading[medium] ? '...' : 'Load more'}
          </button>
        </div>

        {(loading[medium] || searching) && activeItems.length === 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {[...Array(9)].map((_, i) => <div key={i} className="h-[120px] animate-pulse rounded-xl bg-white/10" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {activeItems.map(item => (
              <DiscoverCard key={mediaKey(item)} item={item} logEntry={logMap[mediaKey(item)]} onTap={() => setActionItem(item)} onQueue={() => handleQueue(item)} />
              ))}
            </div>
            {query.length < 2 && <button onClick={() => loadSection(medium, pages[medium] + 1)} disabled={loading[medium]}
              className="btn-press btn-outline-cream w-full rounded-2xl py-3 text-sm font-bold disabled:opacity-40">
              {loading[medium] ? 'Loading...' : 'Load more'}
            </button>}
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

      {actionItem && (
        <DiscoverActionSheet
          item={actionItem}
          logEntry={logMap[mediaKey(actionItem)]}
          onClose={() => setActionItem(null)}
          onLog={() => {
            setActionItem(null)
            openLogSheet(actionItem)
          }}
          onRecommend={() => {
            setRecommendItem(actionItem)
            setActionItem(null)
          }}
        />
      )}
      {ratingItem && <RatingModal item={ratingItem} existingEntry={logMap[mediaKey(ratingItem)] ?? ratingItem} onClose={() => setRatingItem(null)} onSaved={() => { fetchUserLog(); setRatingItem(null) }} />}
      {recommendItem && <RecommendationSheet initialItem={recommendItem} onClose={() => setRecommendItem(null)} />}
    </div>
  )
}

function DiscoverActionSheet({ item, logEntry, onClose, onLog, onRecommend }) {
  return (
    <SheetShell onClose={onClose} title={item.media_title} size="peek">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <PosterTile item={item} w={52} h={76} radius={12} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#F7F1E4]">{item.media_title}</p>
            <p className="mt-1 truncate text-xs text-[rgba(214,240,224,0.5)]">{item.media_creator || item.media_type}{item.year ? ` · ${item.year}` : ''}</p>
            {logEntry && <p className="mt-2 text-[11px] font-semibold text-[#D8A84A]">Already in your collection</p>}
          </div>
        </div>
        {logEntry?.streaming_providers && (
          <ProviderRows providers={logEntry.streaming_providers} title={item.media_title} creator={item.media_creator} mediaType={item.media_type} compact />
        )}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onRecommend} className="btn-press rounded-2xl border border-[rgba(150,214,180,0.16)] px-4 py-3 text-sm font-bold text-[rgba(214,240,224,0.7)]">Recommend</button>
          <button onClick={onLog} className="btn-press btn-cream rounded-2xl px-4 py-3 text-sm font-bold">Add to log</button>
        </div>
      </div>
    </SheetShell>
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
