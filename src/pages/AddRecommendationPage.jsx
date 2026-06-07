/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { InitialsAvatar } from '../components/Layout'
import { getProviderLink, getBookLinks, getAlbumLinks, getGameLinks } from '../lib/affiliates'
import { Chip, MEDIA, MEDIA_ORDER, PosterTile, ScreenHeader, SearchField, SheetShell } from '../lib/queuedDesign'

async function mediaCall(path) {
  const token = (await supabase.auth.getSession()).data.session?.access_token
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-media${path}`, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export default function AddRecommendationPage() {
  return (
    <div className="pb-5">
      <ScreenHeader title="Recommend" subtitle="Send a title to a friend" />
      <RecommendationComposer />
    </div>
  )
}

export function RecommendationSheet({ onClose, initialItem }) {
  return (
    <SheetShell onClose={onClose} title="Recommend" size="peek">
      <RecommendationComposer compact onDone={onClose} initialItem={initialItem} />
    </SheetShell>
  )
}

function RecommendationComposer({ compact = false, onDone, initialItem = null }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [searchType, setSearchType] = useState('multi')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [providers, setProviders] = useState(null)
  const [searching, setSearching] = useState(false)
  const [friends, setFriends] = useState([])
  const [selectedFriends, setSelectedFriends] = useState([])
  const [alreadySent, setAlreadySent] = useState({})
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef(null)

  async function fetchFriends() {
    const uid = session.user.id
    const { data } = await supabase
      .from('friendships')
      .select('*, user_a:users!friendships_user_a_id_fkey(*), user_b:users!friendships_user_b_id_fkey(*)')
      .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`)
      .eq('status', 'accepted')
    setFriends((data ?? []).map(f => ({ ...f, friend: f.user_a_id === uid ? f.user_b : f.user_a })).filter(f => f.friend?.username || f.friend?.display_name))
  }

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
      const json = await mediaCall(`?query=${encodeURIComponent(q)}&type=${type}`)
      setResults(json.results ?? [])
      setSearching(false)
    }, 400)
  }

  function changeSearchType(type) {
    setSearchType(type)
    setResults([])
    if (query.length >= 2) handleSearch(query, type)
  }

  async function selectTitle(item) {
    setSelected(item)
    setResults([])
    if (!['movie', 'tv'].includes(item.media_type)) {
      setProviders(null)
      return
    }
    const json = await mediaCall(`?action=providers&media_type=${item.media_type}&media_id=${item.media_id}`)
    setProviders(json.providers ?? null)
  }

  useEffect(() => {
    if (initialItem) selectTitle(initialItem)
  }, [initialItem])

  function toggleFriend(friendship) {
    setSelectedFriends(prev =>
      prev.find(s => s.friend.id === friendship.friend.id)
        ? prev.filter(s => s.friend.id !== friendship.friend.id)
        : [...prev, friendship]
    )
  }

  async function handleSubmit() {
    if (!selected || selectedFriends.length === 0) return
    setSubmitting(true)
    const uid = session.user.id
    const rows = selectedFriends.filter(f => !alreadySent[f.friend.id]).map(f => ({
      sender_id: uid,
      recipient_id: f.friend.id,
      media_type: selected.media_type,
      media_id: selected.media_id,
      media_title: selected.media_title,
      media_poster_url: selected.media_poster_url,
      note: note.trim() || null,
      media_creator: selected.media_creator ?? null,
      streaming_providers: providers ?? [],
    }))
    await supabase.from('recommendations').insert(rows)
    if (onDone) onDone()
    else navigate('/friends')
  }

  useEffect(() => { fetchFriends() }, [session])
  useEffect(() => {
    if (selected && selectedFriends.length > 0) checkDuplicates(selected.media_id, selectedFriends.map(f => f.friend.id))
  }, [selected, selectedFriends])

  const sendableCount = selectedFriends.filter(f => !alreadySent[f.friend.id]).length
  const selectedFriend = selectedFriends[0]?.friend
  const typeOptions = ['multi', ...MEDIA_ORDER]

  return (
    <div className={`space-y-5 ${compact ? '' : 'px-[18px]'}`}>
      <section className="space-y-3">
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          {typeOptions.map(type => (
            <Chip key={type} active={searchType === type} onClick={() => changeSearchType(type)}>
              {type === 'multi' ? 'All' : MEDIA[type].label}
            </Chip>
          ))}
        </div>
        <SearchField autoFocus={compact} value={query} onChange={handleSearch} placeholder="Search..." />
        {searching && <p className="text-center text-xs text-white/40">Searching...</p>}
        {results.length > 0 && !selected && (
          <div className="max-h-[220px] overflow-y-auto rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] shadow-[inset_3px_0_0_rgba(184,115,51,0.62)]">
            {results.map((r, i) => (
              <button key={r.media_id} onClick={() => selectTitle(r)} className={`btn-press flex w-full items-center gap-3 px-[13px] py-[11px] text-left ${i ? 'border-t border-[rgba(150,214,180,0.12)]' : ''}`}>
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
        {selected && (
          <div className="rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] p-3">
            <div className="flex items-center gap-3">
              <PosterTile item={selected} w={40} h={58} radius={10} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-[#F7F1E4]">{selected.media_title}</p>
                <p className="truncate text-xs text-[rgba(214,240,224,0.5)]">{selected.media_creator || selected.media_type}</p>
              </div>
              <button onClick={() => { setSelected(null); setQuery(''); setProviders(null) }} className="btn-press text-xl text-[rgba(214,240,224,0.5)]">x</button>
            </div>
            <div className="mt-2"><ProviderRows providers={providers} title={selected.media_title} creator={selected.media_creator} mediaType={selected.media_type} compact /></div>
          </div>
        )}
      </section>

      <section>
        <p className="font-mono-q mb-3 text-[10.5px] font-semibold uppercase tracking-[1.6px] text-[rgba(214,240,224,0.5)]">Friend</p>
        {friends.length === 0 ? <p className="text-sm text-white/40">No friends yet.</p> : (
          <div className="scrollbar-none flex gap-3 overflow-x-auto pb-1">
            {friends.map(f => {
              const active = !!selectedFriends.find(s => s.friend.id === f.friend.id)
              return (
                <button key={f.friend.id} onClick={() => toggleFriend(f)} className={`btn-press flex min-w-[74px] flex-col items-center gap-1.5 rounded-[16px] border px-3 py-3 ${active ? 'border-[#2DD48F]/60 bg-[#2DD48F]/15' : 'border-[rgba(150,214,180,0.16)] bg-[rgba(9,46,32,0.66)]'}`}>
                  <InitialsAvatar name={f.friend.display_name || f.friend.username} size="sm" />
                  <span className="max-w-[58px] truncate text-xs font-bold text-[#F7F1E4]">{(f.friend.display_name || f.friend.username).split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 500))} rows={3} placeholder="Note (optional)"
        className="w-full resize-none rounded-[14px] border border-[rgba(150,214,180,0.16)] bg-[rgba(2,17,12,0.7)] px-3.5 py-3 text-sm text-[#F7F1E4] outline-none placeholder:text-[#F7F1E4]/35 focus:border-[#D8A84A]/80" />

      <button onClick={handleSubmit} disabled={submitting || !selected || sendableCount === 0}
        className="btn-press btn-cream w-full rounded-2xl py-4 text-sm font-bold disabled:opacity-40">
        {submitting ? 'Sending...' : selectedFriend && sendableCount === 1 ? `Send to ${selectedFriend.display_name?.split(' ')[0] || selectedFriend.username}` : sendableCount > 0 ? `Send to ${sendableCount} friends` : 'Select a title and friend'}
      </button>
    </div>
  )
}

export function ProviderRows({ providers, title, creator, mediaType, compact = false, myPlatforms = [] }) {
  if (mediaType === 'book') {
    const links = getBookLinks(title, creator)
    return <ProviderLinkGroup label="Buy" links={[['Bookshop.org', links.bookshop], ['Amazon Books', links.amazon]]} compact={compact} />
  }
  if (mediaType === 'album') {
    const links = getAlbumLinks(title, creator)
    return <ProviderLinkGroup label="Listen" links={[['Spotify', links.spotify], ['Apple Music', links.appleMusic]]} compact={compact} />
  }
  if (mediaType === 'game') {
    const links = getGameLinks(title)
    return <ProviderLinkGroup label="Play" links={[['Steam', links.steam], ['Xbox', links.xbox], ['PlayStation', links.playstation]]} compact={compact} />
  }
  if (!providers) return null
  if (Array.isArray(providers)) {
    if (!providers.length) return null
    return <div className="flex flex-wrap gap-1.5">{providers.map(p => <ProviderLogo key={p.provider_id} provider={p} owned={myPlatforms.includes(p.provider_id)} hasOwnership={myPlatforms.length > 0} />)}</div>
  }
  const { flatrate = [], rent = [], buy = [], link: jwLink } = providers
  const hasAny = flatrate.length || rent.length || buy.length
  if (!hasAny) return jwLink ? <a href={jwLink} target="_blank" rel="noopener noreferrer" className="text-xs text-[rgba(214,240,224,0.5)] underline">Find where to watch</a> : null
  return (
    <div className={`space-y-1.5 ${compact ? '' : 'mt-2'}`}>
      {flatrate.length > 0 && <ProviderSection label="Stream" providers={flatrate} title={title} jwLink={jwLink} myPlatforms={myPlatforms} isStream />}
      {rent.length > 0 && <ProviderSection label="Rent" providers={rent} title={title} jwLink={jwLink} />}
      {buy.length > 0 && <ProviderSection label="Buy" providers={buy} title={title} jwLink={jwLink} />}
    </div>
  )
}

function ProviderLinkGroup({ label, links }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono-q text-[10px] font-bold uppercase tracking-wide text-[rgba(214,240,224,0.45)]">{label}</span>
      {links.map(([name, href]) => <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="btn-press rounded-full border border-[rgba(150,214,180,0.16)] bg-[rgba(9,46,32,0.66)] px-2.5 py-1 text-[10px] font-bold text-[#F7F1E4]">{name}</a>)}
    </div>
  )
}

function ProviderSection({ label, providers, title, jwLink, myPlatforms = [], isStream = false }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono-q w-10 shrink-0 text-[10px] font-bold uppercase tracking-wide text-[rgba(214,240,224,0.45)]">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {providers.map(p => <ProviderLogo key={p.provider_id} provider={p} title={title} link={getProviderLink(p, title, jwLink)} owned={isStream && myPlatforms.includes(p.provider_id)} hasOwnership={isStream && myPlatforms.length > 0} />)}
      </div>
    </div>
  )
}

function ProviderLogo({ provider, link, owned, hasOwnership }) {
  const img = provider.logo_path
    ? <img src={provider.logo_path} alt={provider.provider_name} title={provider.provider_name} className="h-7 w-7 rounded-lg object-cover shadow" style={{ opacity: hasOwnership ? (owned ? 1 : 0.25) : 0.85 }} />
    : <span className="rounded-lg bg-white/10 px-1.5 py-1 text-[10px] text-white/60">{provider.provider_name}</span>
  const content = <>{img}{owned && <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#2DD48F] text-[7px] text-[#052016]">✓</span>}</>
  return link ? <a href={link} target="_blank" rel="noopener noreferrer" className="btn-press relative block">{content}</a> : <div className="relative">{content}</div>
}
