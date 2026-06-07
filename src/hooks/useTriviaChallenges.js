import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { getPendingForUser } from '../lib/trivia'

/**
 * Subscribes to trivia challenges for the current user via Supabase Realtime.
 *
 * Returns:
 *   - pendingChallenges: array of challenge objects where it's the user's turn to
 *     act (status=pending_challenger and user is challenger, or status=pending_initiator
 *     and user is initiator) — does NOT include "waiting" rows.
 *   - waitingChallenges: rows where user has played but is waiting for opponent.
 *   - pendingCount: count of challenges where it is the user's turn (badge number).
 *   - loading: boolean
 *   - refresh: function to manually refetch
 */
export function useTriviaChallenges() {
  const { session } = useAuth()
  const [allPending, setAllPending] = useState([])
  const [loading, setLoading] = useState(true)

  const uid = session?.user?.id
  // Each hook instance gets a unique channel name so multiple consumers
  // (Layout badge + FriendsPage) don't collide on the same Supabase channel.
  const channelName = useRef(`trivia-${Math.random().toString(36).slice(2)}`)

  const fetchAll = useCallback(async () => {
    if (!uid) return
    try {
      const data = await getPendingForUser(uid)
      setAllPending(data)
    } catch {
      // Silently ignore — badge just stays at previous count
    } finally {
      setLoading(false)
    }
  }, [uid])

  useEffect(() => {
    if (!uid) return

    fetchAll()

    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trivia_challenges',
          filter: `initiator_id=eq.${uid}`,
        },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trivia_challenges',
          filter: `challenger_id=eq.${uid}`,
        },
        () => fetchAll()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [uid, fetchAll])

  // Rows where it's the user's ACTIVE turn — they need to answer
  const pendingChallenges = allPending.filter(c => {
    if (c.initiator_id === uid && c.status === 'pending_initiator') return true
    if (c.challenger_id === uid && c.status === 'pending_challenger') return true
    return false
  })

  // Rows where the user has played and is waiting for the opponent
  const waitingChallenges = allPending.filter(c =>
    c.initiator_id === uid && c.status === 'pending_challenger'
  )

  return {
    pendingChallenges,
    waitingChallenges,
    allPending,
    pendingCount: pendingChallenges.length,
    loading,
    refresh: fetchAll,
  }
}
