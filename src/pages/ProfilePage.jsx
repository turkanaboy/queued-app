import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { InitialsAvatar } from '../components/Layout'
import { PLATFORMS, platformInitials } from '../lib/platforms'
import LogMediaSheet from '../components/LogMediaSheet'
import RatingModal from '../components/RatingModal'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'
const TYPE_ICON = { movie: '🎬', tv: '📺', book: '📚', album: '🎵' }
const STATUS_OPTIONS = ['all', 'not_yet_viewed', 'queued', 'in_progress', 'skipped', 'bailed', 'finished']
const ACTIVE_BOT_STATUSES = ['not_yet_viewed', 'queued', 'in_progress']
const STATUS_LABELS = {
  all: 'All',
  not_yet_viewed: 'New',
  queued: 'Queued',
  in_progress: 'In progress',
  skipped: 'Skipped',
  bailed: 'Bailed',
  finished: 'Finished',
}
const STATUS_ICONS = {
  not_yet_viewed: '✨',
  queued: '📌',
  in_progress: '▶️',
  skipped: '↷',
  bailed: '⏹',
  finished: '✅',
}
const STATUS_COLORS = {
  not_yet_viewed: 'bg-[#F4E9D1] text-[#052016]',
  queued: 'bg-[#D8A84A]/25 text-[#F4E9D1] border border-[#D8A84A]/45',
  in_progress: 'bg-[#B87333]/35 text-[#FFF8E8] border border-[#B87333]/45',
  skipped: 'bg-[#052016]/60 text-[#F4E9D1]/60 border border-[#F4E9D1]/20',
  bailed: 'bg-[#C96B4B]/35 text-[#FFE5DC] border border-[#C96B4B]/45',
  finished: 'bg-[#2DD48F]/22 text-[#D7FBE8] border border-[#2DD48F]/38',
}

