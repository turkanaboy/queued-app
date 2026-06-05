import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { InitialsAvatar } from '../components/Layout'
import { PLATFORMS, platformInitials } from '../lib/platforms'
import LogMediaSheet from '../components/LogMediaSheet'
import RatingModal from '../components/RatingModal'
import { IconStar, StatusDot, TypeGlyph } from '../components/DesignPrimitives'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'
const MEDIA_ORDER = ['movie', 'tv', 'book', 'album']
const MEDIA_LABELS = { movie: 'Movies', tv: 'TV', book: 'Books', album: 'Albums' }
const STATUS_OPTIONS = ['all', 'not_yet_viewed', 'queued', 'in_progress', 'skipped', 'bailed', 'finished']
const STATUS_ORDER = ['not_yet_viewed', 'queued', 'in_progress', 'skipped', 'bailed', 'finished']
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
const STATUS_DOT_COLORS = {
  not_yet_viewed: '#D8A84A',
  queued: '#C99A52',
  in_progress: '#C96B4B',
  skipped: '#7E8C84',
  bailed: '#B5544A',
  finished: '#2DD48F',
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
  const [originFilter, setOriginFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('movie')
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
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

  const mediumCounts = Object.fromEntries(MEDIA_ORDER.map(type => [
    type,
    allItems.filter(item => item.media_type === type).length,
  ]))
  const mediumItems = allItems.filter(item => item.media_type === typeFilter)
  const mediumFilteredItems = mediumItems.filter(item => {
    if (originFilter === 'mine' && item.origin_type !== 'self') return false
    if (originFilter === 'recommendations' && item.origin_type !== 'recommendation') return false
    if (originFilter === 'sent' && item.origin_type !== 'sent') return false
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    return true
  })
  const statusCounts = Object.fromEntries(STATUS_ORDER.map(status => [
    status,
    mediumItems.filter(item => item.status === status).length,
  ]))
  const activeCount = mediumItems.filter(item => !['finished', 'skipped', 'bailed'].includes(item.status)).length
  const finishedItems = mediumItems.filter(item => item.status === 'finished')
  const finishedRatings = finishedItems.map(item => item.rating).filter(Boolean)
  const mediumAvg = finishedRatings.length
    ? (finishedRatings.reduce((sum, rating) => sum + Number(rating), 0) / finishedRatings.length).toFixed(1)
    : null
  const fromFriendsCount = mediumItems.filter(item => item.origin_type === 'recommendation').length
  const totalStatusCount = STATUS_ORDER.reduce((sum, status) => sum + statusCounts[status], 0)
  const visibleItems = mediumFilteredItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const activeBotRecommendation = recommendationQueue.find(rec =>
    rec.sender_id === BOT_USER_ID && ACTIVE_BOT_STATUSES.includes(rec.recipient_status)
  )

  return (
    <div className="space-y-5 pb-4">
      <header className="anim-scale flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.28em] text-[#B87333]">Queued</p>
          <h1 className="mt-0.5 text-[26px] font-extrabold leading-tight text-[#F7F1E4]">{isOwnProfile ? 'My Queue' : 'Media list'}</h1>
          <p className="mt-1 font-mono text-[11px] text-[#D6F0E0]/50">@{profile.username}{stats ? ` · ${stats.friends} friends` : ''}</p>
        </div>
        <button
          type="button"
          onClick={() => isOwnProfile && setEditing(true)}
          className="text-left"
          aria-label={isOwnProfile ? 'Edit profile' : `${profile.display_name || profile.username} profile`}
        >
          <InitialsAvatar name={profile.display_name || profile.username} size="md" />
        </button>
      </header>

      {(editing || !isOwnProfile) && (
        <div className="anim-up q-panel rounded-[18px] p-3">
          {isOwnProfile && editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="input-glass flex-1 py-2 text-sm font-bold"
                placeholder="Display name"
              />
              <button onClick={saveProfile} disabled={saving} className="btn-press btn-cream rounded-xl px-3 py-2 text-xs font-bold">
                {saving ? '…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="btn-press rounded-xl px-2 py-2 text-xs font-bold text-[#D6F0E0]/55">Close</button>
              <button onClick={doSignOut} className="btn-press rounded-xl border border-[#C96B4B]/50 px-2 py-2 text-xs font-bold text-[#FFE5DC]/80">Sign out</button>
            </div>
          ) : (
            <button onClick={() => navigate(`/list/${targetId}`)} className="btn-press btn-cream rounded-full px-4 py-2 text-xs font-bold">
              View shared list
            </button>
          )}
        </div>
      )}

      <div className="anim-up q-tab-bar rounded-[18px] p-[3px]">
        <div className="grid grid-cols-4 gap-1">
          {MEDIA_ORDER.map(type => {
            const active = typeFilter === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => { setTypeFilter(type); setStatusFilter('all'); setShowBreakdown(false) }}
                className={`btn-press rounded-[15px] border px-1.5 py-2 transition-all ${active ? 'border-[#D8A84A] bg-[#F4E9D1] text-[#052016]' : 'border-transparent text-[#F4E9D1]'}`}
              >
                <span className="flex items-center justify-center gap-1">
                  <TypeGlyph type={type} className="h-[15px] w-[15px]" />
                  <span className="text-[11px] font-bold">{MEDIA_LABELS[type]}</span>
                </span>
                <span className={`font-mono mt-0.5 block text-[9.5px] font-semibold ${active ? 'text-[#052016]/60' : 'text-[#D6F0E0]/50'}`}>
                  {mediumCounts[type]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <section className="anim-up q-hero overflow-hidden rounded-[22px]">
        <button type="button" onClick={() => setShowBreakdown(value => !value)} className="w-full p-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="relative flex items-baseline gap-2">
                <span className="absolute -left-2 -top-3 h-16 w-16 rounded-full bg-[radial-gradient(circle,rgba(45,212,143,0.32),transparent_68%)] blur-[4px]" />
                <span className="font-mono relative text-4xl font-semibold leading-none text-[#F7F1E4]">{activeCount}</span>
                <span className="relative text-[13px] font-semibold text-[#D6F0E0]/70">in your {MEDIA_LABELS[typeFilter].toLowerCase()} queue</span>
              </div>
              <div className="mt-3 flex gap-4">
                <MiniStat label="Finished" value={finishedItems.length} tone="#2DD48F" />
                <MiniStat label="Avg" value={mediumAvg ? `★${mediumAvg}` : '—'} tone="#D8A84A" />
                <MiniStat label="From friends" value={fromFriendsCount} tone="#D8A84A" />
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#D8A84A]">
              {showBreakdown ? 'Less' : 'Breakdown'}
              <svg className={`transition-transform ${showBreakdown ? 'rotate-180' : ''}`} width="11" height="8" viewBox="0 0 11 8" fill="none"><path d="M1.5 2l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </div>

          <div className="mt-4 flex h-2 gap-[3px] rounded-md bg-[#BEECD2]/[0.13] p-[2px]">
            {totalStatusCount > 0 ? STATUS_ORDER.map(status => (
              statusCounts[status] > 0 && (
                <span
                  key={status}
                  className={`rounded-[3px] transition-opacity ${statusFilter === 'all' || statusFilter === status ? 'opacity-100' : 'opacity-25'}`}
                  style={{ flex: statusCounts[status], background: STATUS_DOT_COLORS[status] }}
                />
              )
            )) : <span className="flex-1 rounded-[3px] bg-[#96D6B4]/20" />}
          </div>
        </button>

        <div className="overflow-hidden transition-[max-height] duration-300" style={{ maxHeight: showBreakdown ? 390 : 0 }}>
          <div className="border-t border-[#96D6B4]/16 p-3">
            {STATUS_ORDER.map(status => {
              const count = statusCounts[status]
              const active = statusFilter === status
              const pct = totalStatusCount ? Math.max(7, Math.round((count / totalStatusCount) * 100)) : 0
              return (
                <button
                  key={status}
                  type="button"
                  disabled={!count}
                  onClick={() => setStatusFilter(active ? 'all' : status)}
                  className={`btn-press mb-1 flex w-full items-center gap-2 rounded-[11px] px-2.5 py-2 text-left transition-all disabled:pointer-events-none disabled:opacity-30 ${active ? 'bg-[#2DD48F]/12 shadow-[inset_2px_0_0_rgba(45,212,143,0.7)]' : ''}`}
                >
                  <StatusDot status={status} />
                  <span className="flex-1 text-[13.5px] font-semibold text-[#F7F1E4]">{STATUS_LABELS[status]}</span>
                  <span className="h-[5px] w-20 overflow-hidden rounded-full bg-[#BEECD2]/[0.13]">
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: STATUS_DOT_COLORS[status] }} />
                  </span>
                  <span className="font-mono w-5 text-right text-[13px] font-semibold text-[#D8A84A]">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {isOwnProfile && (
        <BotStrip
          activeBotRecommendation={activeBotRecommendation}
          botLoading={botLoading}
          botMessage={botMessage}
          onAsk={requestBotRecommendation}
        />
      )}

      <section className="anim-up">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] text-[#D6F0E0]/50">
              {visibleItems.length} titles{statusFilter !== 'all' ? ` · ${STATUS_LABELS[statusFilter]}` : ''}
            </p>
            <p className="mt-0.5 text-xs text-[#D6F0E0]/35">{isOwnProfile ? 'Everything to watch, read, or listen to.' : 'Logged media from this profile.'}</p>
          </div>
          {isOwnProfile && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(value => !value)}
                className="btn-press rounded-full border border-[#96D6B4]/20 bg-[#0A3424]/70 px-3 py-2 text-xs font-bold text-[#F7F1E4]"
              >
                Status
              </button>
              <button
                onClick={() => setShowLogSheet(true)}
                className="btn-press btn-copper flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold"
                aria-label="Add to queue"
              >
                +
              </button>
            </div>
          )}
        </div>

        {showFilters && isOwnProfile && (
          <div className="mb-3 space-y-2">
            <FilterRow
              options={[
                { value: 'all', label: 'All sources' },
                { value: 'mine', label: 'Mine' },
                { value: 'recommendations', label: 'Received' },
                { value: 'sent', label: 'Sent' },
              ]}
              value={originFilter}
              onChange={setOriginFilter}
            />
          </div>
        )}

        {visibleItems.length === 0 ? (
          <div className="q-panel-spine rounded-[22px] p-6 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[#D8A84A]/30 bg-[#082E20]/80"><TypeGlyph type={typeFilter} className="h-6 w-6 text-[#D8A84A]" /></div>
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
            {visibleItems.map(item => (
              <div key={`${item.item_kind}-${item.id}`} className="q-panel-spine flex gap-3 rounded-[18px] p-3">
                <button
                  className="relative shrink-0 rounded-xl overflow-hidden shadow-lg"
                  onClick={() => isOwnProfile && item.item_kind !== 'sent' && setEditingLogItem(item)}
                >
                  {item.media_poster_url
                    ? <img src={item.media_poster_url} className="w-14 h-20 object-cover" alt={item.media_title} />
                    : <div className="w-14 h-20 flex items-center justify-center text-2xl"
                        style={{ background: 'rgba(255,255,255,0.15)' }}><TypeGlyph type={item.media_type} className="h-5 w-5 text-[#D8A84A]" /></div>
                  }
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[#F7F1E4] text-sm font-extrabold truncate">{item.media_title}</p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs capitalize text-[#F4E9D1]/50">
                        <TypeGlyph type={item.media_type} className="h-3.5 w-3.5 shrink-0 text-[#D8A84A]" />
                        <span className="truncate">{MEDIA_LABELS[item.media_type] ?? item.media_type}{item.media_creator ? ` · ${item.media_creator}` : ''}</span>
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] px-2 py-1 rounded-full font-bold ${STATUS_COLORS[item.status] ?? 'bg-white/10 text-white/50'}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>

                  <p className="text-[#F4E9D1]/45 text-xs mt-1.5 truncate">{item.origin}</p>

                  {item.rating && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <IconStar className="h-3 w-3 text-[#D8A84A]" />
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
                        style={{ background: 'rgba(255,255,255,0.15)' }}><TypeGlyph type={r.media_type} className="h-8 w-8 text-[#D8A84A]" /></div>
                  }
                  {r.rating && (
                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
                      <div className="flex items-center gap-0.5">
                        <IconStar className="h-3 w-3 text-[#D8A84A]" />
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

function MiniStat({ label, value, tone }) {
  return (
    <div>
      <p className="font-mono text-sm font-semibold leading-none" style={{ color: tone }}>{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#D6F0E0]/45">{label}</p>
    </div>
  )
}

function BotStrip({ activeBotRecommendation, botLoading, botMessage, onAsk }) {
  if (botLoading) {
    return (
      <div className="anim-up flex items-center gap-3 rounded-2xl border border-[#2DD48F]/25 bg-[#0C3E2C]/70 px-4 py-3 text-[#D6F0E0]/70">
        <svg className="h-5 w-5 animate-spin text-[#2DD48F]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="18 12" strokeLinecap="round" /></svg>
        <span className="text-[13.5px] font-semibold">Queued Bot is thinking…</span>
      </div>
    )
  }

  if (activeBotRecommendation) {
    return (
      <div className="anim-up flex items-center gap-3 rounded-2xl border border-[#D8A84A]/25 bg-[#0A3424]/70 px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-[#D8A84A] shadow-[0_0_14px_rgba(216,168,74,0.65)]" />
        <p className="min-w-0 flex-1 text-[12.5px] font-semibold text-[#D6F0E0]/72">
          Bot is waiting on <span className="text-[#F7F1E4]">{activeBotRecommendation.media_title}</span> — mark it done for a new pick.
        </p>
      </div>
    )
  }

  if (botMessage) {
    return (
      <button type="button" onClick={onAsk} className="anim-up btn-press flex w-full items-center gap-3 rounded-2xl border border-[#2DD48F]/25 bg-[#0C3E2C]/70 px-4 py-3 text-left shadow-[inset_2px_0_0_rgba(45,212,143,0.5)]">
        <span className="font-mono rounded-full bg-[#2DD48F]/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2DD48F]">Bot</span>
        <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#D6F0E0]/75">{botMessage}</span>
        <span className="text-[#D8A84A]">›</span>
      </button>
    )
  }

  return (
    <button type="button" onClick={onAsk} className="anim-up btn-press flex w-full items-center gap-3 rounded-2xl border border-dashed border-[#2DD48F]/35 bg-[#092E20]/55 px-4 py-3 text-left">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2DD48F]/12 text-[#2DD48F]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.4 4.1L17.5 9 13.4 10.9 12 15l-1.4-4.1L6.5 9l4.1-1.9L12 3ZM18.5 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span className="flex-1 text-[13.5px] font-bold text-[#F7F1E4]">Ask Queued Bot for a pick</span>
      <span className="text-[#D8A84A]">›</span>
    </button>
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
