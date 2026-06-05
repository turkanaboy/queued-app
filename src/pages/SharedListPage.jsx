import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

import { InitialsAvatar } from '../components/Layout'
import RecommendationCard from '../components/RecommendationCard'

const STATUS_OPTIONS = ['all', 'not_yet_viewed', 'queued', 'in_progress', 'finished', 'skipped', 'bailed']
const STATUS_LABELS = {
  all: 'All', not_yet_viewed: 'New', queued: 'Queued',
  in_progress: 'Watching', finished: 'Finished', skipped: 'Skipped', bailed: 'Bailed'
}

export default function SharedListPage() {
  const { friendId } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [friend, setFriend] = useState(null)
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dirFilter, setDirFilter] = useState('all')
  const [sort, setSort] = useState('recent')

  useEffect(() => { fetchFriend(); fetchRecs() }, [friendId, session])

  async function fetchFriend() {
    const { data } = await supabase.from('users').select('*').eq('id', friendId).single()
    setFriend(data)
  }

  async function fetchRecs() {
    setLoading(true)
    const uid = session.user.id
    let q = supabase
      .from('recommendations')
      .select('*, sender:users!recommendations_sender_id_fkey(id,username,display_name), comments(id)')
      .or(`and(sender_id.eq.${uid},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${uid})`)
      .is('deleted_at', null)

    q = sort === 'recent'
      ? q.order('created_at', { ascending: false })
      : q.order('rating', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })

    const { data } = await q
    setRecs(data ?? [])
    setLoading(false)
  }

  async function syncRecommendationToLog(rec, status, rating = rec.rating ?? null) {
    if (!rec || rec.recipient_id !== session.user.id) return
    if (status === 'not_yet_viewed' || status === 'skipped') return

    await supabase.from('user_media_log').upsert({
      user_id:          session.user.id,
      media_type:       rec.media_type,
      media_id:         rec.media_id,
      media_title:      rec.media_title,
      media_creator:    rec.media_creator ?? null,
      media_poster_url: rec.media_poster_url,
      rating,
      status,
      source_type:      'recommendation',
      source_user_id:   rec.sender_id,
    }, { onConflict: 'user_id,media_id' })
  }

  async function updateStatus(recId, status, rec) {
    await supabase.from('recommendations').update({ recipient_status: status }).eq('id', recId)
    await syncRecommendationToLog(rec, status)
    fetchRecs()
  }

  async function updateRating(recId, rating, rec) {
    await supabase.from('recommendations').update({ rating }).eq('id', recId)
    // Auto-log to personal collection so the user's profile shows the source
    if (rec && rating) {
      await supabase.from('user_media_log').upsert({
        user_id:          session.user.id,
        media_type:       rec.media_type,
        media_id:         rec.media_id,
        media_title:      rec.media_title,
        media_creator:    rec.media_creator ?? null,
        media_poster_url: rec.media_poster_url,
        rating,
        status:           'finished',
        source_type:      'recommendation',
        source_user_id:   rec.sender_id,
      }, { onConflict: 'user_id,media_id' })
    }
    fetchRecs()
  }

  async function softDelete(recId) {
    await supabase.from('recommendations').update({ deleted_at: new Date().toISOString() }).eq('id', recId)
    fetchRecs()
  }

  const { profile } = useAuth()
  const myPlatforms = profile?.platforms ?? []

  const uid = session.user.id
  const filtered = recs.filter(r => {
    if (typeFilter !== 'all' && r.media_type !== typeFilter) return false
    if (statusFilter !== 'all' && r.recipient_status !== statusFilter) return false
    if (dirFilter === 'from_me' && r.sender_id !== uid) return false
    if (dirFilter === 'from_them' && r.sender_id === uid) return false
    return true
  })

  return (
    <div className="space-y-5">
      {/* Friend header */}
      {friend && (
        <div className="anim-scale flex items-center justify-between">
          <button onClick={() => navigate(`/profile/${friend.id}`)} className="flex items-center gap-3">
            <InitialsAvatar name={friend.display_name || friend.username} size="md" />
            <div className="text-left">
              <p className="font-extrabold text-white text-lg">{friend.display_name || friend.username}</p>
              <p className="text-white/50 text-xs">@{friend.username}</p>
            </div>
          </button>
          <button
            onClick={() => navigate(-1)}
            className="btn-press text-white/50 hover:text-white p-2"
          >
            ←
          </button>
        </div>
      )}

      {/* Filter pills */}
      <div className="space-y-2 anim-up">
        <FilterRow
          options={[{ value: 'all', label: 'All' }, { value: 'movie', label: '🎬 Movie' }, { value: 'tv', label: '📺 TV' }]}
          value={typeFilter} onChange={setTypeFilter}
        />
        <FilterRow
          options={STATUS_OPTIONS.map(s => ({ value: s, label: STATUS_LABELS[s] }))}
          value={statusFilter} onChange={setStatusFilter}
        />
        <FilterRow
          options={[{ value: 'all', label: 'All' }, { value: 'from_me', label: 'From me' }, { value: 'from_them', label: 'From them' }]}
          value={dirFilter} onChange={setDirFilter}
        />
        <FilterRow
          options={[{ value: 'recent', label: '🕐 Recent' }, { value: 'top', label: '⭐ Top rated' }]}
          value={sort} onChange={v => { setSort(v); fetchRecs() }}
        />
      </div>

      {/* List */}
      {loading ? (
        <p className="text-white/40 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-3xl p-8 text-center">
          <p className="text-4xl mb-3">🎬</p>
          <p className="text-white/50 text-sm">Nothing here yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(rec => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              currentUserId={uid}
              myPlatforms={myPlatforms}
              onStatusChange={(recId, status) => updateStatus(recId, status, rec)}
              onRatingChange={(recId, rating) => updateRating(recId, rating, rec)}
              onDelete={softDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterRow({ options, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`btn-press shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
            value === o.value
              ? 'text-[#040C21] border-transparent'
              : 'text-white/60 border-white/20 hover:border-white/40'
          }`}
          style={value === o.value ? { background: 'white' } : { background: 'rgba(255,255,255,0.1)' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
