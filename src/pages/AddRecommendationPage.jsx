import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { InitialsAvatar } from '../components/Layout'

export default function AddRecommendationPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [searching, setSearching] = useState(false)

  const [friends, setFriends] = useState([])
  const [selectedFriends, setSelectedFriends] = useState([])
  const [alreadySent, setAlreadySent] = useState({})

  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => { fetchFriends() }, [session])

  async function fetchFriends() {
    const uid = session.user.id
    const { data } = await supabase
      .from('friendships')
      .select('*, user_a:users!friendships_user_a_id_fkey(*), user_b:users!friendships_user_b_id_fkey(*)')
      .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`)
      .eq('status', 'accepted')
    setFriends((data ?? []).map(f => ({
      ...f,
      friend: f.user_a_id === uid ? f.user_b : f.user_a,
    })))
  }

  useEffect(() => {
    if (selected && selectedFriends.length > 0) {
      checkDuplicates(selected.media_id, selectedFriends.map(f => f.friend.id))
    }
  }, [selected, selectedFriends.length])

  async function checkDuplicates(mediaId, friendIds) {
    const uid = session.user.id
    const { data } = await supabase
      .from('recommendations')
      .select('recipient_id')
      .eq('sender_id', uid)
      .eq('media_id', mediaId)
      .in('recipient_id', friendIds)
      .is('deleted_at', null)
    const sent = {}
    for (const r of data ?? []) sent[r.recipient_id] = true
    setAlreadySent(sent)
  }

  function handleSearch(q) {
    setQuery(q)
    setSelected(null)
    clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-media?query=${encodeURIComponent(q)}&type=multi`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()
      setResults(json.results ?? [])
      setSearching(false)
    }, 400)
  }

  function toggleFriend(f) {
    setSelectedFriends(prev =>
      prev.find(s => s.friend.id === f.friend.id)
        ? prev.filter(s => s.friend.id !== f.friend.id)
        : [...prev, f]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selected || selectedFriends.length === 0) return
    setSubmitting(true)
    const uid = session.user.id
    const rows = selectedFriends
      .filter(f => !alreadySent[f.friend.id])
      .map(f => ({
        sender_id: uid,
        recipient_id: f.friend.id,
        media_type: selected.media_type,
        media_id: selected.media_id,
        media_title: selected.media_title,
        media_poster_url: selected.media_poster_url,
        note: note.trim() || null,
      }))
    await supabase.from('recommendations').insert(rows)
    navigate('/friends')
  }

  const sendableCount = selectedFriends.filter(f => !alreadySent[f.friend.id]).length

  return (
    <div className="space-y-6 pb-4">
      <div className="anim-scale">
        <h1 className="text-3xl font-extrabold text-white">New rec</h1>
        <p className="text-white/50 text-sm mt-0.5">Search for something worth sharing</p>
      </div>

      {/* Media search */}
      <div className="anim-up space-y-3">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2"/>
            <path d="m21 21-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search movies & TV shows…"
            className="input-glass pl-10"
          />
        </div>

        {searching && (
          <p className="text-white/40 text-xs text-center">Searching…</p>
        )}

        {results.length > 0 && !selected && (
          <div className="glass rounded-2xl overflow-hidden">
            {results.map(r => (
              <button
                key={r.media_id}
                onClick={() => { setSelected(r); setResults([]) }}
                className="btn-press flex items-center gap-3 w-full px-4 py-3 border-b border-white/10 last:border-0 text-left hover:bg-white/10 transition-colors"
              >
                {r.media_poster_url
                  ? <img src={r.media_poster_url} className="w-10 h-14 object-cover rounded-xl shrink-0" alt="" />
                  : <div className="w-10 h-14 rounded-xl shrink-0 flex items-center justify-center text-xl"
                      style={{ background: 'rgba(255,255,255,0.1)' }}>🎬</div>
                }
                <div>
                  <p className="text-sm font-bold text-white">{r.media_title}</p>
                  <p className="text-xs text-white/40 capitalize">{r.media_type}{r.year ? ` · ${r.year}` : ''}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3">
            {selected.media_poster_url && (
              <img src={selected.media_poster_url} className="w-10 h-14 object-cover rounded-xl shrink-0" alt="" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{selected.media_title}</p>
              <p className="text-xs text-white/50 capitalize">{selected.media_type}{selected.year ? ` · ${selected.year}` : ''}</p>
            </div>
            <button onClick={() => { setSelected(null); setQuery('') }}
              className="btn-press text-white/40 hover:text-white text-lg p-1">✕</button>
          </div>
        )}
      </div>

      {/* Friend picker */}
      <div className="anim-up space-y-2">
        <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Send to</p>
        {friends.length === 0 ? (
          <p className="text-white/40 text-sm">No friends yet.</p>
        ) : (
          <div className="space-y-2">
            {friends.map(f => {
              const isSelected = !!selectedFriends.find(s => s.friend.id === f.friend.id)
              const isSent = selected && alreadySent[f.friend.id]
              return (
                <button
                  key={f.friend.id}
                  onClick={() => !isSent && toggleFriend(f)}
                  disabled={isSent}
                  className={`btn-press w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                    isSent ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                  style={{
                    background: isSelected && !isSent ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
                    border: isSelected && !isSent ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <InitialsAvatar name={f.friend.display_name || f.friend.username} size="sm" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{f.friend.display_name || f.friend.username}</p>
                    {isSent && <p className="text-xs text-white/40">Already sent</p>}
                  </div>
                  {isSelected && !isSent && <span className="text-white font-bold">✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Note */}
      <div className="anim-up space-y-2">
        <p className="text-white/50 text-xs font-bold uppercase tracking-widest">
          Note <span className="text-white/30 normal-case font-medium">(optional)</span>
        </p>
        <div className="relative">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Why are you recommending this?"
            className="input-glass resize-none"
            style={{ lineHeight: '1.5' }}
          />
          <span className={`absolute bottom-3 right-3 text-xs ${note.length > 450 ? 'text-amber-300' : 'text-white/25'}`}>
            {note.length}/500
          </span>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || !selected || sendableCount === 0}
        className="btn-press w-full py-4 rounded-2xl font-bold text-purple-900 text-sm shadow-xl disabled:opacity-40"
        style={{ background: 'white' }}
      >
        {submitting
          ? 'Sending…'
          : sendableCount > 0
          ? `Send to ${sendableCount} friend${sendableCount !== 1 ? 's' : ''} 🚀`
          : 'Select a movie & friend'}
      </button>
    </div>
  )
}
