import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function LogMediaSheet({ userId, onClose, onSaved }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [searching, setSearching] = useState(false)
  const [rating, setRating] = useState(null)
  const [review, setReview] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef(null)

  async function search(q) {
    setQuery(q)
    setSelected(null)
    clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-media?query=${encodeURIComponent(q)}&type=multi`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()
      setResults(json.results ?? [])
      setSearching(false)
    }, 400)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError('')
    const { error } = await supabase.from('user_media_log').upsert({
      user_id:          userId,
      media_type:       selected.media_type,
      media_id:         selected.media_id,
      media_title:      selected.media_title,
      media_poster_url: selected.media_poster_url,
      rating:           rating,
      review:           review.trim() || null,
    }, { onConflict: 'user_id,media_id' })

    if (error) { setError(error.message); setSaving(false); return }
    onSaved?.()
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 rounded-t-[32px] shadow-2xl"
        style={{ background: 'linear-gradient(170deg, #ff6b35 0%, #e91e8c 50%, #6b21a8 100%)' }}>
        <div className="px-5 pt-4 pb-8 space-y-4">
          {/* Handle */}
          <div className="w-10 h-1 bg-white/30 rounded-full mx-auto" />

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-white">Log media</h2>
            <button onClick={onClose} className="text-white/50 hover:text-white text-xl p-1">✕</button>
          </div>

          {/* Search */}
          {!selected ? (
            <div className="space-y-2">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2"/>
                  <path d="m21 21-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={e => search(e.target.value)}
                  placeholder="What did you watch?"
                  className="input-glass pl-10"
                />
              </div>
              {searching && <p className="text-white/40 text-xs text-center">Searching…</p>}
              {results.length > 0 && (
                <div className="glass rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                  {results.map(r => (
                    <button key={r.media_id} onClick={() => { setSelected(r); setResults([]) }}
                      className="btn-press flex items-center gap-3 w-full px-4 py-3 border-b border-white/10 last:border-0 text-left hover:bg-white/10">
                      {r.media_poster_url
                        ? <img src={r.media_poster_url} className="w-9 h-12 object-cover rounded-lg shrink-0" alt="" />
                        : <div className="w-9 h-12 rounded-lg shrink-0 text-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>🎬</div>
                      }
                      <div>
                        <p className="text-sm font-bold text-white">{r.media_title}</p>
                        <p className="text-xs text-white/40 capitalize">{r.media_type}{r.year ? ` · ${r.year}` : ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected title */}
              <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3">
                {selected.media_poster_url && (
                  <img src={selected.media_poster_url} className="w-10 h-14 object-cover rounded-xl shrink-0" alt="" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{selected.media_title}</p>
                  <p className="text-xs text-white/50 capitalize">{selected.media_type}{selected.year ? ` · ${selected.year}` : ''}</p>
                </div>
                <button onClick={() => { setSelected(null); setRating(null); setReview('') }}
                  className="btn-press text-white/40 hover:text-white text-lg p-1">✕</button>
              </div>

              {/* Rating */}
              <div>
                <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Your rating</p>
                <div className="flex items-center gap-2">
                  {[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5].map(v => (
                    <button key={v} onClick={() => setRating(v === rating ? null : v)}
                      className={`btn-press text-xl transition-transform ${rating && v <= rating ? 'text-amber-300 scale-110' : 'text-white/20'}`}>
                      {v % 1 === 0 ? '★' : '½'}
                    </button>
                  ))}
                  {rating && <span className="text-white/60 text-sm ml-1">{rating}</span>}
                </div>
              </div>

              {/* Review */}
              <div>
                <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">
                  Review <span className="text-white/30 normal-case font-normal">(optional)</span>
                </p>
                <div className="relative">
                  <textarea
                    value={review}
                    onChange={e => setReview(e.target.value.slice(0, 1000))}
                    rows={3}
                    placeholder="What did you think?"
                    className="input-glass resize-none"
                  />
                  <span className={`absolute bottom-2 right-3 text-xs ${review.length > 900 ? 'text-amber-300' : 'text-white/25'}`}>
                    {review.length}/1000
                  </span>
                </div>
              </div>

              {error && <p className="text-rose-300 text-sm">{error}</p>}

              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-press w-full py-3.5 rounded-2xl font-bold text-purple-900 text-sm disabled:opacity-40"
                style={{ background: 'white' }}
              >
                {saving ? 'Saving…' : 'Save to my log 📝'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
