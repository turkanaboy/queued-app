import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { InitialsAvatar } from '../components/Layout'

export default function ProfilePage() {
  const { userId } = useParams()
  const { session, profile: myProfile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const targetId = userId || session.user.id
  const isOwnProfile = targetId === session.user.id

  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchProfile()
    fetchStats()
    fetchActivity()
  }, [targetId])

  async function fetchProfile() {
    const { data } = await supabase.from('users').select('*').eq('id', targetId).single()
    setProfile(data)
    setDisplayName(data?.display_name || '')
    setLoading(false)
  }

  async function fetchStats() {
    const uid = targetId
    const [sent, received, finished] = await Promise.all([
      supabase.from('recommendations').select('*', { count: 'exact', head: true }).eq('sender_id', uid).is('deleted_at', null),
      supabase.from('recommendations').select('*', { count: 'exact', head: true }).eq('recipient_id', uid).is('deleted_at', null),
      supabase.from('recommendations').select('rating').eq('recipient_id', uid).eq('recipient_status', 'finished').is('deleted_at', null),
    ])
    const ratings = (finished.data ?? []).map(r => r.rating).filter(Boolean)
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null
    setStats({
      sent: sent.count ?? 0,
      received: received.count ?? 0,
      finished: finished.data?.length ?? 0,
      avgRating,
    })
  }

  async function fetchActivity() {
    const { data } = await supabase
      .from('recommendations')
      .select('id, media_title, media_poster_url, media_type, rating, created_at, sender:users!recommendations_sender_id_fkey(username, display_name)')
      .eq('recipient_id', targetId)
      .eq('recipient_status', 'finished')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20)
    setActivity(data ?? [])
  }

  async function saveProfile() {
    setSaving(true)
    await supabase.from('users').update({ display_name: displayName }).eq('id', session.user.id)
    await refreshProfile()
    setEditing(false)
    fetchProfile()
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>
  if (!profile) return <p className="text-sm text-gray-400">User not found.</p>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-4">
        <InitialsAvatar name={profile.display_name || profile.username} size="lg" />
        <div className="flex-1">
          {isOwnProfile && editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={saveProfile} disabled={saving} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="text-xs text-gray-400">Cancel</button>
            </div>
          ) : (
            <div>
              <p className="font-bold text-gray-900">{profile.display_name || profile.username}</p>
              <p className="text-sm text-gray-400">@{profile.username}</p>
            </div>
          )}
          {isOwnProfile && !editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 mt-1 hover:underline">
              Edit profile
            </button>
          )}
        </div>
        {!isOwnProfile && (
          <button
            onClick={() => navigate(`/list/${targetId}`)}
            className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-full hover:bg-indigo-100"
          >
            View list
          </button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Sent', value: stats.sent },
            { label: 'Received', value: stats.received },
            { label: 'Finished', value: stats.finished },
            { label: 'Avg rating', value: stats.avgRating ?? '—' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Activity feed */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {isOwnProfile ? 'Your watched & rated' : `${profile.display_name || profile.username}'s watched & rated`}
        </h2>
        {activity.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing finished yet.</p>
        ) : (
          <div className="space-y-2">
            {activity.map(r => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                {r.media_poster_url
                  ? <img src={r.media_poster_url} className="w-10 h-14 object-cover rounded shrink-0" alt="" />
                  : <div className="w-10 h-14 bg-gray-100 rounded shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.media_title}</p>
                  <p className="text-xs text-gray-400 capitalize">{r.media_type}</p>
                  {r.rating && (
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-xs ${s <= Math.ceil(r.rating) ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                      ))}
                      <span className="text-xs text-gray-400 ml-1">{r.rating}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-300">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
