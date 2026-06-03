import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useUnreadCount() {
  const { session } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!session) return

    async function fetchCount() {
      const { count } = await supabase
        .from('recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', session.user.id)
        .eq('recipient_status', 'not_yet_viewed')
        .is('deleted_at', null)
      setCount(count ?? 0)
    }

    fetchCount()

    const channel = supabase
      .channel('unread-badge')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recommendations',
          filter: `recipient_id=eq.${session.user.id}`,
        },
        () => fetchCount()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session])

  return count
}
