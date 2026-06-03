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

  useEffect(() => {
    fetchFriend()
    fetchRecs()
  }, [friendId, session])

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

    if (sort === 'recent') q = q.order('created_at', { ascending: false })
    else q = q.order('rating', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })

    const { data } = await q
    setRecs(data ?? [])
    setLoading(false)
  }

  async function updateStatus(recId, status) {
    await supabase.from('recommendations').update({ recipient_status: status }).eq('id', recId)
    fetchRecs()
  }

  async function updateRating(recId, rating) {
    await supabase.from('recommendations').update({ rating }).eq('id', recId)
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

  return (
    <div className="space-y-5">
      {friend && (
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/profile/${friend.id}`)} className="flex items-center gap-3">
            <InitialsAvatar name={friend.display_name || friend.username} size="md" />
            <div className="text-left">
              <p className="font-semibold text-gray-900">{friend.display_name || friend.username}</p>
              <p className="text-xs text-gray-400">@{friend.username}</p>
            </div>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <FilterPills
          label="Type"
          options={[{ value: 'all', label: 'All' }, { value: 'movie', label: 'Movie' }, { value: 'tv', label: 'TV' }]}
          value={typeFilter}
          onChange={setTypeFilter}
        />
        <FilterPills
          label="Status"
          options={STATUS_OPTIONS.map(s => ({ value: s, label: STATUS_LABELS[s] }))}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <FilterPills
          label="Direction"
          options={[
            { value: 'all', label: 'All' },
            { value: 'from_me', label: 'From me' },
            { value: 'from_them', label: 'From them' },
          ]}
          value={dirFilter}
          onChange={setDirFilter}
        />
        <FilterPills
          label="Sort"
          options={[{ value: 'recent', label: 'Recent' }, { value: 'top', label: 'Top rated' }]}
          value={sort}
          onChange={v => { setSort(v); fetchRecs() }}
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing here yet.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(rec => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              currentUserId={uid}
              onStatusChange={updateStatus}
              onRatingChange={updateRating}
              onDelete={softDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterPills({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400 w-16 shrink-0">{label}</span>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            value === o.value
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
