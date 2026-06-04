import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { InitialsAvatar } from '../components/Layout'

export default function ProfilePage() {
  const { userId } = useParams()
  const { session, refreshProfile } = useAuth()
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

  useEffect(() => { fetchProfile(); fetchStats(); fetchActivity() }, [targetId])

  async function fetchProfile() {
    const { data } = await supabase.from('users').select('*').eq('id', targetId).single()
    setProfile(data)
    setDisplayName(data?.display_name || '')
    setLoading(false)
  }

  async function fetchStats() {
    const [sent, received, finished] = await Promise.all([
      supabase.from('recommendations').select('*', { count: 'exact', head: true }).eq('sender_id', targetId).is('deleted_at', null),
      supabase.from('recommendations').select('*', { count: 'exact', head: true }).eq('recipient_id', targetId).is('deleted_at', null),
      supabase.from('recommendations').select('rating').eq('recipient_id', targetId).eq('recipient_status', 'finished').is('deleted_at', null),
    ])
    const ratings = (finished.data ?? []).map(r => r.rating).filter(Boolean)
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null
    setStats({ sent: sent.count ?? 0, received: received.count ?? 0, finished: finished.data?.length ?? 0, avgRating })
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

  async function saveProfile() {
    setSaving(true)
    await supabase.from('users').update({ display_name: displayName }).eq('id', session.user.id)
    await refreshProfile()
    setEditing(false)
    fetchProfile()
    setSaving(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) return <div className="flex items-center justify-center pt-20"><p className="text-white/40">Loading…</p></div>
  if (!profile) return <div className="flex items-center justify-center pt-20"><p className="text-white/40">User not found.</p></div>

  return (
    <div className="space-y-6">
      {/* Profile hero */}
      <div className="anim-scale text-center pt-4">
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
              className="btn-press text-xs font-bold px-3 py-2 rounded-xl text-purple-900"
              style={{ background: 'white' }}>
              {saving ? '…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)}
              className="btn-press text-xs text-white/50 p-2">✕</button>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-extrabold text-white">{profile.display_name || profile.username}</h1>
            <p className="text-white/50 text-sm mt-0.5">@{profile.username}</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 mt-3">
          {isOwnProfile && !editing && (
            <button onClick={() => setEditing(true)}
              className="btn-press text-xs font-bold px-4 py-1.5 rounded-full border border-white/30 text-white/70"
              style={{ background: 'rgba(255,255,255,0.1)' }}>
              Edit profile
            </button>
          )}
          {!isOwnProfile && (
            <button onClick={() => navigate(`/list/${targetId}`)}
              className="btn-press text-xs font-bold px-4 py-1.5 rounded-full text-purple-900"
              style={{ background: 'white' }}>
              View list
            </button>
          )}
          {isOwnProfile && (
            <button onClick={handleSignOut}
              className="btn-press text-xs font-bold px-4 py-1.5 rounded-full border border-white/20 text-white/40">
              Sign out
            </button>
          )}
        </div>
      </div>

      {/* Stats dashboard */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 anim-up">
          <StatCard emoji="📤" label="Sent" value={stats.sent} />
          <StatCard emoji="📥" label="Received" value={stats.received} />
          <StatCard emoji="✅" label="Finished" value={stats.finished} />
          <StatCard emoji="⭐" label="Avg rating" value={stats.avgRating ?? '—'} />
        </div>
      )}

      {/* Recently watched — horizontal poster scroll */}
      <section className="anim-up">
        <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">
          {isOwnProfile ? 'Recently watched' : `${profile.display_name || profile.username}'s watches`}
        </p>
        {activity.length === 0 ? (
          <div className="glass rounded-3xl p-6 text-center">
            <p className="text-3xl mb-2">🎬</p>
            <p className="text-white/40 text-sm">Nothing finished yet.</p>
          </div>
        ) : (
          <div className="poster-scroll -mx-4 px-4">
            {activity.map(r => (
              <div key={r.id} className="shrink-0 w-28">
                <div className="relative rounded-2xl overflow-hidden shadow-lg">
                  {r.media_poster_url
                    ? <img src={r.media_poster_url} className="w-28 h-40 object-cover" alt={r.media_title} />
                    : <div className="w-28 h-40 flex items-center justify-center text-3xl"
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
        )}
      </section>
    </div>
  )
}

function StatCard({ emoji, label, value }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <p className="text-2xl mb-1">{emoji}</p>
      <p className="text-2xl font-extrabold text-white">{value}</p>
      <p className="text-white/50 text-xs font-semibold mt-0.5">{label}</p>
    </div>
  )
}
