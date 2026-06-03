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
      <div>
        <input
          type="text"
          value={searchQuery}
          onChange={e => search(e.target.value)}
          placeholder="Search by username…"
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {searchResults.length > 0 && (
          <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {searchResults.map(u => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={u.display_name || u.username} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{u.display_name || u.username}</p>
                    <p className="text-xs text-gray-400">@{u.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => sendRequest(u.id)}
                  className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-full hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {incoming.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Requests ({incoming.length})
          </h2>
          <div className="space-y-2">
            {incoming.map(f => (
              <div key={f.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={f.friend?.display_name || f.friend?.username} />
                  <div>
                    <p className="text-sm font-medium">{f.friend?.display_name || f.friend?.username}</p>
                    <p className="text-xs text-gray-400">@{f.friend?.username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => acceptRequest(f.id)} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-full hover:bg-indigo-700">Accept</button>
                  <button onClick={() => declineRequest(f.id)} className="text-xs text-gray-500 border border-gray-300 px-3 py-1 rounded-full hover:bg-gray-50">Decline</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Friends {friends.length > 0 && `(${friends.length})`}
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-gray-400">No friends yet — search above to add someone.</p>
        ) : (
          <div className="space-y-2">
            {friends.map(f => (
              <div key={f.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <button
                  onClick={() => navigate(`/profile/${f.friend.id}`)}
                  className="flex items-center gap-3 text-left"
                >
                  <InitialsAvatar name={f.friend?.display_name || f.friend?.username} />
                  <div>
                    <p className="text-sm font-medium">{f.friend?.display_name || f.friend?.username}</p>
                    <p className="text-xs text-gray-400">@{f.friend?.username}</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate(`/list/${f.friend.id}`)}
                  className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full hover:bg-indigo-100"
                >
                  View list
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Sent requests</h2>
          <div className="space-y-2">
            {pending.map(f => (
              <div key={f.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 opacity-60">
                <InitialsAvatar name={f.friend?.display_name || f.friend?.username} />
                <div>
                  <p className="text-sm font-medium">{f.friend?.display_name || f.friend?.username}</p>
                  <p className="text-xs text-gray-400">Pending</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
