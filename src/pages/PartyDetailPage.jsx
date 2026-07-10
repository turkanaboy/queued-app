/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Chip, MEDIA, MEDIA_ORDER, ScreenHeader } from '../lib/queuedDesign'
import { InitialsAvatar } from '../components/Layout'
import {
  addToPartyList,
  buildPartyInviteLink,
  castVote,
  deleteParty,
  finishPickedItem,
  getCurrentPicker,
  getMyLogItems,
  getOverlapSuggestions,
  getParty,
  getPartyInviteCandidates,
  inviteFriendToParty,
  leaveParty,
  pickItem,
  removePartyItem,
  removePartyMember,
  renameParty,
} from '../lib/parties'

const GROUP_STATUS_LABELS = { unwatched: 'Active', picked: 'Chosen', watched: 'Done' }

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
  const [showDone, setShowDone] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [voteFilter, setVoteFilter] = useState('all')
  const [loadError, setLoadError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const uid = session?.user?.id

  useEffect(() => { if (partyId) fetchParty() }, [partyId])

  async function fetchParty() {
    setLoading(true)
    setLoadError('')
    try {
      const data = await getParty(partyId)
      setParty(data)
      setGroupName(data.name)
    } catch (error) {
      setLoadError(error.message ?? 'Could not load this group')
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
    } catch (error) {
      setAddError(error.message ?? 'Could not load titles')
    }
  }

  async function handleRename() {
    setSettingsBusy(true)
    setSettingsError('')
    try {
      await renameParty(partyId, groupName)
      await fetchParty()
    } catch (error) {
      setSettingsError(error.message ?? 'Could not rename group')
    } finally {
      setSettingsBusy(false)
    }
  }

  async function handleLeave() {
    setSettingsBusy(true)
    setSettingsError('')
    try {
      await leaveParty(partyId)
      navigate('/parties', { replace: true })
    } catch (error) {
      setSettingsError(error.message ?? 'Could not leave group')
      setSettingsBusy(false)
    }
  }

  async function handleDelete() {
    setSettingsBusy(true)
    setSettingsError('')
    try {
      await deleteParty(partyId)
      navigate('/parties', { replace: true })
    } catch (error) {
      setSettingsError(error.message ?? 'Could not delete group')
      setSettingsBusy(false)
    }
  }

  async function handleRemoveMember(userId) {
    setSettingsBusy(true)
    setSettingsError('')
    try {
      await removePartyMember(partyId, userId)
      await fetchParty()
    } catch (error) {
      setSettingsError(error.message ?? 'Could not remove member')
    } finally {
      setSettingsBusy(false)
    }
  }

  async function handleRemoveItem(itemId) {
    setPickError('')
    try {
      await removePartyItem(itemId)
      await fetchParty()
    } catch (error) {
      setPickError(error.message ?? 'Could not remove item')
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
      setPickError(err.message ?? 'Could not choose item')
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

  if (loadError) {
    return (
      <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center text-rose-200">
        <p>{loadError}</p>
        <div className="flex gap-2">
          <button type="button" onClick={fetchParty} className="btn-press btn-cream rounded-xl px-4 py-2 text-sm font-bold">Retry</button>
          <button type="button" onClick={() => navigate('/parties')} className="btn-press rounded-xl border border-white/20 px-4 py-2 text-sm font-bold">Back to groups</button>
        </div>
      </div>
    )
  }

  if (!party) return null

  const members = party.party_members ?? []
  const allItems = party.party_list_items ?? []
  const activeItems = allItems.filter(i => i.status !== 'watched').sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const picked = allItems.filter(i => i.status === 'picked').sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const watched = allItems.filter(i => i.status === 'watched').sort((a, b) => new Date(b.watched_at) - new Date(a.watched_at))
  const activePick = picked[0] ?? null
  const activePicker = activePick ? members.find(m => m.user_id === activePick.picked_by) : null
  const canFinishActivePick = activePick?.picked_by === uid
  const isRotatingPicker = party.mode === 'rotating_picker'
  const isCreator = party.creator_id === uid
  const currentPicker = isRotatingPicker ? getCurrentPicker(members, watched.length) : null
  const isMyTurn = currentPicker?.user_id === uid
  const filteredItems = activeItems.filter(item => {
    if (typeFilter !== 'all' && item.media_type !== typeFilter) return false
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (voteFilter === 'liked' && !(item.party_votes ?? []).some(v => v.user_id === uid && v.vote === true)) return false
    if (voteFilter === 'unvoted' && (item.party_votes ?? []).some(v => v.user_id === uid)) return false
    return true
  })
  const summary = {
    total: allItems.length,
    active: activeItems.length,
    liked: allItems.filter(i => (i.party_votes ?? []).some(v => v.user_id === uid && v.vote === true)).length,
    done: watched.length,
  }
  const unwatched = filteredItems

  return (
    <div className="pb-5">
      <ScreenHeader title={party.name} subtitle={`${members.length} ${members.length === 1 ? 'member' : 'members'} · ${isRotatingPicker ? 'Rotating picker' : 'Curated list'}`} />

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
                aria-label={`View ${m.user?.display_name || m.user?.username || 'member'} profile`}
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
              onClick={() => { setShowSettings(value => !value); setSettingsError('') }}
              className="btn-press rounded-full border border-[rgba(150,214,180,0.2)] bg-[rgba(9,46,32,0.6)] px-3 py-2 text-xs font-bold text-[rgba(214,240,224,0.78)]"
            >
              Manage
            </button>
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

        {showSettings && (
          <section className="space-y-3 rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] p-4">
            <div>
              <p className="text-sm font-extrabold text-[#F7F1E4]">Group settings</p>
              <p className="mt-0.5 text-xs text-[rgba(214,240,224,0.5)]">{isCreator ? 'Rename, manage members, or delete this group.' : 'You can leave this group at any time.'}</p>
            </div>
            {settingsError && <p role="alert" className="text-xs text-rose-300">{settingsError}</p>}
            {isCreator ? (
              <>
                <div className="flex gap-2">
                  <label className="sr-only" htmlFor="group-name">Group name</label>
                  <input id="group-name" value={groupName} maxLength={60} onChange={event => setGroupName(event.target.value)} className="input-glass min-w-0 flex-1 py-2 text-sm" />
                  <button type="button" disabled={settingsBusy || !groupName.trim()} onClick={handleRename} className="btn-press btn-cream rounded-xl px-3 text-xs font-bold disabled:opacity-50">Save</button>
                </div>
                {members.filter(member => member.user_id !== uid).map(member => (
                  <div key={member.user_id} className="flex items-center justify-between gap-3 border-t border-[rgba(150,214,180,0.12)] pt-3">
                    <span className="truncate text-sm text-[rgba(214,240,224,0.75)]">{member.user?.display_name || member.user?.username}</span>
                    <button type="button" disabled={settingsBusy} onClick={() => handleRemoveMember(member.user_id)} className="btn-press text-xs font-bold text-rose-300 disabled:opacity-50">Remove</button>
                  </div>
                ))}
                {confirmDelete ? (
                  <div className="flex items-center justify-between gap-3 border-t border-rose-300/20 pt-3">
                    <p className="text-xs text-rose-200">Delete this group and its shared list?</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirmDelete(false)} className="btn-press text-xs font-bold text-white/60">Cancel</button>
                      <button type="button" disabled={settingsBusy} onClick={handleDelete} className="btn-press rounded-full bg-rose-500/80 px-3 py-1.5 text-xs font-bold disabled:opacity-50">Delete</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="btn-press text-xs font-bold text-rose-300">Delete group</button>
                )}
              </>
            ) : (
              <button type="button" disabled={settingsBusy} onClick={handleLeave} className="btn-press rounded-full border border-rose-300/30 px-4 py-2 text-xs font-bold text-rose-200 disabled:opacity-50">Leave group</button>
            )}
          </section>
        )}

        {showInviteFriends && (
          <section className="overflow-hidden rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)]">
            <div className="border-b border-[rgba(150,214,180,0.12)] px-4 py-3">
              <p className="text-sm font-bold text-[#F7F1E4]">Invite friends</p>
              <p className="mt-0.5 text-xs text-[rgba(214,240,224,0.45)]">Add accepted friends directly to this group.</p>
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

        <div className="grid grid-cols-4 gap-2">
          <StatPill value={summary.total} label="Total" />
          <StatPill value={summary.active} label="Active" />
          <StatPill value={summary.liked} label="Liked" />
          <StatPill value={summary.done} label="Done" />
        </div>

        {isRotatingPicker && members.length > 1 && !activePick && (
          <div className="rounded-[14px] border border-[rgba(216,168,74,0.2)] bg-[rgba(216,168,74,0.08)] px-4 py-2.5">
            {isMyTurn ? (
              <p className="text-sm font-bold text-[#D8A84A]">Your turn to choose from the group list</p>
            ) : (
              <p className="text-sm text-[rgba(214,240,224,0.6)]">
                <span className="font-bold text-[#F7F1E4]">
                  {currentPicker?.user?.display_name || currentPicker?.user?.username || 'Someone'}
                </span>
                {' '}chooses next
              </p>
            )}
          </div>
        )}

        {isRotatingPicker && activePick && (
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
              Group list · {unwatched.length}
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

          <div className="mb-3 space-y-2">
            <ChipRow value={typeFilter} onChange={setTypeFilter} options={[{ value: 'all', label: 'All' }, ...MEDIA_ORDER.map(type => ({ value: type, label: MEDIA[type].label }))]} />
            <ChipRow value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All' }, { value: 'unwatched', label: 'Active' }, { value: 'picked', label: 'Chosen' }]} />
            <ChipRow value={voteFilter} onChange={setVoteFilter} options={[{ value: 'all', label: 'All' }, { value: 'liked', label: 'Liked by you' }, { value: 'unvoted', label: 'No vote yet' }]} />
          </div>

          {unwatched.length === 0 ? (
            <div className="rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] px-4 py-6 text-center">
              <p className="text-sm text-[rgba(214,240,224,0.4)]">Nothing matches these filters yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {unwatched.map(item => (
                <PartyListItem
                  key={item.id}
                  item={item}
                  members={members}
                  uid={uid}
                  votingId={votingId}
                  onVote={handleVote}
                  canPick={isRotatingPicker && isMyTurn && !activePick}
                  pickingId={pickingId}
                  onPick={handlePick}
                  canRemove={item.status === 'unwatched' && (item.added_by === uid || isCreator)}
                  onRemove={handleRemoveItem}
                />
              ))}
            </div>
          )}
        </section>

        {/* Add items panel */}
        {showAdd && (
          <section className="rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[rgba(150,214,180,0.12)] px-4 py-3">
              <p className="text-sm font-bold text-[#F7F1E4]">Add to group list</p>
              <button
                type="button"
                aria-label="Close add titles panel"
                onClick={() => { setShowAdd(false); setAddError('') }}
                className="min-h-10 min-w-10 text-[rgba(214,240,224,0.5)] text-lg leading-none"
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

        {/* Done history */}
        {isRotatingPicker && watched.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowDone(v => !v)}
              className="mb-2 flex w-full items-center justify-between"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[rgba(214,240,224,0.45)]">
                Done · {watched.length}
              </p>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className={`text-[rgba(214,240,224,0.4)] transition-transform ${showDone ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showDone && (
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
                        <p className="text-[11px] text-[rgba(214,240,224,0.4)]">Marked done by {pickerName}</p>
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

function PartyListItem({ item, members, uid, votingId, onVote, canPick = false, pickingId, onPick, canRemove, onRemove }) {
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

        <div className="flex items-center gap-2">
        {canRemove && <button type="button" onClick={() => onRemove(item.id)} className="btn-press text-[11px] font-semibold text-rose-300/80">Remove</button>}
        {canPick ? (
          <button
            type="button"
            disabled={isPicking}
            onClick={() => onPick(item.id)}
            className={`btn-press rounded-full px-4 py-1.5 text-xs font-extrabold disabled:opacity-50 ${
              majorityReached
                ? 'bg-[#2DD48F] text-[#052016]'
                : 'border border-[rgba(216,168,74,0.4)] bg-[rgba(216,168,74,0.12)] text-[#D8A84A]'
            }`}
          >
            {isPicking ? 'Choosing...' : majorityReached ? 'Choose this' : 'My choice'}
          </button>
        ) : (
          <span className="text-[11px] font-semibold text-[rgba(214,240,224,0.35)]">{GROUP_STATUS_LABELS[item.status] || 'Active'}</span>
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
        <p className="text-xs font-bold uppercase tracking-wider text-[#D8A84A]">Chosen</p>
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
          <p className="mt-1 text-[11px] text-[rgba(214,240,224,0.45)]">Chosen by {pickerName}</p>
        </div>
        {canFinish ? (
          <button
            type="button"
            disabled={finishing}
            onClick={onFinish}
            className="btn-press shrink-0 rounded-full bg-[#F4E9D1] px-4 py-2 text-xs font-extrabold text-[#052016] disabled:opacity-50"
          >
            {finishing ? 'Saving...' : 'Mark done'}
          </button>
        ) : (
          <span className="shrink-0 rounded-full border border-[rgba(216,168,74,0.24)] px-3 py-1.5 text-xs font-bold text-[#D8A84A]">
            Chosen
          </span>
        )}
      </div>
    </section>
  )
}

function StatPill({ value, label }) {
  return (
    <div className="rounded-[13px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] px-2 py-3 text-center">
      <p className="font-mono-q text-lg font-semibold leading-none text-[#F7F1E4]">{value}</p>
      <p className="mt-1 text-[9.5px] font-bold uppercase leading-tight text-[rgba(214,240,224,0.5)]">{label}</p>
    </div>
  )
}

function ChipRow({ options, value, onChange }) {
  return <div className="scrollbar-none flex gap-2 overflow-x-auto">{options.map(option => <Chip key={option.value} active={value === option.value} onClick={() => onChange(option.value)}>{option.label}</Chip>)}</div>
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
