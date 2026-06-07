import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { invokeEdgeFunction } from '../lib/edgeFunctions'
import { InitialsAvatar } from '../components/Layout'
import { PLATFORMS, platformInitials } from '../lib/platforms'
import { TASTE_GENRE_GROUPS } from '../lib/taste'
import { displayRating } from '../lib/ratings'
import { upsertMediaLog } from '../lib/mediaLog'
import LogMediaSheet from '../components/LogMediaSheet'
import RatingModal from '../components/RatingModal'
import {
  ACTIVE_STATUSES,
  C,
  Chip,
  EmptyState,
  G,
  MEDIA,
  MEDIA_ORDER,
  MediumTabs,
  PosterTile,
  ScreenHeader,
  SectionTitle,
  STATUS,
  STATUS_ORDER,
  StatusMenu,
} from '../lib/queuedDesign'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'

function personalLogStatus(entry, fallback) {
  if (!entry) return fallback
  return entry.status ?? (entry.rating ? 'finished' : 'queued')
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
  const [editingTaste, setEditingTaste] = useState(false)
  const [selectedGenres, setSelectedGenres] = useState([])
  const [saving, setSaving] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [medium, setMedium] = useState('movie')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showStatusChips, setShowStatusChips] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [botLoading, setBotLoading] = useState(false)
  const [botResult, setBotResult] = useState(null)

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
    setSelectedGenres(data?.favorite_genres ?? [])
    setLoading(false)
  }

  async function fetchStats() {
    const logTable = isOwnProfile ? 'user_media_log' : 'friend_media_log'
    const finishedQuery = isOwnProfile
      ? supabase.from('recommendations').select('rating').eq('recipient_id', targetId).eq('recipient_status', 'finished').is('deleted_at', null)
      : supabase.from('friend_recommendation_activity').select('rating').eq('recipient_id', targetId)
    const [sent, received, finished, logged, friends] = await Promise.all([
      supabase.from('recommendations').select('*', { count: 'exact', head: true }).eq('sender_id', targetId).is('deleted_at', null),
      supabase.from('recommendations').select('*', { count: 'exact', head: true }).eq('recipient_id', targetId).is('deleted_at', null),
      finishedQuery,
      supabase.from(logTable).select('*', { count: 'exact', head: true }).eq('user_id', targetId),
      supabase.from('friendships').select('*', { count: 'exact', head: true }).or(`user_a_id.eq.${targetId},user_b_id.eq.${targetId}`).eq('status', 'accepted'),
    ])
    const ratings = (finished.data ?? []).map(r => r.rating).filter(Boolean)
    setStats({
      sent: sent.count ?? 0,
      received: received.count ?? 0,
      finished: finished.data?.length ?? 0,
      avgRating: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null,
      logged: logged.count ?? 0,
      friends: friends.count ?? 0,
    })
  }

  async function fetchMediaLog() {
    const query = isOwnProfile
      ? supabase
        .from('user_media_log')
        .select('*, source_user:source_user_id(username, display_name)')
      : supabase
        .from('friend_media_log')
        .select('*')

    const { data } = await query
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })
      .limit(60)
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
    const query = isOwnProfile
      ? supabase
        .from('recommendations')
        .select('id, media_title, media_poster_url, media_type, rating, created_at')
        .eq('recipient_status', 'finished')
        .is('deleted_at', null)
      : supabase
        .from('friend_recommendation_activity')
        .select('id, media_title, media_poster_url, media_type, rating, created_at')

    const { data } = await query
      .eq('recipient_id', targetId)
      .order('created_at', { ascending: false })
      .limit(20)
    setActivity(data ?? [])
  }

  async function updateLogStatus(item, status) {
    await supabase.from('user_media_log').update({ status, rating: status === 'finished' ? item.rating : item.rating }).eq('id', item.id)
    fetchMediaLog()
    fetchStats()
  }

  async function updateRecommendationStatus(item, status) {
    await supabase.from('recommendations').update({ recipient_status: status }).eq('id', item.recommendation_id)
    if (status !== 'not_yet_viewed') {
      await upsertMediaLog({
        user_id: session.user.id,
        media_type: item.media_type,
        media_id: item.media_id,
        media_title: item.media_title,
        media_creator: item.media_creator ?? null,
        media_poster_url: item.media_poster_url,
        rating: item.rating ?? null,
        status,
        source_type: 'recommendation',
        source_user_id: item.origin_user_id,
        streaming_providers: item.streaming_providers ?? [],
      })
    }
    fetchRecommendationQueue()
    fetchMediaLog()
    fetchStats()
  }

  async function deleteLogEntry(id) {
    await supabase.from('user_media_log').delete().eq('id', id)
    fetchMediaLog()
    fetchStats()
  }

  function handleLogSheetSaved(item) {
    if (item?.media_type) {
      setMedium(item.media_type)
      setStatusFilter('all')
    }
    fetchMediaLog()
    fetchStats()
  }

  async function requestBotRecommendation() {
    setBotLoading(true)
    setBotResult(null)
    try {
      const json = await invokeEdgeFunction('bot-recommendations', {
        method: 'POST',
        body: { user_id: session.user.id, force_new: true },
      })
      setBotResult(json)
      await Promise.all([fetchRecommendationQueue(), fetchSentRecommendations(), fetchMediaLog(), fetchStats()])
    } catch (err) {
      setBotResult({ error: err.message || 'Queued Bot could not make a pick.' })
    } finally {
      setBotLoading(false)
    }
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

  async function saveTaste() {
    setSaving(true)
    await supabase.from('users').update({ favorite_genres: selectedGenres }).eq('id', session.user.id)
    await refreshProfile()
    setEditingTaste(false)
    fetchProfile()
    setSaving(false)
  }

  async function doSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function togglePlatform(id) {
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  function toggleGenre(genre) {
    setSelectedGenres(prev => prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre])
  }

  const allItems = useMemo(() => {
    const mediaKey = item => `${item.media_type}:${item.media_id}`
    const logByMediaId = new Map(mediaLog.map(item => [mediaKey(item), item]))
    return [
      ...recommendationQueue.map(rec => {
        const logEntry = logByMediaId.get(mediaKey(rec))
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
          status: personalLogStatus(logEntry, rec.recipient_status),
          created_at: logEntry?.created_at ?? rec.created_at,
          origin: rec.sender_id === BOT_USER_ID ? 'Queued Bot' : (rec.sender?.display_name || rec.sender?.username || 'friend'),
          origin_type: rec.sender_id === BOT_USER_ID ? 'bot' : 'recommendation',
          origin_user_id: rec.sender_id,
          source_type: 'recommendation',
          source_user_id: rec.sender_id,
          streaming_providers: rec.streaming_providers ?? [],
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
        status: rec.recipient_status,
        created_at: rec.created_at,
        origin: `Sent to ${rec.recipient?.display_name || rec.recipient?.username || 'friend'}`,
        origin_type: 'sent',
        origin_user_id: rec.recipient_id,
      })),
      ...mediaLog
        .filter(item => !recommendationQueue.some(rec => mediaKey(rec) === mediaKey(item)))
        .map(item => ({
          ...item,
          item_kind: 'log',
          status: item.status ?? (item.rating ? 'finished' : 'queued'),
          origin: item.source_type === 'recommendation' && item.source_user
            ? (item.source_user.display_name || item.source_user.username)
            : 'Added by you',
          origin_type: item.source_type === 'recommendation' ? 'recommendation' : 'self',
          origin_user_id: item.source_user_id,
        })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [mediaLog, recommendationQueue, sentRecommendations])

  if (loading) return <div className="flex items-center justify-center pt-20 text-white/40">Loading...</div>
  if (!profile) return <div className="flex items-center justify-center pt-20 text-white/40">User not found.</div>

  const counts = Object.fromEntries(MEDIA_ORDER.map(type => [type, allItems.filter(item => item.media_type === type).length]))
  const mediumItems = allItems.filter(item => item.media_type === medium)
  const visibleItems = mediumItems.filter(item => statusFilter === 'all' || item.status === statusFilter)
  const statusCounts = Object.fromEntries(STATUS_ORDER.map(status => [status, mediumItems.filter(item => item.status === status).length]))
  const total = mediumItems.length
  const finished = statusCounts.finished || 0
  const mediumRatings = mediumItems.filter(item => item.status === 'finished' && item.rating).map(item => Number(item.rating))
  const avg = mediumRatings.length ? displayRating((mediumRatings.reduce((a, b) => a + b, 0) / mediumRatings.length).toFixed(1)) : (stats?.avgRating ? displayRating(stats.avgRating) : null)
  const fromFriends = mediumItems.filter(item => ['recommendation', 'bot'].includes(item.origin_type)).length
  const activeBotRecommendation = recommendationQueue.find(rec => rec.sender_id === BOT_USER_ID && ACTIVE_STATUSES.includes(rec.recipient_status))

  return (
    <div className="pb-5">
      <ScreenHeader
        title={isOwnProfile ? 'My Queue' : 'Media list'}
        subtitle={editing ? null : `@${profile.username}`}
        right={<InitialsAvatar name={profile.display_name || profile.username} size="md" />}
      />

      <div className="px-[18px] pb-3">
        {editing ? (
          <div className="flex gap-2">
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="input-glass py-2 text-sm font-bold" />
            <button onClick={saveProfile} disabled={saving} className="btn-press btn-cream rounded-xl px-3 text-xs font-bold">{saving ? '...' : 'Save'}</button>
            <button onClick={() => setEditing(false)} className="btn-press px-2 text-white/50">×</button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-extrabold text-[#F7F1E4]">{profile.display_name || profile.username}</p>
              <p className="font-mono-q text-[10.5px] text-[rgba(214,240,224,0.5)]">{stats?.friends ?? 0} friends · {stats?.logged ?? 0} logged</p>
            </div>
            {isOwnProfile && (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(true)} className="btn-press rounded-full border border-[rgba(150,214,180,0.16)] px-3 py-1.5 text-xs font-bold text-[rgba(214,240,224,0.7)]">Edit</button>
                {confirmSignOut ? (
                  <button onClick={doSignOut} className="btn-press rounded-full bg-[#C96B4B]/70 px-3 py-1.5 text-xs font-bold">Sign out</button>
                ) : (
                  <button onClick={() => setConfirmSignOut(true)} className="btn-press rounded-full px-3 py-1.5 text-xs font-bold text-[rgba(214,240,224,0.45)]">Sign out</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {isOwnProfile && (
        <div className="px-[18px] pb-4">
          <TasteSection
            editing={editingTaste}
            setEditing={setEditingTaste}
            selectedGenres={selectedGenres}
            toggleGenre={toggleGenre}
            save={saveTaste}
            saving={saving}
          />
        </div>
      )}

      <MediumTabs value={medium} counts={counts} onChange={next => { setMedium(next); setStatusFilter('all'); setShowBreakdown(false) }} />

      <div className="space-y-4 px-[18px] pt-4">
        <HeroStats
          medium={medium}
          total={total}
          finished={finished}
          avg={avg}
          fromFriends={fromFriends}
          statusCounts={statusCounts}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          expanded={showBreakdown}
          setExpanded={setShowBreakdown}
        />

        {isOwnProfile && (
          <BotStrip
            loading={botLoading}
            active={activeBotRecommendation}
            result={botResult}
            onAsk={requestBotRecommendation}
            onDismiss={() => setBotResult(null)}
            onStatusChange={status => {
              if (botResult?.recommendation) {
                const rec = recommendationQueue.find(r => r.id === botResult.recommendation.id)
                if (rec) updateRecommendationStatus({
                  recommendation_id: rec.id,
                  media_type: rec.media_type,
                  media_id: rec.media_id,
                  media_title: rec.media_title,
                  media_creator: rec.media_creator,
                  media_poster_url: rec.media_poster_url,
                  origin_user_id: rec.sender_id,
                  streaming_providers: rec.streaming_providers ?? [],
                }, status)
              }
            }}
          />
        )}

        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <p className="font-mono-q text-[11px] text-[rgba(214,240,224,0.5)]">
              {visibleItems.length} titles{statusFilter !== 'all' ? ` · ${STATUS[statusFilter].label}` : ''}
            </p>
            {isOwnProfile && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowStatusChips(v => !v)}
                  className={`btn-press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${showStatusChips || statusFilter !== 'all' ? 'border-[#D8A84A] bg-[#F4E9D1] text-[#052016]' : 'border-[rgba(150,214,180,0.16)] bg-[rgba(10,52,36,0.7)] text-[#F7F1E4]'}`}>
                  <FilterIcon /> Status
                </button>
                <button onClick={() => setShowLogSheet(true)} className="btn-press flex h-[35px] w-[35px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#C96B4B,#B87333)] text-lg font-bold text-[#FFF8E8] shadow-[0_4px_12px_rgba(0,0,0,0.3)]">+</button>
              </div>
            )}
          </div>
          <div className={`overflow-hidden transition-[max-height] duration-300 ${showStatusChips ? 'max-h-[72px]' : 'max-h-0'}`}>
            <div className="scrollbar-none flex gap-2 overflow-x-auto pb-3">
              <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</Chip>
              {STATUS_ORDER.map(status => <Chip key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>{STATUS[status].label}</Chip>)}
            </div>
          </div>
        </div>

        <div className="overflow-visible rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] shadow-[inset_3px_0_0_rgba(184,115,51,0.62)]">
          {visibleItems.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              body={isOwnProfile ? 'Add a title or clear the current status filter.' : 'No titles match this view.'}
              action={isOwnProfile && <button onClick={() => setShowLogSheet(true)} className="btn-press btn-cream rounded-full px-4 py-2 text-xs font-bold">Add title</button>}
            />
          ) : visibleItems.map((item, index) => (
            <QueueRow
              key={`${item.item_kind}-${item.id}`}
              item={item}
              own={isOwnProfile}
              first={index === 0}
              onOpen={() => isOwnProfile && item.item_kind !== 'sent' && setEditingLogItem(item)}
              onStatus={status => item.item_kind === 'recommendation' ? updateRecommendationStatus(item, status) : updateLogStatus(item, status)}
              onDelete={() => deleteLogEntry(item.id)}
            />
          ))}
        </div>

        <PlatformsSection
          isOwnProfile={isOwnProfile}
          profile={profile}
          editing={editingPlatforms}
          setEditing={setEditingPlatforms}
          selected={selectedPlatforms}
          toggle={togglePlatform}
          save={savePlatforms}
          saving={saving}
        />

        {activity.length > 0 && (
          <section>
            <SectionTitle>Finished from friends</SectionTitle>
            <div className="poster-scroll -mx-[18px] px-[18px]">
              {activity.map(item => (
                <div key={item.id} className="w-24 shrink-0">
                  <PosterTile item={item} w={96} h={138} radius={12}>
                    {item.rating && <div className="font-mono-q absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-[#D8A84A]">★ {displayRating(item.rating)}</div>}
                  </PosterTile>
                  <p className="mt-1.5 truncate text-xs font-bold text-[#F7F1E4]/75">{item.media_title}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {showLogSheet && <LogMediaSheet userId={session.user.id} onClose={() => setShowLogSheet(false)} onSaved={handleLogSheetSaved} />}
      {editingLogItem && <RatingModal item={editingLogItem} existingEntry={editingLogItem} onClose={() => setEditingLogItem(null)} onSaved={() => { fetchMediaLog(); fetchStats(); setEditingLogItem(null) }} />}
    </div>
  )
}

function HeroStats({ medium, total, finished, avg, fromFriends, statusCounts, statusFilter, setStatusFilter, expanded, setExpanded }) {
  const max = Math.max(...STATUS_ORDER.map(s => statusCounts[s] || 0), 1)
  return (
    <section className="overflow-hidden rounded-[22px] border p-4 shadow-[0_18px_40px_rgba(2,16,11,0.45),inset_0_1px_0_rgba(190,236,210,0.10)]" style={{ background: G.hero, borderColor: G.heroBorder }}>
      <div className="relative">
        <button onClick={() => setExpanded(!expanded)} className="btn-press absolute right-0 top-0 text-[11px] font-bold text-[#D8A84A]">
          Breakdown <span className={`inline-block transition-transform ${expanded ? 'rotate-180' : ''}`}>↓</span>
        </button>
        <div className="relative inline-flex">
          <span className="absolute left-1 top-1 h-16 w-16 rounded-full bg-[radial-gradient(circle,rgba(45,212,143,0.32),transparent_68%)] blur" />
          <span className="font-mono-q relative text-4xl font-semibold text-[#F7F1E4]">{total}</span>
        </div>
        <p className="mt-1 text-[13px] font-semibold text-[rgba(214,240,224,0.72)]">in your {MEDIA[medium].singular} collection</p>
        <div className="mt-4 flex gap-4">
          <MiniStat value={finished} label="Finished" color={C.mint} />
          <MiniStat value={avg ?? '--'} label="Avg" color={C.gold} prefix="★ " />
          <MiniStat value={fromFriends} label="From friends" color={C.gold} />
        </div>
        <div className="mt-4 flex h-2 rounded-md bg-[rgba(190,236,210,0.13)] p-0.5">
          {STATUS_ORDER.map(status => {
            const count = statusCounts[status] || 0
            if (!count) return null
            return <button key={status} title={STATUS[status].label} onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)} className="h-full first:rounded-l last:rounded-r" style={{ flex: count, background: STATUS[status].dot, opacity: statusFilter === 'all' || statusFilter === status ? 1 : 0.25 }} />
          })}
        </div>
      </div>
      <div className={`overflow-hidden transition-[max-height] duration-300 ${expanded ? 'max-h-[360px]' : 'max-h-0'}`}>
        <div className="mt-4 space-y-1 border-t border-[rgba(150,214,180,0.16)] pt-3">
          {STATUS_ORDER.map(status => {
            const count = statusCounts[status] || 0
            const active = statusFilter === status
            return (
              <button key={status} disabled={!count} onClick={() => setStatusFilter(active ? 'all' : status)}
                className={`btn-press flex w-full items-center gap-2 rounded-[11px] px-2 py-2 text-left disabled:opacity-30 ${active ? 'bg-[#2DD48F]/10 shadow-[inset_2px_0_0_rgba(45,212,143,0.7)]' : ''}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS[status].dot }} />
                <span className="flex-1 text-[13.5px] font-semibold text-[#F7F1E4]">{STATUS[status].label}</span>
                <span className="h-[5px] w-20 rounded-full bg-[rgba(190,236,210,0.13)]"><span className="block h-full rounded-full" style={{ width: `${(count / max) * 100}%`, background: STATUS[status].dot }} /></span>
                <span className="font-mono-q w-5 text-right text-[13px] font-semibold text-[#F7F1E4]">{count}</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function MiniStat({ value, label, color, prefix = '' }) {
  return <div><p className="font-mono-q text-sm font-semibold" style={{ color }}>{prefix}{value}</p><p className="text-[10px] font-bold uppercase tracking-wide text-[rgba(214,240,224,0.5)]">{label}</p></div>
}

function BotStrip({ loading, active, result, onAsk, onDismiss, onStatusChange }) {
  if (loading) {
    return <div className="flex items-center gap-3 rounded-2xl border border-[#2DD48F]/25 bg-[rgba(12,62,44,0.55)] px-4 py-3 text-[13.5px] font-semibold text-[rgba(214,240,224,0.7)]"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2DD48F]/30 border-t-[#2DD48F]" />Queued Bot is thinking...</div>
  }
  if (result?.sent && result?.recommendation) {
    const rec = result.recommendation
    return (
      <div className="relative rounded-[18px] border border-[#2DD48F]/25 bg-[rgba(12,62,44,0.72)] p-3 shadow-[inset_2px_0_0_rgba(45,212,143,0.5)]">
        <button onClick={onDismiss} className="absolute right-2 top-2 text-[rgba(214,240,224,0.5)]">×</button>
        <div className="flex gap-3 pr-5">
          <PosterTile item={rec} w={42} h={62} radius={9} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold text-[#F7F1E4]">{rec.media_title}</p>
            <p className="truncate text-[11px] text-[rgba(214,240,224,0.5)]">{rec.media_creator || rec.media_type}</p>
            <p className="mt-1 line-clamp-2 text-xs text-[rgba(214,240,224,0.7)]">{result.reason || rec.reason || 'Queued Bot added a fresh pick.'}</p>
          </div>
          <StatusMenu value="not_yet_viewed" onChange={onStatusChange} />
        </div>
      </div>
    )
  }
  if (result?.exhausted || result?.error) {
    return (
      <div className="rounded-[18px] border border-[#C96B4B]/30 bg-[rgba(12,62,44,0.62)] p-3 shadow-[inset_2px_0_0_rgba(201,107,75,0.55)]">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-[13px] font-semibold text-[rgba(214,240,224,0.72)]">
            {result.error || 'Queued Bot could not find a fresh pick yet. Try changing genres or ask again after adding a few more titles.'}
          </p>
          <button onClick={onAsk} className="btn-press shrink-0 rounded-full border border-[#D8A84A]/35 px-3 py-1.5 text-xs font-bold text-[#D8A84A]">Try again</button>
        </div>
      </div>
    )
  }
  if (active) {
    return (
      <button onClick={onAsk} className="btn-press flex w-full items-center justify-between gap-3 rounded-2xl border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] px-4 py-3 text-left">
        <span className="min-w-0 text-[12.5px] font-semibold text-[rgba(214,240,224,0.7)]"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#D8A84A]" />Current bot pick: {active.media_title}</span>
        <span className="shrink-0 text-xs font-bold text-[#D8A84A]">New pick</span>
      </button>
    )
  }
  return (
    <button onClick={onAsk} className="btn-press flex w-full items-center justify-between rounded-2xl border border-dashed border-[#2DD48F]/35 px-4 py-3 text-left">
      <span className="flex items-center gap-2 text-[13.5px] font-bold text-[#F7F1E4]"><BotIcon />Ask Queued Bot for a pick</span>
      <span className="text-[#D8A84A]">›</span>
    </button>
  )
}

function QueueRow({ item, own, first, onOpen, onStatus, onDelete }) {
  return (
    <div className={`flex items-center gap-3 px-[13px] py-[11px] ${first ? '' : 'border-t border-[rgba(150,214,180,0.12)]'}`}>
      <button onClick={onOpen} className="btn-press"><PosterTile item={item} w={34} h={52} radius={8} /></button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#F7F1E4]">{item.media_title} {item.rating && <span className="font-mono-q text-[11px] text-[#D8A84A]">★ {displayRating(item.rating)}</span>}</p>
        <p className="truncate text-[11.5px] text-[rgba(214,240,224,0.5)]">
          {item.media_creator || MEDIA[item.media_type]?.label}
          <span> · {item.origin}</span>
          {item.origin_type === 'bot' && <span className="text-[#C96B4B]"> · Bot</span>}
        </p>
        {own && item.item_kind === 'log' && <button onClick={onDelete} className="btn-press mt-2 inline-flex rounded-full border border-[#C96B4B]/35 px-2.5 py-1 text-[11px] font-bold text-[#F7F1E4]/70">Remove</button>}
      </div>
      {own && item.item_kind !== 'sent' ? <StatusMenu value={item.status} onChange={onStatus} /> : <span className="font-mono-q text-[10px] text-[rgba(214,240,224,0.5)]">{STATUS[item.status]?.short}</span>}
    </div>
  )
}

function TasteSection({ editing, setEditing, selectedGenres, toggleGenre, save, saving }) {
  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="btn-press flex w-full items-center justify-between rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] px-4 py-3 text-left shadow-[inset_3px_0_0_rgba(184,115,51,0.62)]"
      >
        <span>
          <span className="block text-sm font-extrabold text-[#F7F1E4]">Customize your experience</span>
          <span className="mt-0.5 block text-[12px] font-semibold text-[rgba(214,240,224,0.5)]">
            {selectedGenres.length ? `${selectedGenres.length} taste picks saved` : 'Tune genres for recommendations'}
          </span>
        </span>
        <span className="text-[#D8A84A]">Edit</span>
      </button>
    )
  }

  return (
    <section className="rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] p-4 shadow-[inset_3px_0_0_rgba(184,115,51,0.62)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[#F7F1E4]">Customize your experience</p>
          <p className="mt-0.5 text-[12px] font-semibold text-[rgba(214,240,224,0.5)]">These answers guide Queued Bot.</p>
        </div>
        <button onClick={() => setEditing(false)} className="btn-press text-xl leading-none text-[rgba(214,240,224,0.5)]">x</button>
      </div>

      <div className="space-y-3">
        {TASTE_GENRE_GROUPS.map(group => (
          <div key={group.key}>
            <p className="font-mono-q mb-1.5 text-[10px] font-bold uppercase tracking-[1.4px] text-[rgba(214,240,224,0.42)]">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {group.genres.map(genre => {
                const active = selectedGenres.includes(genre)
                return (
                  <button
                    key={`${group.key}-${genre}`}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={`btn-press rounded-full border px-3 py-1.5 text-xs font-bold ${active ? 'border-[#D8A84A] bg-[#F4E9D1] text-[#052016]' : 'border-[rgba(150,214,180,0.16)] bg-[rgba(9,46,32,0.66)] text-[rgba(214,240,224,0.7)]'}`}
                  >
                    {genre}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={save} disabled={saving} className="btn-press btn-cream rounded-xl px-4 py-2 text-xs font-bold">{saving ? 'Saving...' : 'Save'}</button>
        <button onClick={() => setEditing(false)} className="btn-press btn-outline-cream rounded-xl px-4 py-2 text-xs">Cancel</button>
      </div>
    </section>
  )
}

function PlatformsSection({ isOwnProfile, profile, editing, setEditing, selected, toggle, save, saving }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>Streaming platforms</SectionTitle>
        {isOwnProfile && !editing && <button onClick={() => setEditing(true)} className="text-xs font-semibold text-[rgba(214,240,224,0.5)]">Edit</button>}
      </div>
      {editing ? (
        <div className="rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] p-4">
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => <button key={p.id} onClick={() => toggle(p.id)} className="btn-press rounded-full px-3 py-1.5 text-xs font-bold text-white" style={{ background: selected.includes(p.id) ? p.color : 'rgba(9,46,32,0.66)', border: `1px solid ${selected.includes(p.id) ? p.color : 'rgba(150,214,180,0.16)'}` }}>{selected.includes(p.id) ? '✓ ' : ''}{platformInitials(p.name)}</button>)}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={save} disabled={saving} className="btn-press btn-cream rounded-xl px-4 py-2 text-xs font-bold">{saving ? 'Saving...' : 'Save'}</button>
            <button onClick={() => setEditing(false)} className="btn-press btn-outline-cream rounded-xl px-4 py-2 text-xs">Cancel</button>
          </div>
        </div>
      ) : (profile?.platforms ?? []).length > 0 ? (
        <div className="flex flex-wrap gap-2">{profile.platforms.map(id => {
          const p = PLATFORMS.find(pl => pl.id === id)
          return p ? <span key={id} className="rounded-full px-3 py-1.5 text-xs font-bold text-white" style={{ background: p.color }}>{platformInitials(p.name)}</span> : null
        })}</div>
      ) : <p className="rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] px-4 py-3 text-center text-sm text-[rgba(214,240,224,0.5)]">No platforms listed</p>}
    </section>
  )
}

function FilterIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
}

function BotIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 3v3M7 8h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Z" stroke={C.mint} strokeWidth="2"/><path d="M9 13h.01M15 13h.01" stroke={C.mint} strokeWidth="3" strokeLinecap="round"/></svg>
}
