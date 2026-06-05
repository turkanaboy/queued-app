import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { InitialsAvatar } from '../components/Layout'
import { ProviderRows } from './AddRecommendationPage'
import { Chip, C, EmptyState, MEDIA, MEDIA_ORDER, PosterTile, ScreenHeader, STATUS_ORDER, StatusMenu } from '../lib/queuedDesign'

const STATUS_LABELS = { all: 'All', not_yet_viewed: 'New', queued: 'Queued', in_progress: 'Watching', finished: 'Finished', skipped: 'Skipped', bailed: 'Bailed' }

export default function SharedListPage() {
  const { friendId } = useParams()
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const [friend, setFriend] = useState(null)
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dirFilter, setDirFilter] = useState('all')

  useEffect(() => { fetchFriend(); fetchRecs() }, [friendId, session])

  async function fetchFriend() {
    const { data } = await supabase.from('users').select('*').eq('id', friendId).single()
    setFriend(data)
  }

  async function fetchRecs() {
    setLoading(true)
    const uid = session.user.id
    const { data } = await supabase
      .from('recommendations')
      .select('*, sender:users!recommendations_sender_id_fkey(id,username,display_name), comments(id)')
      .or(`and(sender_id.eq.${uid},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${uid})`)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setRecs(data ?? [])
    setLoading(false)
  }

  async function syncRecommendationToLog(rec, status, rating = rec.rating ?? null) {
    if (!rec || rec.recipient_id !== session.user.id) return
    if (status === 'not_yet_viewed' || status === 'skipped') return
    await supabase.from('user_media_log').upsert({
      user_id: session.user.id,
      media_type: rec.media_type,
      media_id: rec.media_id,
      media_title: rec.media_title,
      media_creator: rec.media_creator ?? null,
      media_poster_url: rec.media_poster_url,
      rating,
      status,
      source_type: 'recommendation',
      source_user_id: rec.sender_id,
    }, { onConflict: 'user_id,media_id' })
  }

  async function updateStatus(recId, status, rec) {
    await supabase.from('recommendations').update({ recipient_status: status }).eq('id', recId)
    await syncRecommendationToLog(rec, status)
    fetchRecs()
  }

  async function updateRating(recId, rating, rec) {
    await supabase.from('recommendations').update({ rating }).eq('id', recId)
    if (rec && rating) {
      await supabase.from('user_media_log').upsert({
        user_id: session.user.id,
        media_type: rec.media_type,
        media_id: rec.media_id,
        media_title: rec.media_title,
        media_creator: rec.media_creator ?? null,
        media_poster_url: rec.media_poster_url,
        rating,
        status: 'finished',
        source_type: 'recommendation',
        source_user_id: rec.sender_id,
      }, { onConflict: 'user_id,media_id' })
    }
    fetchRecs()
  }

  async function softDelete(recId) {
    await supabase.from('recommendations').update({ deleted_at: new Date().toISOString() }).eq('id', recId)
    fetchRecs()
  }

  const uid = session.user.id
  const filtered = recs.filter(r => {
    if (typeFilter !== 'all' && r.media_type !== typeFilter) return false
    if (statusFilter !== 'all' && r.recipient_status !== statusFilter) return false
    if (dirFilter === 'from_me' && r.sender_id !== uid) return false
    if (dirFilter === 'from_them' && r.sender_id === uid) return false
    return true
  })

  const summary = {
    total: recs.length,
    finished: recs.filter(r => r.recipient_status === 'finished').length,
    fromThem: recs.filter(r => r.sender_id !== uid).length,
    fromYou: recs.filter(r => r.sender_id === uid).length,
  }

  return (
    <div className="pb-5">
      <ScreenHeader
        eyebrow="Shared list"
        title={friend?.display_name || friend?.username || 'Friend'}
        subtitle={friend ? `@${friend.username}` : null}
        back={<button onClick={() => navigate(-1)} className="btn-press flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(150,214,180,0.16)] bg-[rgba(9,46,32,0.66)] text-xl text-[#F4E9D1]">←</button>}
        right={friend && <InitialsAvatar name={friend.display_name || friend.username} size="md" />}
      />

      <div className="space-y-5 px-[18px]">
        <div className="grid grid-cols-4 gap-2">
          <StatPill value={summary.total} label="Total" />
          <StatPill value={summary.finished} label="Finished" color={C.mint} />
          <StatPill value={summary.fromThem} label="From them" />
          <StatPill value={summary.fromYou} label="From you" />
        </div>

        <div className="space-y-2">
          <ChipRow value={typeFilter} onChange={setTypeFilter} options={[{ value: 'all', label: 'All' }, ...MEDIA_ORDER.map(type => ({ value: type, label: MEDIA[type].label }))]} />
          <ChipRow value={dirFilter} onChange={setDirFilter} options={[{ value: 'all', label: 'All' }, { value: 'from_them', label: 'From them' }, { value: 'from_me', label: 'From you' }]} />
          <ChipRow value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All' }, ...STATUS_ORDER.map(status => ({ value: status, label: STATUS_LABELS[status] }))]} />
        </div>

        {loading ? <p className="text-sm text-white/40">Loading...</p> : filtered.length === 0 ? (
          <div className="rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)]">
            <EmptyState title="Nothing here yet" body="Shared recommendations will show up here." />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(rec => (
              <SharedRecCard
                key={rec.id}
                rec={rec}
                currentUserId={uid}
                friend={friend}
                myPlatforms={profile?.platforms ?? []}
                onStatusChange={(status) => updateStatus(rec.id, status, rec)}
                onRatingChange={(rating) => updateRating(rec.id, rating, rec)}
                onDelete={() => softDelete(rec.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatPill({ value, label, color = C.creamText }) {
  return (
    <div className="rounded-[13px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] px-2 py-3 text-center">
      <p className="font-mono-q text-lg font-semibold leading-none" style={{ color }}>{value}</p>
      <p className="mt-1 text-[9.5px] font-bold uppercase leading-tight text-[rgba(214,240,224,0.5)]">{label}</p>
    </div>
  )
}

function ChipRow({ options, value, onChange }) {
  return <div className="scrollbar-none flex gap-2 overflow-x-auto">{options.map(option => <Chip key={option.value} active={value === option.value} onClick={() => onChange(option.value)}>{option.label}</Chip>)}</div>
}

function SharedRecCard({ rec, currentUserId, friend, myPlatforms, onStatusChange, onRatingChange, onDelete }) {
  const fromThem = rec.sender_id !== currentUserId
  const name = fromThem ? (friend?.display_name || friend?.username || 'them') : 'you'
  return (
    <article className="rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] p-3" style={{ boxShadow: `inset 3px 0 0 ${fromThem ? 'rgba(216,168,74,0.55)' : 'rgba(184,115,51,0.62)'}` }}>
      <div className="flex gap-3">
        <PosterTile item={rec} w={52} h={76} radius={10} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-[#F7F1E4]">{rec.media_title}</p>
              <p className="truncate text-[11.5px] text-[rgba(214,240,224,0.5)]">{rec.media_creator || MEDIA[rec.media_type]?.label}</p>
            </div>
            <StatusMenu value={rec.recipient_status} onChange={onStatusChange} />
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-[rgba(214,240,224,0.6)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: fromThem ? C.gold : C.brass }} />
            From {name}
            <span className="ml-1 text-[rgba(214,240,224,0.45)]">◌ {rec.comments?.length ?? 0}</span>
          </p>
          {rec.note && <p className="mt-1.5 line-clamp-2 text-xs text-[rgba(214,240,224,0.7)]">{rec.note}</p>}
          {rec.rating && <p className="font-mono-q mt-1 text-xs font-semibold text-[#D8A84A]">★ {rec.rating}</p>}
          <div className="mt-2"><ProviderRows providers={rec.streaming_providers} title={rec.media_title} creator={rec.media_creator} mediaType={rec.media_type} myPlatforms={myPlatforms} /></div>
          <div className="mt-2 flex items-center gap-2">
            {fromThem && rec.recipient_status !== 'finished' && <button onClick={() => onStatusChange('finished')} className="btn-press rounded-full border border-[#D8A84A]/40 px-3 py-1.5 text-xs font-bold text-[#D8A84A]">★ Rate</button>}
            {fromThem && rec.recipient_status === 'finished' && <RatingButtons value={rec.rating} onChange={onRatingChange} />}
            {!fromThem && <button onClick={onDelete} className="btn-press text-xs font-semibold text-[rgba(214,240,224,0.35)]">Unsend</button>}
          </div>
        </div>
      </div>
    </article>
  )
}

function RatingButtons({ value, onChange }) {
  return <div className="flex gap-1">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => onChange(n)} className={`btn-press text-sm ${value && n <= value ? 'text-[#D8A84A]' : 'text-white/20'}`}>★</button>)}</div>
}
