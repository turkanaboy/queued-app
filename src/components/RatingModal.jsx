import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PosterTile, SheetShell } from '../lib/queuedDesign'
import { ratingLabel, ratingToStep, stepToRating } from '../lib/ratings'
import { upsertMediaLog } from '../lib/mediaLog'

const TYPE_LABEL = { movie: 'Movie', tv: 'TV', book: 'Book', album: 'Album' }

export default function RatingModal({ item, existingEntry, onClose, onSaved, onRecommend }) {
  const { session } = useAuth()
  const [ratingStep, setRatingStep] = useState(ratingToStep(existingEntry?.rating))
  const [comment, setComment] = useState(existingEntry?.review ?? '')
  const [status, setStatus] = useState(existingEntry?.status === 'in_progress' ? 'in_progress' : 'finished')
  const [details, setDetails] = useState(item)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function fetchDetails() {
      setDetails(item)
      if (!item?.media_type || !item?.media_id) return
      setLoadingDetails(true)
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-media?action=details&media_type=${item.media_type}&media_id=${encodeURIComponent(item.media_id)}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
        )
        const json = await res.json()
        if (!cancelled && json.details) {
          setDetails(prev => Object.fromEntries(
            Object.entries({ ...prev, ...json.details }).map(([key, value]) => [key, value ?? prev[key]])
          ))
        }
      } catch {
        // Keep the base item visible if provider details are unavailable.
      }
      if (!cancelled) setLoadingDetails(false)
    }
    fetchDetails()
    return () => { cancelled = true }
  }, [item])

  async function save() {
    setSaving(true)
    setError('')
    const { error } = await upsertMediaLog({
      user_id: session.user.id,
      media_type: item.media_type,
      media_id: item.media_id,
      media_title: details.media_title ?? item.media_title,
      media_creator: details.media_creator ?? item.media_creator ?? null,
      media_poster_url: details.media_poster_url ?? item.media_poster_url,
      rating: stepToRating(ratingStep),
      status,
      review: comment.trim() || null,
      source_type: existingEntry?.source_type ?? 'self',
      source_user_id: existingEntry?.source_user_id ?? null,
      streaming_providers: existingEntry?.streaming_providers ?? item.streaming_providers ?? [],
    })
    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    onSaved?.()
    onClose()
  }

  return (
    <SheetShell onClose={onClose} title="Add to log">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <PosterTile item={details} w={56} h={82} radius={14} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold leading-tight text-[#F7F1E4]">{details.media_title ?? item.media_title}</p>
            <p className="mt-1 truncate text-sm text-[rgba(214,240,224,0.6)]">{details.media_creator || item.media_creator || TYPE_LABEL[item.media_type]}{details.year || item.year ? ` · ${details.year || item.year}` : ''}</p>
          </div>
        </div>

        {(details.description || details.actors?.length || loadingDetails) && (
          <div className="space-y-2 rounded-[16px] border border-[rgba(150,214,180,0.16)] bg-[rgba(2,17,12,0.38)] px-3.5 py-3">
            {details.description && <p className="line-clamp-5 text-[12.5px] leading-relaxed text-[rgba(214,240,224,0.72)]">{details.description}</p>}
            {details.director && <p className="truncate text-[11.5px] font-semibold text-[rgba(214,240,224,0.55)]"><span className="text-[#D8A84A]">Director</span> {details.director}</p>}
            {details.actors?.length > 0 && <p className="line-clamp-2 text-[11.5px] font-semibold text-[rgba(214,240,224,0.55)]"><span className="text-[#D8A84A]">Actors</span> {details.actors.join(', ')}</p>}
            {loadingDetails && !details.description && <p className="text-[12px] font-semibold text-[rgba(214,240,224,0.45)]">Loading title details...</p>}
          </div>
        )}

        <div>
          <p className="font-mono-q mb-2 text-[10.5px] font-semibold uppercase tracking-[1.6px] text-[rgba(214,240,224,0.5)]">Status</p>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-full rounded-[14px] border border-[rgba(150,214,180,0.16)] bg-[rgba(2,17,12,0.82)] px-3.5 py-3 text-sm font-bold text-[#F7F1E4] outline-none focus:border-[#D8A84A]/80"
          >
            <option value="in_progress">In progress</option>
            <option value="finished">Finished</option>
          </select>
        </div>

        <div>
          <p className="font-mono-q mb-2 text-[10.5px] font-semibold uppercase tracking-[1.6px] text-[rgba(214,240,224,0.5)]">Rating optional</p>
          <div className="grid grid-cols-10 gap-1.5">
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const active = ratingStep && n <= ratingStep
              return (
                <button key={n} onClick={() => setRatingStep(ratingStep === n ? null : n)}
                  className={`font-mono-q btn-press h-[30px] rounded-[7px] text-[11px] font-semibold ${active ? 'text-[#052016]' : 'text-[rgba(214,240,224,0.55)]'}`}
                  style={{ background: active ? 'linear-gradient(180deg, #E7C674, #C99A52)' : 'rgba(2,17,12,0.5)', boxShadow: active ? 'none' : 'inset 0 1px 0 rgba(244,233,209,0.08)' }}>
                  {ratingLabel(n)}
                </button>
              )
            })}
          </div>
        </div>

        <textarea value={comment} onChange={e => setComment(e.target.value.slice(0, 1000))} rows={3} placeholder="Review (optional)"
          className="w-full resize-none rounded-[14px] border border-[rgba(150,214,180,0.16)] bg-[rgba(2,17,12,0.7)] px-3.5 py-3 text-sm text-[#F7F1E4] outline-none placeholder:text-[#F7F1E4]/35 focus:border-[#D8A84A]/80" />

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={onRecommend || onClose} className="btn-press rounded-2xl border border-[rgba(150,214,180,0.16)] px-4 py-3 text-sm font-bold text-[rgba(214,240,224,0.7)]">{onRecommend ? 'Recommend' : 'Cancel'}</button>
          <button onClick={save} disabled={saving} className="btn-press btn-cream rounded-2xl px-4 py-3 text-sm font-bold disabled:opacity-40">{saving ? 'Saving...' : 'Add to log'}</button>
        </div>
        {onRecommend && <button onClick={onClose} className="btn-press w-full text-center text-xs font-bold text-[rgba(214,240,224,0.45)]">Cancel</button>}
      </div>
    </SheetShell>
  )
}
