/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import RatingModal from '../components/RatingModal'
import { EmptyState, MEDIA, PosterTile, ScreenHeader } from '../lib/queuedDesign'

export default function QueuedUpPage() {
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [ratingItem, setRatingItem] = useState(null)

  async function fetchQueue() {
    setLoading(true)
    const { data } = await supabase
      .from('user_media_log')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'queued')
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchQueue()
  }, [session])

  return (
    <div className="pb-5">
      <ScreenHeader title="Queued Up" subtitle="Everything waiting in your queue" />

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
          ) : items.length === 0 ? (
            <EmptyState title="Your queue is clear" body="Tap the plus button to add something you want to watch, read, or hear." />
          ) : (
            items.map((item, index) => (
              <div key={item.id} className={`flex items-center gap-3 px-[13px] py-[11px] ${index ? 'border-t border-[rgba(150,214,180,0.12)]' : ''}`}>
                <PosterTile item={item} w={34} h={52} radius={8} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#F7F1E4]">{item.media_title}</p>
                  <p className="truncate text-[11.5px] capitalize text-[rgba(214,240,224,0.5)]">{item.media_creator || MEDIA[item.media_type]?.label}</p>
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
