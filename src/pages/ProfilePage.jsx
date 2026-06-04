import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { InitialsAvatar } from '../components/Layout'
import { PLATFORMS, platformInitials } from '../lib/platforms'
import LogMediaSheet from '../components/LogMediaSheet'

export default function ProfilePage() {
  const { userId } = useParams()
  const { session, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const targetId = userId || session.user.id
  const isOwnProfile = targetId === session.user.id

  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [mediaLog, setMediaLog] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [showLogSheet, setShowLogSheet] = useState(false)

  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [editingPlatforms, setEditingPlatforms] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchProfile()
    fetchStats()
    fetchMediaLog()
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
    const [sent, received, finished, logged] = await Promise.all([
      supabase.from('recommendations').select('*', { count: 'exact', head: true }).eq('sender_id', targetId).is('deleted_at', null),
      supabase.from('recommendations').select('*', { count: 'exact', head: true }).eq('recipient_id', targetId).is('deleted_at', null),
      supabase.from('recommendations').select('rating').eq('recipient_id', targetId).eq('recipient_status', 'finished').is('deleted_at', null),
      supabase.from('user_media_log').select('*', { count: 'exact', head: true }).eq('user_id', targetId),
    ])
    const ratings = (finished.data ?? []).map(r => r.rating).filter(Boolean)
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null
    setStats({ sent: sent.count ?? 0, received: received.count ?? 0, finished: finished.data?.length ?? 0, avgRating, logged: logged.count ?? 0 })
  }

  async function fetchMediaLog() {
    const { data } = await supabase
      .from('user_media_log')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })
      .limit(20)
    setMediaLog(data ?? [])
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

  async function handleSignOut() {
    if (!window.confirm('Sign out of Queued?')) return
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) return <div className="flex items-center justify-center pt-20"><p className="text-white/40">Loading…</p></div>
  if (!profile) return <div className="flex items-center justify-center pt-20"><p className="text-white/40">User not found.</p></div>

  return (
    <div className="space-y-6 pb-4">
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
            <button onClick={() => setEditing(false)} className="btn-press text-xs text-white/50 p-2">✕</button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-white">{profile.display_name || profile.username}</h1>
            <p className="text-white/50 text-sm mt-0.5">@{profile.username}</p>
          </>
        )}

        <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
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

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 anim-up">
          <StatCard emoji="📝" label="Logged" value={stats.logged} />
          <StatCard emoji="✅" label="Finished" value={stats.finished} />
          <StatCard emoji="⭐" label="Avg rating" value={stats.avgRating ?? '—'} />
          <StatCard emoji="📤" label="Sent" value={stats.sent} />
          <StatCard emoji="📥" label="Received" value={stats.received} />
          <StatCard emoji="👥" label="Friends" value="—" />
        </div>
      )}

      {/* My Log */}
      <section className="anim-up">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/50 text-xs font-bold uppercase tracking-widest">My Log</p>
          {isOwnProfile && (
            <button
              onClick={() => setShowLogSheet(true)}
              className="btn-press w-8 h-8 rounded-full flex items-center justify-center font-bold text-purple-900 shadow-lg text-lg"
              style={{ background: 'white' }}
            >
              +
            </button>
          )}
        </div>

        {mediaLog.length === 0 ? (
          <div className="glass rounded-3xl p-6 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-white/40 text-sm">
              {isOwnProfile ? 'Log movies and shows you\'ve watched' : 'Nothing logged yet'}
            </p>
            {isOwnProfile && (
              <button onClick={() => setShowLogSheet(true)}
                className="btn-press mt-3 text-xs font-bold px-4 py-2 rounded-full text-purple-900"
                style={{ background: 'white' }}>
                + Log something
              </button>
            )}
          </div>
        ) : (
          <div className="poster-scroll -mx-4 px-4">
            {mediaLog.map(item => (
              <div key={item.id} className="shrink-0 w-28 group relative">
                <div className="relative rounded-2xl overflow-hidden shadow-lg">
                  {item.media_poster_url
                    ? <img src={item.media_poster_url} className="w-28 h-40 object-cover" alt={item.media_title} />
                    : <div className="w-28 h-40 flex items-center justify-center text-3xl"
                        style={{ background: 'rgba(255,255,255,0.15)' }}>🎬</div>
                  }
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
                    {item.rating ? (
                      <div className="flex items-center gap-0.5">
                        <span className="text-amber-300 text-xs">★</span>
                        <span className="text-white text-xs font-bold">{item.rating}</span>
                      </div>
                    ) : (
                      <span className="text-white/40 text-xs">No rating</span>
                    )}
                  </div>
                  {isOwnProfile && (
                    <button
                      onClick={() => deleteLogEntry(item.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white/70 hover:text-rose-300 text-xs items-center justify-center hidden group-hover:flex"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-white/70 text-xs font-semibold mt-1.5 truncate">{item.media_title}</p>
                {item.review && (
                  <p className="text-white/30 text-[10px] mt-0.5 line-clamp-2 italic">"{item.review}"</p>
                )}
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
                className="btn-press text-xs font-bold px-4 py-2 rounded-xl text-purple-900"
                style={{ background: 'white' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditingPlatforms(false); setSelectedPlatforms(profile?.platforms ?? []) }}
                className="btn-press text-xs text-white/50 px-4 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
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
    </div>
  )
}

function StatCard({ emoji, label, value }) {
  return (
    <div className="glass rounded-2xl p-3 text-center">
      <p className="text-xl mb-0.5">{emoji}</p>
      <p className="text-xl font-extrabold text-white">{value}</p>
      <p className="text-white/50 text-[10px] font-semibold mt-0.5">{label}</p>
    </div>
  )
}
