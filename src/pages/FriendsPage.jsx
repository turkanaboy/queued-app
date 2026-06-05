import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { InitialsAvatar } from '../components/Layout'
import { EmptyState, PageHeader, SectionTitle } from '../components/DesignPrimitives'

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
    <div className="space-y-6 pb-4">
      <PageHeader title="Friends" subtitle="Find people, accept requests, and jump into shared lists." />

      <div className="anim-up space-y-2">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D6F0E0]/50" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => search(e.target.value)}
            placeholder="Search by username…"
            className="input-glass input-search"
          />
        </div>

        {searchResults.length > 0 && (
          <div className="q-panel-spine overflow-hidden rounded-[18px]">
            {searchResults.map((u, i) => (
              <div key={u.id} className={`q-row flex items-center gap-3 px-3.5 py-3 ${i === 0 ? '' : ''}`}>
                <InitialsAvatar name={u.display_name || u.username} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#F7F1E4]">{u.display_name || u.username}</p>
                  <p className="font-mono text-[11px] text-[#D6F0E0]/50">@{u.username}</p>
                </div>
                <button onClick={() => sendRequest(u.id)} className="btn-press btn-cream rounded-full px-4 py-1.5 text-xs font-extrabold">
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {incoming.length > 0 && (
        <section className="anim-up">
          <SectionTitle count={incoming.length}>Requests</SectionTitle>
          <div className="space-y-2">
            {incoming.map(f => (
              <div key={f.id} className="flex items-center gap-3 rounded-[18px] border border-[#2DD48F]/25 bg-[#2DD48F]/[0.08] px-3.5 py-3 shadow-[inset_2px_0_0_rgba(45,212,143,0.5)]">
                <InitialsAvatar name={f.friend?.display_name || f.friend?.username} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#F7F1E4]">{f.friend?.display_name || f.friend?.username}</p>
                  <p className="font-mono text-[11px] text-[#D6F0E0]/50">@{f.friend?.username}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => declineRequest(f.id)} className="btn-press rounded-full border border-[#96D6B4]/20 bg-[#092E20]/70 px-3 py-1.5 text-xs font-bold text-[#D6F0E0]/70">
                    Decline
                  </button>
                  <button onClick={() => acceptRequest(f.id)} className="btn-press btn-cream rounded-full px-3 py-1.5 text-xs font-extrabold">
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="anim-up">
        <SectionTitle count={friends.length}>Your friends</SectionTitle>
        {loading ? (
          <p className="text-sm text-[#D6F0E0]/45">Loading…</p>
        ) : friends.length === 0 ? (
          <EmptyState title="No friends yet" body="Search for someone by username to add them." />
        ) : (
          <div className="q-panel-spine overflow-hidden rounded-[18px]">
            {friends.map(f => (
              <div key={f.id} className="q-row flex items-center gap-3 px-3.5 py-3">
                <button onClick={() => navigate(`/profile/${f.friend.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <InitialsAvatar name={f.friend?.display_name || f.friend?.username} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#F7F1E4]">{f.friend?.display_name || f.friend?.username}</p>
                    <p className="font-mono text-[11px] text-[#D6F0E0]/50">@{f.friend?.username}</p>
                  </div>
                </button>
                <button onClick={() => navigate(`/list/${f.friend.id}`)} className="btn-press rounded-full border border-[#96D6B4]/20 bg-[#092E20]/70 px-4 py-1.5 text-xs font-bold text-[#F7F1E4]">
                  List
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {pending.length > 0 && (
        <section className="anim-up">
          <SectionTitle>Sent requests</SectionTitle>
          <div className="space-y-2">
            {pending.map(f => (
              <div key={f.id} className="q-panel flex items-center gap-3 rounded-2xl px-3.5 py-3 opacity-65">
                <InitialsAvatar name={f.friend?.display_name || f.friend?.username} size="sm" />
                <div>
                  <p className="text-sm font-bold text-[#F7F1E4]">{f.friend?.display_name || f.friend?.username}</p>
                  <p className="font-mono text-[11px] text-[#D6F0E0]/50">Pending…</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
