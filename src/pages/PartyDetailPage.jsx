/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ScreenHeader } from '../lib/queuedDesign'
import { InitialsAvatar } from '../components/Layout'
import {
  addToPartyList,
  buildPartyInviteLink,
  castVote,
  finishPickedItem,
  getCurrentPicker,
  getMyLogItems,
  getOverlapSuggestions,
  getParty,
  getPartyInviteCandidates,
  inviteFriendToParty,
  pickItem,
} from '../lib/parties'

export default function PartyDetailPage() {
  const { partyId } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [party, setParty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pickingId, setPickingId] = useState(null)
  const [finishingId, setFinishingId] = useState(null)
  const [votingId, setVotingId] = useState(null)
  const [shareStatus, setShareStatus] = useState('')
  const [showInviteFriends, setShowInviteFriends] = useState(false)
  const [inviteCandidates, setInviteCandidates] = useState([])
  const [invitingId, setInvitingId] = useState(null)
  const [inviteError, setInviteError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addTab, setAddTab] = useState('queue')
  const [logItems, setLogItems] = useState([])
  const [overlapItems, setOverlapItems] = useState([])
  const [addingId, setAddingId] = useState(null)
  const [addError, setAddError] = useState('')
  const [pickError, setPickError] = useState('')
  const [showWatched, setShowWatched] = useState(false)

  const uid = session?.user?.id

  useEffect(() => { if (partyId) fetchParty() }, [partyId])

  async function fetchParty() {
    setLoading(true)
    try {
      const data = await getParty(partyId)
      setParty(data)
    } catch {
      navigate('/parties', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  async function handleOpenAdd() {
    setShowAdd(true)
    setAddError('')
    fetchAddItems()
  }

  async function fetchAddItems() {
    try {
      const [q, o] = await Promise.all([
        getMyLogItems(partyId, uid),
        getOverlapSuggestions(partyId),
      ])
      setLogItems(q)
      setOverlapItems(o)
    } catch {
      // silently empty
    }
  }

  async function handleToggleInviteFriends() {
    const next = !showInviteFriends
    setShowInviteFriends(next)
    setInviteError('')
    if (!next) return
    try {
      const candidates = await getPartyInviteCandidates(partyId, uid)
      setInviteCandidates(candidates)
    } catch (err) {
      setInviteError(err.message ?? 'Could not load friends')
    }
  }

  async function handleInviteFriend(friendId) {
    setInvitingId(friendId)
    setInviteError('')
    try {
      await inviteFriendToParty(partyId, friendId)
      await fetchParty()
      const candidates = await getPartyInviteCandidates(partyId, uid)
      setInviteCandidates(candidates)
    } catch (err) {
      setInviteError(err.message ?? 'Could not add friend')
    } finally {
      setInvitingId(null)
    }
  }

  async function handleAdd(mediaItem) {
    const key = `${mediaItem.media_type}:${mediaItem.media_id}`
    setAddingId(key)
    setAddError('')
    try {
      await addToPartyList(partyId, mediaItem, uid)
      await fetchParty()
      await fetchAddItems()
    } catch (err) {
      if (err.code === '23505') {
        setAddError('Already on the list')
      } else {
        setAddError(err.message ?? 'Could not add item')
      }
    } finally {
      setAddingId(null)
    }
  }

  async function handleVote(item, isUp) {
    setVotingId(item.id)
    // Optimistic update
    setParty(prev => {
      if (!prev) return prev
      return {
        ...prev,
        party_list_items: prev.party_list_items.map(i => {
          if (i.id !== item.id) return i
          const filtered = (i.party_votes ?? []).filter(v => v.user_id !== uid)
          const newVotes = isUp === null ? filtered : [...filtered, { user_id: uid, vote: isUp, party_item_id: i.id, party_id: partyId }]
          return { ...i, party_votes: newVotes }
        }),
      }
    })
    try {
      await castVote(item.id, partyId, uid, isUp)
    } catch {
      await fetchParty()
    } finally {
      setVotingId(null)
    }
  }

  async function handlePick(itemId) {
    setPickingId(itemId)
    setPickError('')
    try {
      await pickItem(itemId)
      await fetchParty()
    } catch (err) {
      setPickError(err.message ?? 'Could not pick item')
    } finally {
      setPickingId(null)
    }
  }

  async function handleFinish(itemId) {
    setFinishingId(itemId)
    setPickError('')
    try {
      await finishPickedItem(itemId)
      await fetchParty()
    } catch (err) {
      setPickError(err.message ?? 'Could not mark finished')
    } finally {
      setFinishingId(null)
    }
  }

  async function handleShareInvite() {
    if (!party?.invite_token) return
    setShareStatus('Copying…')
    const link = buildPartyInviteLink(party.invite_token)
    try {
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
      setShareStatus('Copied')
    } catch {
      setShareStatus('Failed')
    }
    window.setTimeout(() => setShareStatus(''), 1800)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-[rgba(214,240,224,0.4)]">Loading…</p>
      </div>
    )
  }

  if (!party) return null

  const members = party.party_members ?? []
  const allItems = party.party_list_items ?? []
  const unwatched = allItems.filter(i => i.status === 'unwatched').sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const picked = allItems.filter(i => i.status === 'picked').sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const watched = allItems.filter(i => i.status === 'watched').sort((a, b) => new Date(b.watched_at) - new Date(a.watched_at))
  const currentPicker = getCurrentPicker(members, watched.length)
  const isMyTurn = currentPicker?.user_id === uid
  const activePick = picked[0] ?? null
  const activePicker = activePick ? members.find(m => m.user_id === activePick.picked_by) : null
  const canFinishActivePick = activePick?.picked_by === uid

  return (
    <div className="pb-5">
      <ScreenHeader title={party.name} subtitle={`${members.length} ${members.length === 1 ? 'member' : 'members'}`} />

      <div className="space-y-5 px-[18px]">

        {/* Members + share */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            {members.slice(0, 6).map(m => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => navigate(`/profile/${m.user_id}`)}
                title={m.user?.display_name || m.user?.username}
              >
                <InitialsAvatar name={m.user?.display_name || m.user?.username || '?'} size="sm" />
              </button>
            ))}
            {members.length > 6 && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(150,214,180,0.2)] bg-[rgba(9,46,32,0.7)] text-[10px] font-bold text-[rgba(214,240,224,0.6)]">
                +{members.length - 6}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleToggleInviteFriends}
              className="btn-press rounded-full border border-[rgba(150,214,180,0.2)] bg-[rgba(9,46,32,0.6)] px-3 py-2 text-xs font-bold text-[rgba(214,240,224,0.78)]"
            >
              Friends
            </button>
            <button
              type="button"
              onClick={handleShareInvite}
              className="btn-press rounded-full bg-[#F4E9D1] px-4 py-2 text-xs font-extrabold text-[#052016]"
            >
              {shareStatus || 'Share invite'}
            </button>
          </div>
        </div>

        {showInviteFriends && (
          <section className="overflow-hidden rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)]">
            <div className="border-b border-[rgba(150,214,180,0.12)] px-4 py-3">
              <p className="text-sm font-bold text-[#F7F1E4]">Invite friends</p>
              <p className="mt-0.5 text-xs text-[rgba(214,240,224,0.45)]">Add accepted friends directly to this party.</p>
            </div>
            {inviteError && <p className="px-4 pt-3 text-xs text-rose-300">{inviteError}</p>}
            {inviteCandidates.length === 0 ? (
              <p className="px-4 py-5 text-sm text-[rgba(214,240,224,0.4)]">No friends left to add.</p>
            ) : (
              inviteCandidates.map(friend => (
                <FriendInviteRow
                  key={friend.id}
                  friend={friend}
                  inviting={invitingId === friend.id}
                  onInvite={() => handleInviteFriend(friend.id)}
                />
              ))
            )}
          </section>
        )}

        {/* Rotation badge */}
        {members.length > 1 && !activePick && (
          <div className="rounded-[14px] border border-[rgba(216,168,74,0.2)] bg-[rgba(216,168,74,0.08)] px-4 py-2.5">
            {isMyTurn ? (
              <p className="text-sm font-bold text-[#D8A84A]">Your pick — choose something from the list below</p>
            ) : (
              <p className="text-sm text-[rgba(214,240,224,0.6)]">
                <span className="font-bold text-[#F7F1E4]">
                  {currentPicker?.user?.display_name || currentPicker?.user?.username || 'Someone'}
                </span>
                {' '}is picking next
              </p>
            )}
          </div>
        )}

        {activePick && (
          <WinnerCard
            item={activePick}
            pickerName={activePicker?.user?.display_name || activePicker?.user?.username || 'Someone'}
            canFinish={canFinishActivePick}
            finishing={finishingId === activePick.id}
            onFinish={() => handleFinish(activePick.id)}
          />
        )}

        {/* Pick error */}
        {pickError && (
          <p className="rounded-[14px] border border-rose-300/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
            {pickError}
          </p>
        )}

        {/* Unwatched list */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[rgba(214,240,224,0.45)]">
              Up for grabs · {unwatched.length}
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="btn-press flex items-center gap-1 rounded-full border border-[rgba(150,214,180,0.2)] bg-[rgba(9,46,32,0.6)] px-3 py-1.5 text-xs font-bold text-[rgba(214,240,224,0.7)]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              Add
            </button>
          </div>

          {unwatched.length === 0 ? (
            <div className="rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] px-4 py-6 text-center">
              <p className="text-sm text-[rgba(214,240,224,0.4)]">Nothing on the list yet. Add something!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {unwatched.map(item => (
                <PartyListItem
                  key={item.id}
                  item={item}
                  members={members}
                  uid={uid}
                  canPick={isMyTurn && !activePick}
                  pickingId={pickingId}
                  votingId={votingId}
                  onVote={handleVote}
                  onPick={handlePick}
                />
              ))}
            </div>
          )}
        </section>

        {/* Add items panel */}
        {showAdd && (
          <section className="rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[rgba(150,214,180,0.12)] px-4 py-3">
              <p className="text-sm font-bold text-[#F7F1E4]">Add to party list</p>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setAddError('') }}
                className="text-[rgba(214,240,224,0.5)] text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex border-b border-[rgba(150,214,180,0.12)]">
              {[['queue', 'My log'], ['overlap', 'Member overlap']].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAddTab(key)}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors ${addTab === key ? 'text-[#F4E9D1] border-b-2 border-[#D8A84A]' : 'text-[rgba(214,240,224,0.5)]'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {addError && (
              <p className="px-4 pt-3 text-xs text-rose-300">{addError}</p>
            )}

            <div className="max-h-64 overflow-y-auto">
              {addTab === 'queue' ? (
                logItems.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-[rgba(214,240,224,0.4)]">Nothing in your log that isn't already on the list.</p>
                ) : (
                  logItems.map(item => (
                    <AddItem
                      key={`${item.media_type}:${item.media_id}`}
                      item={item}
                      addingId={addingId}
                      onAdd={handleAdd}
                    />
                  ))
                )
              ) : (
                overlapItems.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-[rgba(214,240,224,0.4)]">No overlap found yet.</p>
                ) : (
                  overlapItems.map(item => (
                    <AddItem
                      key={`${item.media_type}:${item.media_id}`}
                      item={item}
                      addingId={addingId}
                      onAdd={handleAdd}
                      badge={`${item.member_count} members logged this`}
                    />
                  ))
                )
              )}
            </div>
          </section>
        )}

        {/* Watched history */}
        {watched.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowWatched(v => !v)}
              className="mb-2 flex w-full items-center justify-between"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[rgba(214,240,224,0.45)]">
                Watched · {watched.length}
              </p>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className={`text-[rgba(214,240,224,0.4)] transition-transform ${showWatched ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showWatched && (
              <div className="overflow-hidden rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)]">
                {watched.map((item, i) => {
                  const picker = members.find(m => m.user_id === item.picked_by)
                  const pickerName = picker?.user?.display_name || picker?.user?.username || 'Someone'
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-[rgba(150,214,180,0.12)]' : ''}`}
                    >
                      {item.media_poster_url ? (
                        <img src={item.media_poster_url} alt="" className="h-10 w-7 shrink-0 rounded object-cover opacity-60" />
                      ) : (
                        <div className="h-10 w-7 shrink-0 rounded bg-[rgba(150,214,180,0.1)]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[rgba(247,241,228,0.7)]">{item.media_title}</p>
                        <p className="text-[11px] text-[rgba(214,240,224,0.4)]">Picked by {pickerName}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold text-[#2DD48F]">✓</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function PartyListItem({ item, members, uid, canPick, pickingId, votingId, onVote, onPick }) {
  const votes = item.party_votes ?? []
  const upvotes = votes.filter(v => v.vote === true)
  const myVote = votes.find(v => v.user_id === uid)
  const memberCount = members.length
  const majorityReached = upvotes.length >= Math.ceil(memberCount / 2)
  const isPicking = pickingId === item.id
  const isVoting = votingId === item.id

  function handleVoteClick(isUp) {
    if (isVoting) return
    if (myVote?.vote === isUp) {
      onVote(item, null)
    } else {
      onVote(item, isUp)
    }
  }

  return (
    <div className={`overflow-hidden rounded-[18px] border transition-colors ${
      majorityReached
        ? 'border-[rgba(45,212,143,0.35)] bg-[rgba(45,212,143,0.06)] shadow-[inset_3px_0_0_rgba(45,212,143,0.4)]'
        : 'border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)]'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {item.media_poster_url ? (
          <img src={item.media_poster_url} alt="" className="h-12 w-8 shrink-0 rounded object-cover" />
        ) : (
          <div className="h-12 w-8 shrink-0 rounded bg-[rgba(150,214,180,0.1)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#F7F1E4]">{item.media_title}</p>
          {item.media_creator && (
            <p className="truncate text-xs text-[rgba(214,240,224,0.5)]">{item.media_creator}</p>
          )}
          <p className="text-[11px] text-[rgba(214,240,224,0.4)]">
            Added by {members.find(m => m.user_id === item.added_by)?.user?.display_name
              || members.find(m => m.user_id === item.added_by)?.user?.username
              || 'a member'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[rgba(150,214,180,0.1)] px-4 py-2">
        {/* Vote buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isVoting}
            onClick={() => handleVoteClick(true)}
            className={`btn-press flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              myVote?.vote === true
                ? 'bg-[rgba(45,212,143,0.2)] text-[#2DD48F]'
                : 'border border-[rgba(150,214,180,0.2)] text-[rgba(214,240,224,0.6)]'
            }`}
          >
            👍 {upvotes.length}
          </button>
          <button
            type="button"
            disabled={isVoting}
            onClick={() => handleVoteClick(false)}
            className={`btn-press flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              myVote?.vote === false
                ? 'bg-[rgba(201,107,75,0.2)] text-[#C96B4B]'
                : 'border border-[rgba(150,214,180,0.2)] text-[rgba(214,240,224,0.6)]'
            }`}
          >
            👎
          </button>
          {memberCount > 1 && (
            <span className={`text-[11px] font-semibold ${majorityReached ? 'text-[#2DD48F]' : 'text-[rgba(214,240,224,0.35)]'}`}>
              {upvotes.length}/{memberCount}
              {majorityReached && ' ✓'}
            </span>
          )}
        </div>

        {/* Pick buttons */}
        <div className="flex items-center gap-2">
          {canPick && majorityReached && (
            <button
              type="button"
              disabled={isPicking}
              onClick={() => onPick(item.id)}
              className="btn-press rounded-full bg-[#2DD48F] px-4 py-1.5 text-xs font-extrabold text-[#052016] disabled:opacity-50"
            >
              {isPicking ? '…' : 'Pick this'}
            </button>
          )}
          {canPick && !majorityReached && (
            <button
              type="button"
              disabled={isPicking}
              onClick={() => onPick(item.id)}
              className="btn-press rounded-full border border-[rgba(216,168,74,0.4)] bg-[rgba(216,168,74,0.12)] px-4 py-1.5 text-xs font-extrabold text-[#D8A84A] disabled:opacity-50"
            >
              {isPicking ? '…' : 'My pick'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function WinnerCard({ item, pickerName, canFinish, finishing, onFinish }) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-[rgba(216,168,74,0.32)] bg-[rgba(216,168,74,0.1)]">
      <div className="border-b border-[rgba(216,168,74,0.16)] px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[#D8A84A]">Winner</p>
      </div>
      <div className="flex items-center gap-3 px-4 py-4">
        {item.media_poster_url ? (
          <img src={item.media_poster_url} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />
        ) : (
          <div className="h-16 w-11 shrink-0 rounded bg-[rgba(150,214,180,0.1)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold text-[#F7F1E4]">{item.media_title}</p>
          {item.media_creator && <p className="truncate text-xs text-[rgba(214,240,224,0.55)]">{item.media_creator}</p>}
          <p className="mt-1 text-[11px] text-[rgba(214,240,224,0.45)]">Picked by {pickerName}</p>
        </div>
        {canFinish ? (
          <button
            type="button"
            disabled={finishing}
            onClick={onFinish}
            className="btn-press shrink-0 rounded-full bg-[#F4E9D1] px-4 py-2 text-xs font-extrabold text-[#052016] disabled:opacity-50"
          >
            {finishing ? 'Saving...' : 'Finished'}
          </button>
        ) : (
          <span className="shrink-0 rounded-full border border-[rgba(216,168,74,0.24)] px-3 py-1.5 text-xs font-bold text-[#D8A84A]">
            Picked
          </span>
        )}
      </div>
    </section>
  )
}

function AddItem({ item, addingId, onAdd, badge }) {
  const key = `${item.media_type}:${item.media_id}`
  const isAdding = addingId === key

  return (
    <div className="flex items-center gap-3 border-t border-[rgba(150,214,180,0.1)] px-4 py-3 first:border-t-0">
      {item.media_poster_url ? (
        <img src={item.media_poster_url} alt="" className="h-10 w-7 shrink-0 rounded object-cover" />
      ) : (
        <div className="h-10 w-7 shrink-0 rounded bg-[rgba(150,214,180,0.1)]" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#F7F1E4]">{item.media_title}</p>
        {badge && <p className="text-[11px] text-[#2DD48F]">{badge}</p>}
      </div>
      <button
        type="button"
        disabled={isAdding}
        onClick={() => onAdd(item)}
        className="btn-press shrink-0 rounded-full bg-[#F4E9D1] px-3 py-1.5 text-xs font-extrabold text-[#052016] disabled:opacity-50"
      >
        {isAdding ? '…' : 'Add'}
      </button>
    </div>
  )
}

function FriendInviteRow({ friend, inviting, onInvite }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[rgba(150,214,180,0.1)] px-4 py-3 first:border-t-0">
      <div className="flex min-w-0 items-center gap-3">
        <InitialsAvatar name={friend.display_name || friend.username} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#F7F1E4]">{friend.display_name || friend.username}</p>
          <p className="truncate text-xs text-[rgba(214,240,224,0.5)]">@{friend.username}</p>
        </div>
      </div>
      <button
        type="button"
        disabled={inviting}
        onClick={onInvite}
        className="btn-press shrink-0 rounded-full bg-[#F4E9D1] px-3 py-1.5 text-xs font-extrabold text-[#052016] disabled:opacity-50"
      >
        {inviting ? 'Adding...' : 'Add'}
      </button>
    </div>
  )
}
