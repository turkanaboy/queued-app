import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PosterTile, SheetShell } from '../lib/queuedDesign'
import { ratingLabel, ratingToStep, stepToRating } from '../lib/ratings'

const TYPE_LABEL = { movie: 'Movie', tv: 'TV', book: 'Book', album: 'Album' }

export default function RatingModal({ item, existingEntry, onClose, onSaved }) {
  const { session } = useAuth()
  const [ratingStep, setRatingStep] = useState(ratingToStep(existingEntry?.rating))
  const [comment, setComment] = useState(existingEntry?.review ?? '')
  const [status, setStatus] = useState(existingEntry?.status === 'in_progress' ? 'in_progress' : 'finished')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    const { error } = await supabase.from('user_media_log').upsert({
      user_id: session.user.id,
      media_type: item.media_type,
      media_id: item.media_id,
      media_title: item.media_title,
      media_creator: item.media_creator ?? null,
      media_poster_url: item.media_poster_url,
      rating: stepToRating(ratingStep),
      status,
      review: comment.trim() || null,
      source_type: existingEntry?.source_type ?? 'self',
      source_user_id: existingEntry?.source_user_id ?? null,
      streaming_providers: existingEntry?.streaming_providers ?? item.streaming_providers ?? [],
    }, { onConflict: 'user_id,media_type,media_id' })
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
          <PosterTile item={item} w={56} h={82} radius={14} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold leading-tight text-[#F7F1E4]">{item.media_title}</p>
            <p className="mt-1 truncate text-sm text-[rgba(214,240,224,0.6)]">{item.media_creator || TYPE_LABEL[item.media_type]}{item.year ? ` · ${item.year}` : ''}</p>
          </div>
        </div>

        <div>
          <p className="font-mono-q mb-2 text-[10.5px] font-semibold uppercase tracking-[1.6px] text-[rgba(214,240,224,0.5)]">Status</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['in_progress', 'In progress'],
              ['finished', 'Finished'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`btn-press rounded-2xl border px-4 py-3 text-sm font-bold ${status === value ? 'border-[#D8A84A] bg-[#F4E9D1] text-[#052016]' : 'border-[rgba(150,214,180,0.16)] text-[rgba(214,240,224,0.7)]'}`}
              >
                {label}
              </button>
            ))}
          </div>
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
          <button onClick={onClose} className="btn-press rounded-2xl border border-[rgba(150,214,180,0.16)] px-4 py-3 text-sm font-bold text-[rgba(214,240,224,0.7)]">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-press btn-cream rounded-2xl px-4 py-3 text-sm font-bold disabled:opacity-40">{saving ? 'Saving...' : 'Add to log'}</button>
        </div>
      </div>
    </SheetShell>
  )
}
