import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Chip, MEDIA, MEDIA_ORDER, PosterTile, SearchField, SheetShell } from '../lib/queuedDesign'

const TYPE_OPTIONS = ['multi', ...MEDIA_ORDER]
const PLACEHOLDERS = {
  multi: 'Search everything...',
  movie: 'Search movies...',
  tv: 'Search TV shows...',
  book: 'Search books...',
  album: 'Search albums...',
}

export default function LogMediaSheet({ userId, onClose, onSaved }) {
  const [searchType, setSearchType] = useState('multi')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [providers, setProviders] = useState(null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [rating, setRating] = useState(null)
  const [review, setReview] = useState('')
  const debounceRef = useRef(null)

  async function search(q, type = searchType) {
    setQuery(q)
    setSelected(null)
    setProviders(null)
    clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-media?query=${encodeURIComponent(q)}&type=${type}`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()
      setResults(json.results ?? [])
      setSearching(false)
    }, 400)
  }

  async function selectTitle(item) {
    setSelected(item)
    setResults([])
    if (!['movie', 'tv'].includes(item.media_type)) {
      setProviders([])
      return
    }
    const token = (await supabase.auth.getSession()).data.session?.access_token
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-media?action=providers&media_type=${item.media_type}&media_id=${item.media_id}`,
      { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
    )
    const json = await res.json()
    setProviders(json.providers ?? [])
  }

  function changeType(t) {
    setSearchType(t)
    setResults([])
    if (query.length >= 2) search(query, t)
  }

  async function handleSave(status) {
    if (!selected) return
    setSaving(true)
    setError('')
    const { error } = await supabase.from('user_media_log').upsert({
      user_id: userId,
      media_type: selected.media_type,
      media_id: selected.media_id,
      media_title: selected.media_title,
      media_creator: selected.media_creator ?? null,
      media_poster_url: selected.media_poster_url,
      rating: status === 'finished' ? rating : null,
      status,
      review: status === 'finished' ? (review.trim() || null) : null,
      source_type: 'self',
      streaming_providers: providers ?? [],
    }, { onConflict: 'user_id,media_id' })
    if (error) { setError(error.message); setSaving(false); return }
    onSaved?.()
    onClose()
  }

  return (
    <SheetShell onClose={onClose} title="Add title">
      {!selected ? (
        <div className="space-y-3">
          <div className="scrollbar-none flex gap-2 overflow-x-auto">
            {TYPE_OPTIONS.map(type => <Chip key={type} active={searchType === type} onClick={() => changeType(type)}>{type === 'multi' ? 'All' : MEDIA[type].label}</Chip>)}
          </div>
          <SearchField autoFocus value={query} onChange={search} placeholder={PLACEHOLDERS[searchType]} />
          {searching && <p className="text-center text-xs text-white/40">Searching...</p>}
          {results.length > 0 && (
            <div className="max-h-[280px] overflow-y-auto rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] shadow-[inset_3px_0_0_rgba(184,115,51,0.62)]">
              {results.map((r, i) => (
                <button key={r.media_id} onClick={() => selectTitle(r)}
                  className={`btn-press flex w-full items-center gap-3 px-[13px] py-[11px] text-left ${i ? 'border-t border-[rgba(150,214,180,0.12)]' : ''}`}>
                  <PosterTile item={r} w={34} h={52} radius={8} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#F7F1E4]">{r.media_title}</p>
                    <p className="truncate text-[11.5px] capitalize text-[rgba(214,240,224,0.5)]">{r.media_creator ? `${r.media_creator} · ` : ''}{r.media_type}{r.year ? ` · ${r.year}` : ''}</p>
                  </div>
                  <span className="text-xl text-[#D8A84A]">+</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] p-3">
            <PosterTile item={selected} w={44} h={64} radius={10} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-[#F7F1E4]">{selected.media_title}</p>
              <p className="truncate text-xs text-[rgba(214,240,224,0.5)]">{selected.media_creator || selected.media_type}{selected.year ? ` · ${selected.year}` : ''}</p>
              <button onClick={() => setSelected(null)} className="btn-press mt-1 text-xs font-bold text-[#D8A84A]">← Pick another</button>
            </div>
          </div>
          <div>
            <p className="font-mono-q mb-2 text-[10.5px] font-semibold uppercase tracking-[1.6px] text-[rgba(214,240,224,0.5)]">Optional rating</p>
            <div className="grid grid-cols-10 gap-1.5">
              {[1,2,3,4,5,6,7,8,9,10].map(n => {
                const active = rating && n <= rating
                return (
                  <button key={n} onClick={() => setRating(rating === n ? null : n)}
                    className={`font-mono-q btn-press h-[30px] rounded-[7px] text-[11px] font-semibold ${active ? 'text-[#052016]' : 'text-[rgba(214,240,224,0.55)]'}`}
                    style={{ background: active ? 'linear-gradient(180deg, #E7C674, #C99A52)' : 'rgba(2,17,12,0.5)', boxShadow: active ? 'none' : 'inset 0 1px 0 rgba(244,233,209,0.08)' }}>
                    {n}
                  </button>
                )
              })}
            </div>
          </div>
          <textarea value={review} onChange={e => setReview(e.target.value.slice(0, 1000))} rows={3} placeholder="Review (optional)"
            className="w-full resize-none rounded-[14px] border border-[rgba(150,214,180,0.16)] bg-[rgba(2,17,12,0.7)] px-3.5 py-3 text-sm text-[#F7F1E4] outline-none placeholder:text-[#F7F1E4]/35 focus:border-[#D8A84A]/80" />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleSave('queued')} disabled={saving} className="btn-press rounded-2xl border border-[rgba(150,214,180,0.16)] px-4 py-3 text-sm font-bold text-[rgba(214,240,224,0.7)] disabled:opacity-40">Add to queue</button>
            <button onClick={() => handleSave('finished')} disabled={saving} className="btn-press btn-cream rounded-2xl px-4 py-3 text-sm font-bold disabled:opacity-40">{saving ? 'Saving...' : 'Mark finished'}</button>
          </div>
        </div>
      )}
    </SheetShell>
  )
}
