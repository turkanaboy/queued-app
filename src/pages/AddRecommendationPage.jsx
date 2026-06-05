import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { InitialsAvatar } from '../components/Layout'
import { getProviderLink, getJustWatchLink, getBookLinks, getAlbumLinks } from '../lib/affiliates'

async function tmdbCall(path) {
  const token = (await supabase.auth.getSession()).data.session?.access_token
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-media${path}`,
    { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  )
  return res.json()
}

// providers is now { flatrate, rent, buy, link } — handle legacy array format too
function getFlatrate(providers) {
  if (!providers) return []
  return Array.isArray(providers) ? providers : (providers.flatrate ?? [])
}

export default function AddRecommendationPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [searchType, setSearchType] = useState('multi')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [providers, setProviders] = useState(null) // { flatrate, rent, buy, link } or null for book/album
  const [searching, setSearching] = useState(false)
  const [loadingProviders, setLoadingProviders] = useState(false)

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

  function handleSearch(q, type = searchType) {
    setQuery(q)
    setSelected(null)
    setProviders(null)
    clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const json = await tmdbCall(`?query=${encodeURIComponent(q)}&type=${type}`)
      setResults(json.results ?? [])
      setSearching(false)
    }, 400)
  }

  function changeSearchType(t) {
    setSearchType(t)
    setResults([])
    if (query.length >= 2) handleSearch(query, t)
  }

  async function selectTitle(r) {
    setSelected(r)
    setResults([])
    // Books and albums don't use TMDB watch providers
    if (r.media_type === 'book' || r.media_type === 'album') {
      setProviders(null)
      return
    }
    setLoadingProviders(true)
    const json = await tmdbCall(`?action=providers&media_type=${r.media_type}&media_id=${r.media_id}`)
    setProviders(json.providers ?? null)
    setLoadingProviders(false)
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
        sender_id:           uid,
        recipient_id:        f.friend.id,
        media_type:          selected.media_type,
        media_id:            selected.media_id,
        media_title:         selected.media_title,
        media_poster_url:    selected.media_poster_url,
        note:                note.trim() || null,
        media_creator:       selected.media_creator ?? null,
        streaming_providers: providers ?? [],
      }))
    await supabase.from('recommendations').insert(rows)
    navigate('/friends')
  }

  const sendableCount = selectedFriends.filter(f => !alreadySent[f.friend.id]).length
  const flatrate = getFlatrate(providers)

  return (
    <div className="space-y-6 pb-4">
      <div className="anim-scale">
        <h1 className="text-3xl font-extrabold text-white">New rec</h1>
        <p className="text-white/50 text-sm mt-0.5">Search for something worth sharing</p>
      </div>

      {/* Media search */}
      <div className="anim-up space-y-3">
        {/* Type selector */}
        <div className="paper-tabs flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {[
            { v: 'multi', l: 'All' },
            { v: 'movie', l: '🎬 Movies' },
            { v: 'tv',    l: '📺 TV' },
            { v: 'book',  l: '📚 Books' },
            { v: 'album', l: '🎵 Albums' },
          ].map(t => (
            <button key={t.v} onClick={() => changeSearchType(t.v)}
              className="btn-press shrink-0 text-xs font-extrabold px-3 py-2 rounded-xl border transition-all"
              style={{
                background: searchType === t.v ? '#F4E9D1' : 'rgba(2,17,12,0.42)',
                border: searchType === t.v ? '1px solid #D8A84A' : '1px solid rgba(244,233,209,0.18)',
                borderTopWidth: searchType === t.v ? '4px' : '1px',
                color: searchType === t.v ? '#052016' : 'rgba(244,233,209,0.72)',
              }}>
              {t.l}
            </button>
          ))}
        </div>

        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2"/>
            <path d="m21 21-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search…"
            className="input-glass input-search"
          />
        </div>

        {searching && <p className="text-white/40 text-xs text-center">Searching…</p>}

        {results.length > 0 && !selected && (
          <div className="glass rounded-2xl overflow-hidden">
            {results.map(r => (
              <button key={r.media_id} onClick={() => selectTitle(r)}
                className="btn-press flex items-center gap-3 w-full px-4 py-3 border-b border-white/10 last:border-0 text-left hover:bg-white/10 transition-colors">
                {r.media_poster_url
                  ? <img src={r.media_poster_url} className="w-10 h-14 object-cover rounded-xl shrink-0" alt="" />
                  : <div className="w-10 h-14 rounded-xl shrink-0 flex items-center justify-center text-xl" style={{ background: 'rgba(255,255,255,0.1)' }}>🎬</div>
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
          <div className="glass rounded-2xl p-3 space-y-3">
            <div className="flex items-center gap-3">
              {selected.media_poster_url && (
                <img src={selected.media_poster_url} className="w-10 h-14 object-cover rounded-xl shrink-0" alt="" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{selected.media_title}</p>
                <p className="text-xs text-white/50 capitalize">{selected.media_type}{selected.year ? ` · ${selected.year}` : ''}</p>
              </div>
              <button onClick={() => { setSelected(null); setQuery(''); setProviders(null) }}
                className="btn-press text-white/40 hover:text-white text-lg p-1">✕</button>
            </div>

            {loadingProviders ? (
              <p className="text-white/40 text-xs">Checking where to watch…</p>
            ) : (
              <ProviderRows
                providers={providers}
                title={selected.media_title}
                creator={selected.media_creator}
                mediaType={selected.media_type}
                compact
              />
            )}
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
              const friendPlatforms = f.friend.platforms ?? []
              const compatible = flatrate.filter(p => friendPlatforms.includes(p.provider_id))
              return (
                <button key={f.friend.id} onClick={() => !isSent && toggleFriend(f)} disabled={isSent}
                  className={`btn-press w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${isSent ? 'opacity-40 cursor-not-allowed' : ''}`}
                  style={{
                    background: isSelected && !isSent ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
                    border: isSelected && !isSent ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.15)',
                  }}>
                  <InitialsAvatar name={f.friend.display_name || f.friend.username} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{f.friend.display_name || f.friend.username}</p>
                    {isSent && <p className="text-xs text-white/40">Already sent</p>}
                    {!isSent && compatible.length > 0 && (
                      <p className="text-xs text-green-300 font-semibold">✓ On their {compatible.map(p => p.provider_name).join(', ')}</p>
                    )}
                    {!isSent && selected && flatrate.length > 0 && compatible.length === 0 && friendPlatforms.length > 0 && (
                      <p className="text-xs text-white/30">Not on their platforms</p>
                    )}
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
          Note <span className="text-white/30 normal-case font-normal">(optional)</span>
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

      <button onClick={handleSubmit}
        disabled={submitting || !selected || sendableCount === 0}
        className="btn-press btn-cream w-full py-4 rounded-2xl font-bold text-sm disabled:opacity-40">
        {submitting ? 'Sending…' : sendableCount > 0
          ? `Send to ${sendableCount} friend${sendableCount !== 1 ? 's' : ''} 🚀`
          : 'Select a title & friend'}
      </button>
    </div>
  )
}

// Shared provider display component — used in AddRec and RecommendationCard
export function ProviderRows({ providers, title, creator, mediaType, compact = false, myPlatforms = [] }) {
  // Books: Bookshop.org + Amazon Books
  if (mediaType === 'book') {
    const links = getBookLinks(title, creator)
    return (
      <div className={`flex items-center gap-2 flex-wrap ${compact ? '' : 'mt-2'}`}>
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Buy</span>
        <a href={links.bookshop} target="_blank" rel="noopener noreferrer"
          className="btn-press text-[10px] font-bold px-2.5 py-1 rounded-full text-white border border-white/20 hover:bg-white/20"
          style={{ background: 'rgba(255,255,255,0.1)' }}>
          Bookshop.org
        </a>
        <a href={links.amazon} target="_blank" rel="noopener noreferrer"
          className="btn-press text-[10px] font-bold px-2.5 py-1 rounded-full text-white border border-white/20 hover:bg-white/20"
          style={{ background: 'rgba(255,255,255,0.1)' }}>
          Amazon Books
        </a>
      </div>
    )
  }

  // Albums: Spotify + Apple Music
  if (mediaType === 'album') {
    const links = getAlbumLinks(title, creator)
    return (
      <div className={`flex items-center gap-2 flex-wrap ${compact ? '' : 'mt-2'}`}>
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Listen</span>
        <a href={links.spotify} target="_blank" rel="noopener noreferrer"
          className="btn-press text-[10px] font-bold px-2.5 py-1 rounded-full text-white border border-white/20 hover:bg-white/20"
          style={{ background: 'rgba(255,255,255,0.1)' }}>
          Spotify
        </a>
        <a href={links.appleMusic} target="_blank" rel="noopener noreferrer"
          className="btn-press text-[10px] font-bold px-2.5 py-1 rounded-full text-white border border-white/20 hover:bg-white/20"
          style={{ background: 'rgba(255,255,255,0.1)' }}>
          Apple Music
        </a>
      </div>
    )
  }

  if (!providers) return null

  // Handle legacy array format (old rows have streaming_providers as array)
  if (Array.isArray(providers)) {
    if (providers.length === 0) return null
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {providers.map(p => (
          <ProviderLogo key={p.provider_id} provider={p} title={title} link={null}
            owned={myPlatforms.includes(p.provider_id)} hasOwnership={myPlatforms.length > 0} />
        ))}
      </div>
    )
  }

  const { flatrate = [], rent = [], buy = [], link: jwLink } = providers
  const hasAny = flatrate.length > 0 || rent.length > 0 || buy.length > 0

  if (!hasAny) {
    return jwLink
      ? <a href={jwLink} target="_blank" rel="noopener noreferrer"
          className="text-xs text-white/40 hover:text-white/70 underline">Find where to watch →</a>
      : <p className="text-white/30 text-xs">Not on major platforms</p>
  }

  return (
    <div className={`space-y-1.5 ${compact ? '' : 'mt-2'}`}>
      {flatrate.length > 0 && (
        <ProviderSection label="Stream" providers={flatrate} title={title} jwLink={jwLink}
          myPlatforms={myPlatforms} isStream />
      )}
      {rent.length > 0 && (
        <ProviderSection label="Rent" providers={rent} title={title} jwLink={jwLink} />
      )}
      {buy.length > 0 && (
        <ProviderSection label="Buy" providers={buy} title={title} jwLink={jwLink} />
      )}
      {jwLink && (
        <a href={jwLink} target="_blank" rel="noopener noreferrer"
          className="inline-block text-[10px] text-white/30 hover:text-white/60 mt-0.5">
          All options on JustWatch →
        </a>
      )}
    </div>
  )
}

function ProviderSection({ label, providers, title, jwLink, myPlatforms = [], isStream = false }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide w-8 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {providers.map(p => (
          <ProviderLogo key={p.provider_id} provider={p} title={title} link={getProviderLink(p, title, jwLink)}
            owned={isStream && myPlatforms.includes(p.provider_id)}
            hasOwnership={isStream && myPlatforms.length > 0} />
        ))}
      </div>
    </div>
  )
}

function ProviderLogo({ provider, title, link, owned, hasOwnership }) {
  const img = provider.logo_path ? (
    <img src={provider.logo_path} alt={provider.provider_name} title={provider.provider_name}
      className="w-7 h-7 rounded-lg object-cover shadow"
      style={{ opacity: hasOwnership ? (owned ? 1 : 0.25) : 0.8 }} />
  ) : (
    <span className="text-[10px] text-white/60 px-1.5 py-1 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.15)' }}>
      {provider.provider_name}
    </span>
  )

  if (!link) return (
    <div className="relative">
      {img}
      {owned && <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border border-black/20 text-[7px] flex items-center justify-center text-white">✓</span>}
    </div>
  )

  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className="btn-press relative block">
      {img}
      {owned && <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border border-black/20 text-[7px] flex items-center justify-center text-white">✓</span>}
    </a>
  )
}
