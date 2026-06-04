import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { InitialsAvatar } from '../components/Layout'

export default function FriendsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [friends, setFriends] = useState([])
  const [pending, setPending] = useState([])
  const [incoming, setIncoming] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchFriendships() }, [session])

  async function fetchFriendships() {
    const uid = session.user.id
    const { data } = await supabase
      .from('friendships')
      .select('*, user_a:users!friendships_user_a_id_fkey(*), user_b:users!friendships_user_b_id_fkey(*)')
      .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`)

    const accepted = [], pendingOut = [], pendingIn = []
    for (const f of data ?? []) {
      const friend = f.user_a_id === uid ? f.user_b : f.user_a
      if (f.status === 'accepted') accepted.push({ ...f, friend })
      else if (f.requester_id === uid) pendingOut.push({ ...f, friend })
      else pendingIn.push({ ...f, friend })
    }
    setFriends(accepted)
    setPending(pendingOut)
    setIncoming(pendingIn)
    setLoading(false)
  }

  async function search(q) {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    const { data } = await supabase
      .from('users')
      .select('id, username, display_name')
      .ilike('username', `%${q}%`)
      .neq('id', session.user.id)
      .limit(8)
    setSearchResults(data ?? [])
  }

  async function sendRequest(userId) {
    const uid = session.user.id
    const [a, b] = uid < userId ? [uid, userId] : [userId, uid]
    await supabase.from('friendships').insert({
      user_a_id: a, user_b_id: b, requester_id: uid, status: 'pending'
    })
    setSearchResults([])
    setSearchQuery('')
    fetchFriendships()
  }

  async function acceptRequest(friendshipId) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    fetchFriendships()
  }

  async function declineRequest(friendshipId) {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    fetchFriendships()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="anim-scale">
        <h1 className="text-3xl font-extrabold text-white">Friends</h1>
        <p className="text-white/50 text-sm mt-0.5">Find people & see their recommendations</p>
      </div>

      {/* Search */}
      <div className="anim-up">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2"/>
            <path d="m21 21-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => search(e.target.value)}
            placeholder="Search by username…"
            className="input-glass pl-10"
          />
        </div>

        {searchResults.length > 0 && (
          <div className="glass rounded-2xl mt-2 overflow-hidden">
            {searchResults.map(u => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3 border-b border-white/10 last:border-0">
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={u.display_name || u.username} size="sm" />
                  <div>
                    <p className="text-sm font-bold text-white">{u.display_name || u.username}</p>
                    <p className="text-xs text-white/50">@{u.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => sendRequest(u.id)}
                  className="btn-press text-xs font-bold px-4 py-1.5 rounded-full text-[#040C21]"
                  style={{ background: 'white' }}
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <section className="anim-up">
          <SectionLabel>Requests · {incoming.length}</SectionLabel>
          <div className="space-y-2 mt-3">
            {incoming.map(f => (
              <div key={f.id} className="glass rounded-2xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={f.friend?.display_name || f.friend?.username} />
                  <div>
                    <p className="text-sm font-bold text-white">{f.friend?.display_name || f.friend?.username}</p>
                    <p className="text-xs text-white/50">@{f.friend?.username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => acceptRequest(f.id)}
                    className="btn-press text-xs font-bold px-3 py-1.5 rounded-full text-[#040C21]"
                    style={{ background: 'white' }}>
                    Accept
                  </button>
                  <button onClick={() => declineRequest(f.id)}
                    className="btn-press text-xs font-semibold px-3 py-1.5 rounded-full text-white/70 border border-white/20">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friends list */}
      <section>
        <SectionLabel>Friends {friends.length > 0 && `· ${friends.length}`}</SectionLabel>
        {loading ? (
          <p className="text-white/40 text-sm mt-3">Loading…</p>
        ) : friends.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-center mt-3">
            <p className="text-3xl mb-2">👋</p>
            <p className="text-white/60 text-sm">No friends yet — search above to add someone.</p>
          </div>
        ) : (
          <div className="space-y-2 mt-3">
            {friends.map((f, i) => (
              <div key={f.id} className={`glass rounded-2xl px-4 py-3 flex items-center justify-between anim-up`}
                style={{ animationDelay: `${i * 50}ms` }}>
                <button
                  onClick={() => navigate(`/profile/${f.friend.id}`)}
                  className="flex items-center gap-3 text-left"
                >
                  <InitialsAvatar name={f.friend?.display_name || f.friend?.username} />
                  <div>
                    <p className="text-sm font-bold text-white">{f.friend?.display_name || f.friend?.username}</p>
                    <p className="text-xs text-white/50">@{f.friend?.username}</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate(`/list/${f.friend.id}`)}
                  className="btn-press text-xs font-bold px-4 py-1.5 rounded-full border border-white/30 text-white"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                >
                  View list
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending sent */}
      {pending.length > 0 && (
        <section>
          <SectionLabel>Sent requests</SectionLabel>
          <div className="space-y-2 mt-3">
            {pending.map(f => (
              <div key={f.id} className="glass rounded-2xl px-4 py-3 flex items-center gap-3 opacity-50">
                <InitialsAvatar name={f.friend?.display_name || f.friend?.username} />
                <div>
                  <p className="text-sm font-bold text-white">{f.friend?.display_name || f.friend?.username}</p>
                  <p className="text-xs text-white/50">Pending…</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-white/50 text-xs font-bold uppercase tracking-widest">{children}</p>
  )
}