export default function ProfilePage() {
  const { userId } = useParams()
  const { session, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const targetId = userId || session.user.id
  const isOwnProfile = targetId === session.user.id

  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [mediaLog, setMediaLog] = useState([])
  const [recommendationQueue, setRecommendationQueue] = useState([])
  const [sentRecommendations, setSentRecommendations] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [showLogSheet, setShowLogSheet] = useState(false)
  const [editingLogItem, setEditingLogItem] = useState(null)

  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [editingPlatforms, setEditingPlatforms] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [saving, setSaving] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [originFilter, setOriginFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [botLoading, setBotLoading] = useState(false)
  const [botMessage, setBotMessage] = useState('')

  useEffect(() => {
    fetchProfile()
    fetchStats()
    fetchMediaLog()
    fetchRecommendationQueue()
    fetchSentRecommendations()
    fetchActivity()
  }, [targetId])

  async function fetchProfile() {
    const { data } = await supabase.from('users').select('*').eq('id', targetId).single()
    setProfile(data)
    setDisplayName(data?.display_name || '')
    setSelectedPlatforms(data?.platforms ?? [])
    setLoading(false)
  }

  async function fetchStats() {
    const [sent, received, finished, logged, friends] = await Promise.all([
      supabase.from('recommendations').select('*', { count: 'exact', head: true }).eq('sender_id', targetId).is('deleted_at', null),
      supabase.from('recommendations').select('*', { count: 'exact', head: true }).eq('recipient_id', targetId).is('deleted_at', null),
      supabase.from('recommendations').select('rating').eq('recipient_id', targetId).eq('recipient_status', 'finished').is('deleted_at', null),
      supabase.from('user_media_log').select('*', { count: 'exact', head: true }).eq('user_id', targetId),
      supabase.from('friendships').select('*', { count: 'exact', head: true }).or(`user_a_id.eq.${targetId},user_b_id.eq.${targetId}`).eq('status', 'accepted'),
    ])
    const ratings = (finished.data ?? []).map(r => r.rating).filter(Boolean)
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null
    setStats({
      sent: sent.count ?? 0,
      received: received.count ?? 0,
      finished: finished.data?.length ?? 0,
      avgRating,
      logged: logged.count ?? 0,
      friends: friends.count ?? 0,
    })
  }

  async function fetchMediaLog() {
    const { data } = await supabase
      .from('user_media_log')
      .select('*, source_user:source_user_id(username, display_name)')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })
      .limit(30)
    setMediaLog(data ?? [])
  }

  async function fetchRecommendationQueue() {
    const { data } = await supabase
      .from('recommendations')
      .select('*, sender:users!recommendations_sender_id_fkey(id,username,display_name)')
      .eq('recipient_id', targetId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setRecommendationQueue(data ?? [])
  }

  async function fetchSentRecommendations() {
    const { data } = await supabase
      .from('recommendations')
      .select('*, recipient:users!recommendations_recipient_id_fkey(id,username,display_name)')
      .eq('sender_id', targetId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setSentRecommendations(data ?? [])
  }

  async function fetchActivity() {
    const { data } = await supabase
      .from('recommendations')
      .select('id, media_title, media_poster_url, media_type, rating, created_at')
      .eq('recipient_id', targetId)
      .eq('recipient_status', 'finished')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20)
    setActivity(data ?? [])
  }

  async function deleteLogEntry(id) {
    await supabase.from('user_media_log').delete().eq('id', id)
    fetchMediaLog()
    fetchStats()
  }

  async function updateLogStatus(item, status) {
    await supabase.from('user_media_log').update({
      status,
      rating: status === 'finished' ? item.rating : item.rating,
    }).eq('id', item.id)
    fetchMediaLog()
    fetchStats()
  }

  async function updateRecommendationStatus(item, status) {
    await supabase.from('recommendations').update({ recipient_status: status }).eq('id', item.recommendation_id)
    if (status !== 'not_yet_viewed') {
      await supabase.from('user_media_log').upsert({
        user_id:          session.user.id,
        media_type:       item.media_type,
        media_id:         item.media_id,
        media_title:      item.media_title,
        media_creator:    item.media_creator ?? null,
        media_poster_url: item.media_poster_url,
        rating:           item.rating ?? null,
        status,
        source_type:      'recommendation',
        source_user_id:   item.origin_user_id,
      }, { onConflict: 'user_id,media_id' })
    }
    fetchRecommendationQueue()
    fetchMediaLog()
    fetchStats()
  }

  async function requestBotRecommendation() {
    setBotLoading(true)
    setBotMessage('')
    const token = (await supabase.auth.getSession()).data.session?.access_token
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-recommendations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: session.user.id }),
      }
    )
    const json = await res.json()

    if (json.active) {
      setBotMessage(`${json.recommendation?.media_title ?? 'Your current bot pick'} is still active.`)
    } else if (json.sent) {
      setBotMessage(`Queued Bot added ${json.recommendation?.media_title ?? 'a new pick'}.`)
      setOriginFilter('recommendations')
      setStatusFilter('all')
    } else if (json.exhausted) {
      setBotMessage('Queued Bot could not find a fresh pick yet.')
    } else {
      setBotMessage('Queued Bot checked in.')
    }

    await fetchRecommendationQueue()
    await fetchSentRecommendations()
    await fetchMediaLog()
    await fetchStats()
    setBotLoading(false)
  }

  async function saveProfile() {
    setSaving(true)
    await supabase.from('users').update({ display_name: displayName }).eq('id', session.user.id)
    await refreshProfile()
    setEditing(false)
    fetchProfile()
    setSaving(false)
  }

  async function savePlatforms() {
    setSaving(true)
    await supabase.from('users').update({ platforms: selectedPlatforms }).eq('id', session.user.id)
    await refreshProfile()
    setEditingPlatforms(false)
    fetchProfile()
    setSaving(false)
  }

  function togglePlatform(id) {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  async function doSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) return <div className="flex items-center justify-center pt-20"><p className="text-white/40">Loading…</p></div>
  if (!profile) return <div className="flex items-center justify-center pt-20"><p className="text-white/40">User not found.</p></div>

  const logByMediaId = new Map(mediaLog.map(item => [item.media_id, item]))
  const allItems = [
    ...recommendationQueue.map(rec => {
      const logEntry = logByMediaId.get(rec.media_id)
      return {
        id: logEntry?.id ?? `rec-${rec.id}`,
        recommendation_id: rec.id,
        item_kind: 'recommendation',
        media_type: rec.media_type,
        media_id: rec.media_id,
        media_title: rec.media_title,
        media_creator: rec.media_creator,
        media_poster_url: rec.media_poster_url,
        rating: rec.rating ?? logEntry?.rating ?? null,
        review: logEntry?.review ?? null,
        status: rec.recipient_status,
        created_at: rec.created_at,
        origin: rec.sender_id === BOT_USER_ID ? 'Recommended by Queued Bot' : `Recommended by ${rec.sender?.display_name || rec.sender?.username || 'friend'}`,
        origin_type: 'recommendation',
        origin_user_id: rec.sender_id,
        origin_user: rec.sender,
        source_type: 'recommendation',
        source_user_id: rec.sender_id,
      }
    }),
    ...sentRecommendations.map(rec => ({
      id: `sent-${rec.id}`,
      recommendation_id: rec.id,
      item_kind: 'sent',
      media_type: rec.media_type,
      media_id: rec.media_id,
      media_title: rec.media_title,
      media_creator: rec.media_creator,
      media_poster_url: rec.media_poster_url,
      rating: rec.rating ?? null,
      review: null,
      status: rec.recipient_status,
      created_at: rec.created_at,
      origin: `Sent to ${rec.recipient?.display_name || rec.recipient?.username || 'friend'}`,
      origin_type: 'sent',
      origin_user_id: rec.recipient_id,
      origin_user: rec.recipient,
      source_type: 'sent',
      source_user_id: rec.recipient_id,
    })),
    ...mediaLog
      .filter(item => !recommendationQueue.some(rec => rec.media_id === item.media_id))
      .map(item => ({
        ...item,
        item_kind: 'log',
        status: item.status ?? (item.rating ? 'finished' : 'queued'),
        origin: item.source_type === 'recommendation' && item.source_user
          ? `Recommended by ${item.source_user.display_name || item.source_user.username}`
          : 'Added by you',
        origin_type: item.source_type === 'recommendation' ? 'recommendation' : 'self',
        origin_user_id: item.source_user_id,
      })),
  ]

  const displayStats = stats ? {
    ...stats,
    finished: allItems.filter(item => item.status === 'finished').length,
  } : null
  const statusStats = STATUS_OPTIONS
    .filter(status => status !== 'all')
    .map(status => ({
      status,
      label: STATUS_LABELS[status],
      value: allItems.filter(item => item.status === status).length,
      emoji: STATUS_ICONS[status],
    }))

  const personalItems = allItems.filter(item => {
    if (originFilter === 'mine' && item.origin_type !== 'self') return false
    if (originFilter === 'recommendations' && item.origin_type !== 'recommendation') return false
    if (originFilter === 'sent' && item.origin_type !== 'sent') return false
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (typeFilter !== 'all' && item.media_type !== typeFilter) return false
    return true
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  function applyStatFilter({ origin = 'all', status = 'all', type = 'all', route } = {}) {
    if (route) {
      navigate(route)
      return
    }
    setOriginFilter(origin)
    setStatusFilter(status)
    setTypeFilter(type)
  }

  const activeBotRecommendation = recommendationQueue.find(rec =>
    rec.sender_id === BOT_USER_ID && ACTIVE_BOT_STATUSES.includes(rec.recipient_status)
  )

  return (
    <div className="space-y-6 pb-4">
      {/* Profile hero */}
      <div className="anim-scale overflow-hidden rounded-[30px] border border-[#F4E9D1]/18 bg-[#062318]/70 text-center shadow-2xl">
        <div className="bg-[#F4E9D1] px-5 py-3 text-left">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#B87333]">Queued</p>
          <p className="text-xl font-black text-[#052016] leading-tight">{isOwnProfile ? 'My Queue' : 'Media list'}</p>
        </div>
        <div className="px-5 py-5">
        <div className="flex justify-center mb-4">
          <InitialsAvatar name={profile.display_name || profile.username} size="xl" />
        </div>

        {isOwnProfile && editing ? (
          <div className="flex items-center justify-center gap-2 mb-2">
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="input-glass text-center text-lg font-bold py-2 max-w-[200px]"
            />
            <button onClick={saveProfile} disabled={saving}
              className="btn-press btn-cream text-xs font-bold px-3 py-2 rounded-xl">
              {saving ? '…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="btn-press text-xs text-white/50 p-2">✕</button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-[#F7F1E4]">{profile.display_name || profile.username}</h1>
            <p className="text-[#F4E9D1]/55 text-sm mt-0.5">@{profile.username}</p>
          </>
        )}

        <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
          {isOwnProfile && !editing && (
            <button onClick={() => setEditing(true)}
              className="btn-press btn-outline-cream text-xs font-bold px-4 py-1.5 rounded-full">
              Edit profile
            </button>
          )}
          {!isOwnProfile && (
            <button onClick={() => navigate(`/list/${targetId}`)}
              className="btn-press btn-cream text-xs font-bold px-4 py-1.5 rounded-full">
              View list
            </button>
          )}
          {isOwnProfile && (
            confirmSignOut ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#F4E9D1]/55">Sign out?</span>
                <button onClick={doSignOut}
                  className="btn-press text-xs font-bold px-3 py-1.5 rounded-full text-[#FFF8E8] bg-[#C96B4B]/70 border border-[#C96B4B]">
                  Yes
                </button>
                <button onClick={() => setConfirmSignOut(false)}
                  className="btn-press btn-outline-cream text-xs font-semibold px-3 py-1.5 rounded-full">
                  No
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmSignOut(true)}
                className="btn-press text-xs font-bold px-4 py-1.5 rounded-full border border-[#F4E9D1]/20 text-[#F4E9D1]/45">
                Sign out
              </button>
            )
          )}
        </div>
        </div>
      </div>

      {/* Stats */}
      {displayStats && (
        <div className="space-y-3 anim-up">
          <div className="grid grid-cols-3 gap-3">
            <StatCard emoji="📝" label="Logged" value={displayStats.logged} active={originFilter === 'all' && statusFilter === 'all' && typeFilter === 'all'} onClick={() => applyStatFilter()} />
            <StatCard emoji="✅" label="Finished" value={displayStats.finished} active={statusFilter === 'finished'} onClick={() => applyStatFilter({ status: 'finished' })} />
            <StatCard emoji="⭐" label="Avg rating" value={displayStats.avgRating ?? '—'} active={statusFilter === 'finished'} onClick={() => applyStatFilter({ status: 'finished' })} />
            <StatCard emoji="📤" label="Sent" value={displayStats.sent} active={originFilter === 'sent'} onClick={() => applyStatFilter({ origin: 'sent' })} />
            <StatCard emoji="📥" label="Received" value={displayStats.received} active={originFilter === 'recommendations'} onClick={() => applyStatFilter({ origin: 'recommendations' })} />
            <StatCard emoji="👥" label="Friends" value={displayStats.friends} onClick={() => applyStatFilter({ route: '/friends' })} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {statusStats.map(item => (
              <StatCard
                key={item.status}
                emoji={item.emoji}
                label={item.label}
                value={item.value}
                active={statusFilter === item.status}
                compact
                onClick={() => applyStatFilter({ status: item.status })}
              />
            ))}
          </div>
        </div>
      )}
      {/* Personal task list */}
      <section className="anim-up">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/50 text-xs font-bold uppercase tracking-widest">
              {isOwnProfile ? 'My Queue' : 'Media list'}
            </p>
            {isOwnProfile && (
              <p className="text-white/35 text-xs mt-1">Everything to watch, read, or listen to.</p>
            )}
          </div>
          {isOwnProfile && (
            <div className="flex items-center gap-2">
              <button
                onClick={requestBotRecommendation}
                disabled={botLoading}
                className={`btn-press text-xs font-bold px-3 py-2 rounded-full disabled:opacity-40 ${activeBotRecommendation ? 'btn-outline-cream' : 'btn-cream'}`}
              >
                {botLoading ? 'Thinking...' : activeBotRecommendation ? 'Bot waiting' : 'Ask Bot'}
              </button>
              <button
                onClick={() => setShowLogSheet(true)}
                className="btn-press btn-copper w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg"
              >
                +
              </button>
            </div>
          )}
        </div>

        {isOwnProfile && botMessage && (
          <p className="text-white/45 text-xs mb-3">{botMessage}</p>
        )}

        {isOwnProfile && (
          <div className="space-y-2 mb-3">
            <FilterRow
              options={[
                { value: 'all', label: 'All' },
                { value: 'mine', label: 'Mine' },
                { value: 'recommendations', label: 'Received' },
                { value: 'sent', label: 'Sent' },
              ]}
              value={originFilter}
              onChange={setOriginFilter}
            />
            <FilterRow
              options={[
                { value: 'all', label: 'All media' },
                { value: 'movie', label: 'Movies' },
                { value: 'tv', label: 'TV' },
                { value: 'book', label: 'Books' },
                { value: 'album', label: 'Albums' },
              ]}
              value={typeFilter}
              onChange={setTypeFilter}
            />
          </div>
        )}

        {personalItems.length === 0 ? (
          <div className="queue-strip rounded-[24px] p-6 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-white/40 text-sm">
              {isOwnProfile ? 'Nothing matches these filters yet.' : 'Nothing logged yet'}
            </p>
            {isOwnProfile && (
              <button onClick={() => setShowLogSheet(true)}
                className="btn-press btn-cream mt-3 text-xs font-bold px-4 py-2 rounded-full">
                + Add something
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {personalItems.map(item => (
              <div key={`${item.item_kind}-${item.id}`} className="queue-strip rounded-[22px] p-3 flex gap-3">
                <button
                  className="relative shrink-0 rounded-xl overflow-hidden shadow-lg"
                  onClick={() => isOwnProfile && item.item_kind !== 'sent' && setEditingLogItem(item)}
                >
                  {item.media_poster_url
                    ? <img src={item.media_poster_url} className="w-14 h-20 object-cover" alt={item.media_title} />
                    : <div className="w-14 h-20 flex items-center justify-center text-2xl"
                        style={{ background: 'rgba(255,255,255,0.15)' }}>{TYPE_ICON[item.media_type] ?? '🎬'}</div>
                  }
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[#F7F1E4] text-sm font-extrabold truncate">{item.media_title}</p>
                      <p className="text-[#F4E9D1]/50 text-xs capitalize mt-0.5 truncate">
                        {TYPE_ICON[item.media_type] ?? '🎬'} {item.media_type}
                        {item.media_creator ? ` · ${item.media_creator}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] px-2 py-1 rounded-full font-bold ${STATUS_COLORS[item.status] ?? 'bg-white/10 text-white/50'}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>

                  <p className="text-[#F4E9D1]/45 text-xs mt-1.5 truncate">{item.origin}</p>

                  {item.rating && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className="text-amber-300 text-xs">★</span>
                      <span className="text-white/60 text-xs font-bold">{item.rating}</span>
                    </div>
                  )}

                  {isOwnProfile && item.item_kind !== 'sent' && (
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <StatusSelect
                        value={item.status}
                        onChange={status => item.item_kind === 'recommendation'
                          ? updateRecommendationStatus(item, status)
                          : updateLogStatus(item, status)}
                      />
                      {item.item_kind === 'log' && (
                        <button
                          onClick={() => deleteLogEntry(item.id)}
                          className="btn-press text-white/35 hover:text-rose-300 text-xs font-semibold px-2 py-1"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}

                  {isOwnProfile && item.item_kind === 'log' && item.rating && (
                    <button
                      onClick={() => setEditingLogItem(item)}
                      className="btn-press text-white/45 hover:text-white text-xs font-semibold mt-1"
                    >
                      Edit rating
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Streaming platforms */}
      <section className="anim-up">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Streaming platforms</p>
          {isOwnProfile && !editingPlatforms && (
            <button onClick={() => setEditingPlatforms(true)}
              className="btn-press text-xs text-white/50 hover:text-white">Edit</button>
          )}
        </div>

        {editingPlatforms ? (
          <div className="glass rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => {
                const active = selectedPlatforms.includes(p.id)
                return (
                  <button key={p.id} type="button" onClick={() => togglePlatform(p.id)}
                    className="btn-press text-xs font-bold px-3 py-1.5 rounded-full border transition-all"
                    style={{
                      background: active ? p.color : 'rgba(255,255,255,0.1)',
                      border: active ? `1px solid ${p.color}` : '1px solid rgba(255,255,255,0.2)',
                      color: active ? 'white' : 'rgba(255,255,255,0.6)',
                    }}>
                    {active && '✓ '}{platformInitials(p.name)}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={savePlatforms} disabled={saving}
                className="btn-press btn-cream text-xs font-bold px-4 py-2 rounded-xl">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditingPlatforms(false); setSelectedPlatforms(profile?.platforms ?? []) }}
                className="btn-press btn-outline-cream text-xs px-4 py-2 rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        ) : (profile?.platforms ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.platforms.map(id => {
              const p = PLATFORMS.find(pl => pl.id === id)
              if (!p) return null
              return (
                <span key={id} className="text-xs font-bold px-3 py-1.5 rounded-full text-white"
                  style={{ background: p.color }}>
                  {platformInitials(p.name)}
                </span>
              )
            })}
          </div>
        ) : (
          <div className="glass rounded-2xl px-4 py-3 text-center">
            <p className="text-white/30 text-sm">
              {isOwnProfile ? 'No platforms added — tap Edit to add them' : 'No platforms listed'}
            </p>
          </div>
        )}
      </section>

      {/* Finished from friends */}
      {activity.length > 0 && (
        <section className="anim-up">
          <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">
            Finished from friends
          </p>
          <div className="poster-scroll -mx-4 px-4">
            {activity.map(r => (
              <div key={r.id} className="shrink-0 w-32">
                <div className="relative rounded-2xl overflow-hidden shadow-lg">
                  {r.media_poster_url
                    ? <img src={r.media_poster_url} className="w-32 h-44 object-cover" alt={r.media_title} />
                    : <div className="w-32 h-44 flex items-center justify-center text-3xl"
                        style={{ background: 'rgba(255,255,255,0.15)' }}>🎬</div>
                  }
                  {r.rating && (
                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
                      <div className="flex items-center gap-0.5">
                        <span className="text-amber-300 text-xs">★</span>
                        <span className="text-white text-xs font-bold">{r.rating}</span>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-white/70 text-xs font-semibold mt-1.5 truncate">{r.media_title}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Log sheet */}
      {showLogSheet && (
        <LogMediaSheet
          userId={session.user.id}
          onClose={() => setShowLogSheet(false)}
          onSaved={() => { fetchMediaLog(); fetchStats() }}
        />
      )}

      {/* Edit log entry modal */}
      {editingLogItem && (
        <RatingModal
          item={editingLogItem}
          existingEntry={editingLogItem}
          onClose={() => setEditingLogItem(null)}
          onSaved={() => { fetchMediaLog(); fetchStats(); setEditingLogItem(null) }}
        />
      )}
    </div>
  )
}

function StatCard({ emoji, label, value, active = false, compact = false, onClick }) {
  const Component = onClick ? 'button' : 'div'
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`btn-press relative overflow-hidden rounded-[18px] border ${compact ? 'p-2.5' : 'p-3'} text-center transition-all ${
        active
          ? 'bg-[#F4E9D1] border-[#D8A84A] text-[#052016] shadow-[0_7px_0_rgba(184,115,51,0.32)]'
          : 'bg-[#0B2D20]/88 border-[#F4E9D1]/18 text-[#F7F1E4] hover:border-[#F4E9D1]/45'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      <span className="absolute right-0 top-0 h-5 w-5 rounded-bl-xl bg-[#B87333]/80" />
      <p className={`${compact ? 'text-base' : 'text-xl'} mb-0.5 relative`}>{emoji}</p>
      <p className={`${compact ? 'text-lg' : 'text-xl'} font-extrabold relative`}>{value}</p>
      <p className={`text-[10px] font-semibold mt-0.5 leading-tight relative ${active ? 'text-[#052016]/68' : 'text-[#F4E9D1]/54'}`}>{label}</p>
    </Component>
  )
}

function FilterRow({ options, value, onChange }) {
  return (
    <div className="paper-tabs flex gap-1 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none' }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`btn-press shrink-0 text-xs font-extrabold px-3 py-2 border transition-all ${
            value === o.value
              ? 'rounded-xl text-[#052016] border-[#D8A84A] border-t-4'
              : 'rounded-xl text-[#F4E9D1]/70 border-[#F4E9D1]/18 hover:border-[#F4E9D1]/42'
          }`}
          style={value === o.value ? { background: '#F4E9D1' } : { background: 'rgba(2,17,12,0.42)' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function StatusSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="btn-press btn-outline-cream text-xs font-bold rounded-full px-2 py-1.5 outline-none"
    >
      {STATUS_OPTIONS.filter(s => s !== 'all').map(s => (
        <option key={s} value={s} className="bg-[#062318] text-[#F4E9D1]">
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  )
}
