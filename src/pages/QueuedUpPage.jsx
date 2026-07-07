/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import RatingModal from '../components/RatingModal'
import { ProviderRows } from '../components/RecommendationComposer'
import { EmptyState, MEDIA, MEDIA_ORDER, MediumTabs, PosterTile, ScreenHeader } from '../lib/queuedDesign'

const FRIENDS_QUEUE_TIMEOUT_MS = 4000

export default function QueuedUpPage() {
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [medium, setMedium] = useState('movie')
  const [loading, setLoading] = useState(true)
  const [ratingItem, setRatingItem] = useState(null)
  const [friendsQueueMap, setFriendsQueueMap] = useState({})

  async function fetchQueue() {
    setLoading(true)
    const { data } = await supabase
      .from('user_media_log')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
    const queueItems = data ?? []
    setItems(queueItems)
    setLoading(false)
    fetchFriendsQueue(session.user.id, queueItems)
  }

  async function fetchFriendsQueue(uid, queueItems) {
    if (queueItems.length === 0) return

    // Match on media_type:media_id — exact, and unlike media_title it can't
    // contain commas that would break PostgREST's `.in()` list syntax.
    const myMediaIds = [...new Set(queueItems.map(i => i.media_id).filter(Boolean))]
    if (myMediaIds.length === 0) return

    const keyToItemId = Object.fromEntries(
      queueItems.map(i => [`${i.media_type}:${i.media_id}`, i.id])
    )

    const work = (async () => {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_a_id, user_b_id, user_a:users!friendships_user_a_id_fkey(id,display_name,username), user_b:users!friendships_user_b_id_fkey(id,display_name,username)')
        .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`)
        .eq('status', 'accepted')

      if (!friendships?.length) return

      const friendMap = {}
      for (const f of friendships) {
        const friend = f.user_a_id === uid ? f.user_b : f.user_a
        if (friend?.id) friendMap[friend.id] = friend
      }
      const friendIds = Object.keys(friendMap)
      if (!friendIds.length) return

      const [{ data: friendQueues }, { data: existingRecs }] = await Promise.all([
        supabase
          .from('user_media_log')
          .select('user_id, media_id, media_type')
          .in('user_id', friendIds)
          .in('media_id', myMediaIds)
          .eq('status', 'queued'),
        supabase
          .from('recommendations')
          .select('sender_id, recipient_id, media_id, media_type')
          .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
          .in('media_id', myMediaIds)
          .is('deleted_at', null),
      ])

      const recPairs = new Set(
        (existingRecs ?? []).map(r => {
          const friendId = r.sender_id === uid ? r.recipient_id : r.sender_id
          return `${friendId}:${r.media_type}:${r.media_id}`
        })
      )

      const map = {}
      for (const entry of (friendQueues ?? [])) {
        const key = `${entry.media_type}:${entry.media_id}`
        if (recPairs.has(`${entry.user_id}:${key}`)) continue
        const friend = friendMap[entry.user_id]
        if (!friend) continue
        const itemId = keyToItemId[key]
        if (!itemId) continue
        if (!map[itemId]) map[itemId] = []
        map[itemId].push(friend)
      }

      return map
    })()

    const timeout = new Promise(resolve => setTimeout(() => resolve(null), FRIENDS_QUEUE_TIMEOUT_MS))
    const result = await Promise.race([work, timeout])
    if (result) setFriendsQueueMap(result)
  }

  useEffect(() => {
    fetchQueue()
  }, [session])

  return (
    <div className="pb-5">
      <ScreenHeader title="Queued" subtitle="Everything waiting in your queue" />
      <MediumTabs value={medium} counts={Object.fromEntries(MEDIA_ORDER.map(type => [type, items.filter(item => item.media_type === type).length]))} onChange={setMedium} />

      <div className="px-[18px] pt-2">
        <div className="overflow-hidden rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] shadow-[inset_3px_0_0_rgba(184,115,51,0.62)]">
          {loading ? (
            <div className="space-y-0">
              {[...Array(6)].map((_, index) => (
                <div key={index} className={`flex items-center gap-3 px-[13px] py-[11px] ${index ? 'border-t border-[rgba(150,214,180,0.12)]' : ''}`}>
                  <div className="h-[52px] w-[34px] animate-pulse rounded-lg bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.filter(item => item.media_type === medium).length === 0 ? (
            <EmptyState title="Your queue is clear" body="Tap the plus button to add something you want to watch, read, or hear." />
          ) : (
            items.filter(item => item.media_type === medium).map((item, index) => (
              <div key={item.id} className={`flex items-start gap-3 px-[13px] py-[11px] ${index ? 'border-t border-[rgba(150,214,180,0.12)]' : ''}`}>
                <PosterTile item={item} w={34} h={52} radius={8} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#F7F1E4]">{item.media_title}</p>
                  <p className="truncate text-[11.5px] capitalize text-[rgba(214,240,224,0.5)]">{item.media_creator || MEDIA[item.media_type]?.label}</p>
                  <p className="font-mono-q mt-1 text-[10px] uppercase tracking-[0.8px] text-[rgba(214,240,224,0.38)]">Added {formatAddedDate(item.created_at)}</p>
                  <div className="mt-2">
                    <ProviderRows providers={item.streaming_providers} title={item.media_title} creator={item.media_creator} mediaType={item.media_type} compact />
                    {['movie', 'tv'].includes(item.media_type) && !hasStreamingInfo(item.streaming_providers) && (
                      <p className="text-[10.5px] font-semibold text-[rgba(214,240,224,0.35)]">Streaming info unavailable</p>
                    )}
                  </div>
                  <AlsoQueuedBy friends={friendsQueueMap[item.id]} />
                </div>
                <button onClick={() => setRatingItem(item)} className="btn-press rounded-full border border-[#D8A84A]/40 px-3 py-1.5 text-xs font-bold text-[#D8A84A]">Finish</button>
              </div>
            ))
          )}
        </div>
      </div>

      {ratingItem && (
        <RatingModal
          item={ratingItem}
          existingEntry={ratingItem}
          onClose={() => setRatingItem(null)}
          onSaved={() => {
            setRatingItem(null)
            fetchQueue()
          }}
        />
      )}
    </div>
  )
}

function AlsoQueuedBy({ friends }) {
  if (!friends?.length) return null
  const [first, second] = friends
  const firstName = first.display_name || first.username
  let label
  if (friends.length === 1) label = `${firstName} also has this queued`
  else if (friends.length === 2) label = `${firstName} & ${second.display_name || second.username} also have this queued`
  else label = `${firstName} & ${friends.length - 1} others also have this queued`
  return (
    <p className="mt-1.5 text-[10.5px] font-semibold text-[rgba(45,212,143,0.55)]">
      ◎ {label}
    </p>
  )
}

function formatAddedDate(value) {
  if (!value) return 'unknown'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function hasStreamingInfo(providers) {
  if (!providers) return false
  if (Array.isArray(providers)) return providers.length > 0
  return Boolean(providers.flatrate?.length || providers.rent?.length || providers.buy?.length || providers.link)
}
