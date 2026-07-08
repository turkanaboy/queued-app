/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTriviaChallenges } from '../hooks/useTriviaChallenges'
import { InitialsAvatar } from '../components/Layout'
import { EmptyState, ScreenHeader, SearchField, SectionTitle } from '../lib/queuedDesign'
import { buildInviteLink, getOrCreateInviteToken } from '../lib/invites'
import TriviaSetupSheet from '../components/TriviaSetupSheet'

export default function FriendsPage() {
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [friends, setFriends] = useState([])
  const [pending, setPending] = useState([])
  const [incoming, setIncoming] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteStatus, setInviteStatus] = useState('')
  const [friendError, setFriendError] = useState('')
  const [triviaSheetOpen, setTriviaSheetOpen] = useState(false)

  const { pendingChallenges, waitingChallenges } = useTriviaChallenges()
  const uid = session?.user?.id

  useEffect(() => { fetchFriendships() }, [session])

  async function fetchFriendships() {
    const uid = session.user.id
    const { data } = await supabase
      .from('friendships')
      .select('*, user_a:users!friendships_user_a_id_fkey(id, username, display_name), user_b:users!friendships_user_b_id_fkey(id, username, display_name)')
      .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`)
    const accepted = [], pendingOut = [], pendingIn = []
    for (const f of data ?? []) {
      const friend = f.user_a_id === uid ? f.user_b : f.user_a
      if (!friend?.username && !friend?.display_name) continue
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
    setFriendError('')
    const { error } = await supabase
      .from('friendships')
      .upsert({ user_a_id: a, user_b_id: b, requester_id: uid, status: 'pending' }, { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: true })

    if (error) {
      setFriendError(error.message)
      return
    }

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

  async function copyInviteLink() {
    setInviteStatus('Copying...')
    try {
      const token = await getOrCreateInviteToken(session.user.id)
      const link = buildInviteLink(token)
      try {
        await navigator.clipboard.writeText(link)
      } catch {
        const el = document.createElement('textarea')
        el.value = link
        el.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
        document.body.appendChild(el)
        el.focus()
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      setInviteStatus('Copied')
    } catch {
      setInviteStatus('Copy failed')
    }
    window.setTimeout(() => setInviteStatus(''), 1800)
  }

  return (
    <div className="pb-5">
      <ScreenHeader title="Friends" subtitle="Find people and see their recommendations" />
      <div className="space-y-5 px-[18px]">
        <button
          type="button"
          onClick={() => navigate('/parties')}
          className="btn-press w-full rounded-[18px] border border-[rgba(45,212,143,0.22)] bg-[linear-gradient(135deg,rgba(45,212,143,0.12),rgba(216,168,74,0.06))] p-4 text-left shadow-[inset_3px_0_0_rgba(45,212,143,0.38)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-[#F7F1E4]">Groups</p>
              <p className="mt-0.5 text-xs text-[rgba(214,240,224,0.58)]">
                Shared lists for curating together.
              </p>
            </div>
            <svg className="shrink-0 text-[rgba(214,240,224,0.4)]" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>

        <section className="rounded-[18px] border border-[rgba(216,168,74,0.26)] bg-[linear-gradient(135deg,rgba(216,168,74,0.16),rgba(45,212,143,0.08))] p-4 shadow-[inset_3px_0_0_rgba(216,168,74,0.48)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-[#F7F1E4]">Invite a friend</p>
              <p className="mt-0.5 truncate text-xs text-[rgba(214,240,224,0.58)]">
                They will join connected to {profile?.display_name || profile?.username}.
              </p>
            </div>
            <button
              type="button"
              onClick={copyInviteLink}
              className="btn-press shrink-0 rounded-full bg-[#F4E9D1] px-4 py-2 text-xs font-extrabold text-[#052016]"
            >
              {inviteStatus || 'Copy link'}
            </button>
          </div>
        </section>

        <div className="relative">
          <SearchField value={searchQuery} onChange={search} placeholder="Search by username..." />
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-10 overflow-hidden rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.96)] shadow-[inset_3px_0_0_rgba(184,115,51,0.62),0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur">
              {searchResults.map(u => (
                <div key={u.id} className="flex items-center justify-between border-t border-[rgba(150,214,180,0.12)] px-4 py-3 first:border-t-0">
                  <button onClick={() => navigate(`/profile/${u.id}`)} className="flex min-w-0 items-center gap-3 text-left">
                    <InitialsAvatar name={u.display_name || u.username} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#F7F1E4]">{u.display_name || u.username}</p>
                      <p className="truncate text-xs text-[rgba(214,240,224,0.5)]">@{u.username}</p>
                    </div>
                  </button>
                  <button onClick={() => sendRequest(u.id)} className="btn-press btn-cream rounded-full px-4 py-1.5 text-xs font-bold">Add</button>
                </div>
              ))}
            </div>
          )}
          {friendError && <p className="mt-2 rounded-[14px] border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{friendError}</p>}
        </div>

        {incoming.length > 0 && (
          <section>
            <SectionTitle count={incoming.length}>Incoming requests</SectionTitle>
            <div className="overflow-hidden rounded-[18px] border border-[#2DD48F]/25 bg-[#2DD48F]/10 shadow-[inset_2px_0_0_rgba(45,212,143,0.5)]">
              {incoming.map((f, i) => <FriendRequestRow key={f.id} item={f} first={i === 0} onAccept={acceptRequest} onDecline={declineRequest} />)}
            </div>
          </section>
        )}

        {/* Trivia challenge cards — pending (your turn) */}
        {pendingChallenges.length > 0 && (
          <section>
            <SectionTitle count={pendingChallenges.length}>Trivia challenges</SectionTitle>
            <div className="overflow-hidden rounded-[18px] border border-[#D8A84A]/30 bg-[rgba(216,168,74,0.07)] shadow-[inset_3px_0_0_rgba(216,168,74,0.45)]">
              {pendingChallenges.map((c, i) => {
                const isInitiator = c.initiator_id === uid
                const opponent = isInitiator ? c.challenger : c.initiator
                const label = isInitiator ? 'You challenged' : 'Challenged you'
                return (
                  <div key={c.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-[rgba(216,168,74,0.15)]' : ''}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <InitialsAvatar name={opponent?.display_name || opponent?.username} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#F7F1E4]">{opponent?.display_name || opponent?.username}</p>
                        <p className="text-[11px] font-semibold text-[#D8A84A]">🎯 {label} · {c.mode}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/trivia/${c.id}`)}
                      className="btn-press btn-cream shrink-0 rounded-full px-4 py-1.5 text-xs font-extrabold"
                    >
                      {isInitiator ? 'Answer' : 'Play'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Trivia challenge cards — waiting on opponent */}
        {waitingChallenges.length > 0 && (
          <section className="opacity-70">
            <SectionTitle count={waitingChallenges.length}>Awaiting response</SectionTitle>
            <div className="overflow-hidden rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.45)]">
              {waitingChallenges.map((c, i) => {
                const opponent = c.challenger
                return (
                  <div key={c.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-[rgba(150,214,180,0.12)]' : ''}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <InitialsAvatar name={opponent?.display_name || opponent?.username} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#F7F1E4]">{opponent?.display_name || opponent?.username}</p>
                        <p className="text-[11px] text-[rgba(214,240,224,0.5)]">⏳ Trivia sent · waiting…</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/trivia/${c.id}`)}
                      className="btn-press shrink-0 rounded-full border border-[rgba(150,214,180,0.2)] bg-[rgba(9,46,32,0.55)] px-4 py-1.5 text-xs font-bold text-[rgba(214,240,224,0.7)]"
                    >
                      View
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section>
          <SectionTitle count={friends.length}>Friends</SectionTitle>
          {loading ? <p className="text-sm text-white/40">Loading...</p> : friends.length === 0 ? (
            <div className="rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] shadow-[inset_3px_0_0_rgba(184,115,51,0.62)]">
              <EmptyState title="No friends yet" body="Search above to add someone." />
            </div>
          ) : (
            <div className="overflow-hidden rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] shadow-[inset_3px_0_0_rgba(184,115,51,0.62)]">
              {friends.map((f, i) => (
                <FriendRow
                  key={f.id}
                  item={f}
                  first={i === 0}
                  onProfile={() => navigate(`/profile/${f.friend.id}`)}
                  onList={() => navigate(`/list/${f.friend.id}`)}
                  onChallenge={() => setTriviaSheetOpen(f)}
                />
              ))}
            </div>
          )}
        </section>

        {pending.length > 0 && (
          <section className="opacity-65">
            <SectionTitle count={pending.length}>Sent pending</SectionTitle>
            <div className="overflow-hidden rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)]">
              {pending.map((f, i) => <div key={f.id} className={`flex items-center gap-3 px-4 py-3 ${i ? 'border-t border-[rgba(150,214,180,0.12)]' : ''}`}>
                <InitialsAvatar name={f.friend?.display_name || f.friend?.username} />
                <div><p className="text-sm font-bold text-[#F7F1E4]">{f.friend?.display_name || f.friend?.username}</p><p className="text-xs text-[rgba(214,240,224,0.5)]">Pending...</p></div>
              </div>)}
            </div>
          </section>
        )}
      </div>

      {triviaSheetOpen && (
        <TriviaSetupSheet
          initialFriend={typeof triviaSheetOpen === 'object' ? triviaSheetOpen : null}
          onClose={() => setTriviaSheetOpen(false)}
        />
      )}
    </div>
  )
}

function FriendRequestRow({ item, first, onAccept, onDecline }) {
  const friend = item.friend
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${first ? '' : 'border-t border-[rgba(150,214,180,0.12)]'}`}>
      <div className="flex min-w-0 items-center gap-3">
        <InitialsAvatar name={friend?.display_name || friend?.username} />
        <div className="min-w-0"><p className="truncate text-sm font-bold text-[#F7F1E4]">{friend?.display_name || friend?.username}</p><p className="truncate text-xs text-[rgba(214,240,224,0.5)]">@{friend?.username}</p></div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onDecline(item.id)} className="btn-press rounded-full border border-[rgba(150,214,180,0.16)] px-3 py-1.5 text-xs font-bold text-[rgba(214,240,224,0.7)]">Decline</button>
        <button onClick={() => onAccept(item.id)} className="btn-press btn-cream rounded-full px-3 py-1.5 text-xs font-bold">Accept</button>
      </div>
    </div>
  )
}

function FriendRow({ item, first, onProfile, onList, onChallenge }) {
  const friend = item.friend
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${first ? '' : 'border-t border-[rgba(150,214,180,0.12)]'}`}>
      <button onClick={onProfile} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <InitialsAvatar name={friend?.display_name || friend?.username} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#F7F1E4]">{friend?.display_name || friend?.username}</p>
          <p className="truncate text-xs text-[rgba(214,240,224,0.5)]">@{friend?.username}</p>
        </div>
      </button>
      <div className="flex shrink-0 gap-1.5">
        <button onClick={onChallenge} className="btn-press rounded-full border border-[#D8A84A]/30 bg-[rgba(216,168,74,0.1)] px-3 py-1.5 text-xs font-bold text-[#D8A84A]" title="Trivia challenge">🎯</button>
        <button onClick={onList} className="btn-press rounded-full border border-[rgba(150,214,180,0.16)] bg-[rgba(9,46,32,0.66)] px-4 py-1.5 text-xs font-bold text-[rgba(214,240,224,0.7)]">List</button>
      </div>
    </div>
  )
}
