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
  const [alreadySent, setAlreadySent] = useState({}) // friendId → true

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
      const { data, error } = await supabase.functions.invoke('search-media', {
        body: null,
        headers: {},
        method: 'GET',
        // Pass as query params via the URL
      })
      // Use fetch directly since supabase.functions.invoke doesn't support GET params easily
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-media?query=${encodeURIComponent(q)}&type=multi`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` } }
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

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-xl font-bold text-gray-900">New recommendation</h1>

      {/* Media search */}
      <section className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Search for a movie or TV show</label>
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="e.g. The Bear, Dune…"
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {searching && <p className="text-xs text-gray-400">Searching…</p>}
        {results.length > 0 && !selected && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {results.map(r => (
              <button
                key={r.media_id}
                onClick={() => { setSelected(r); setResults([]) }}
                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 text-left"
              >
                {r.media_poster_url
                  ? <img src={r.media_poster_url} className="w-10 h-14 object-cover rounded shrink-0" alt="" />
                  : <div className="w-10 h-14 bg-gray-100 rounded shrink-0" />
                }
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.media_title}</p>
                  <p className="text-xs text-gray-400 capitalize">{r.media_type} {r.year && `· ${r.year}`}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
            {selected.media_poster_url && (
              <img src={selected.media_poster_url} className="w-10 h-14 object-cover rounded shrink-0" alt="" />
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{selected.media_title}</p>
              <p className="text-xs text-gray-500 capitalize">{selected.media_type} {selected.year && `· ${selected.year}`}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
          </div>
        )}
      </section>

      {/* Friend picker */}
      <section className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Send to</label>
        {friends.length === 0 ? (
          <p className="text-sm text-gray-400">No friends yet.</p>
        ) : (
          <div className="space-y-1.5">
            {friends.map(f => {
              const isSelected = !!selectedFriends.find(s => s.friend.id === f.friend.id)
              const isSent = selected && alreadySent[f.friend.id]
              return (
                <button
                  key={f.friend.id}
                  onClick={() => !isSent && toggleFriend(f)}
                  disabled={isSent}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors text-left ${
                    isSent
                      ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200'
                      : isSelected
                      ? 'bg-indigo-50 border-indigo-300'
                      : 'bg-white border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <InitialsAvatar name={f.friend.display_name || f.friend.username} size="sm" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{f.friend.display_name || f.friend.username}</p>
                    {isSent && <p className="text-xs text-gray-400">Already sent</p>}
                  </div>
                  {isSelected && !isSent && <span className="text-indigo-600 text-sm">✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Note */}
      <section className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Note <span className="text-gray-400">(optional)</span>
        </label>
        <div className="relative">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Why are you recommending this?"
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <span className={`absolute bottom-2 right-3 text-xs ${note.length > 450 ? 'text-amber-500' : 'text-gray-300'}`}>
            {note.length}/500
          </span>
        </div>
      </section>

      <button
        onClick={handleSubmit}
        disabled={submitting || !selected || selectedFriends.filter(f => !alreadySent[f.friend.id]).length === 0}
        className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        {submitting ? 'Sending…' : `Send to ${selectedFriends.filter(f => !alreadySent[f.friend.id]).length || ''} friend${selectedFriends.filter(f => !alreadySent[f.friend.id]).length !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}
