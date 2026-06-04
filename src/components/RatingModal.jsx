import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const TYPE_ICON = { movie: '🎬', tv: '📺', book: '📚', album: '🎵' }

export default function RatingModal({ item, existingEntry, onClose, onSaved }) {
  const { session } = useAuth()
  const [rating, setRating] = useState(existingEntry?.rating ?? null)
  const [step, setStep] = useState('rate') // 'rate' | 'comment'
  const [comment, setComment] = useState(existingEntry?.review ?? '')
  const [saving, setSaving] = useState(false)

  const isAlbum = item.media_type === 'album'

  async function save(withComment) {
    if (!rating) return
    setSaving(true)
    await supabase.from('user_media_log').upsert({
      user_id:          session.user.id,
      media_type:       item.media_type,
      media_id:         item.media_id,
      media_title:      item.media_title,
      media_creator:    item.media_creator ?? null,
      media_poster_url: item.media_poster_url,
      rating,
      review: withComment && comment.trim() ? comment.trim() : null,
    }, { onConflict: 'user_id,media_id' })
    onSaved?.()
    onClose()
  }

  const HALF_STARS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-40 flex items-end justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[430px] rounded-t-[32px] shadow-2xl pb-8"
          style={{ background: 'linear-gradient(170deg, #ff6b35 0%, #e91e8c 50%, #6b21a8 100%)' }}>

          <div className="pt-4 pb-2 flex justify-center">
            <div className="w-10 h-1 bg-white/30 rounded-full" />
          </div>

          <div className="px-6 space-y-5">
            {/* Title row */}
            <div className="flex items-center gap-4">
              {item.media_poster_url ? (
                <img src={item.media_poster_url} alt={item.media_title}
                  className={`object-cover rounded-2xl shadow-lg shrink-0 ${isAlbum ? 'w-16 h-16' : 'w-14 h-20'}`} />
              ) : (
                <div className={`rounded-2xl flex items-center justify-center text-3xl shrink-0 ${isAlbum ? 'w-16 h-16' : 'w-14 h-20'}`}
                  style={{ background: 'rgba(255,255,255,0.15)' }}>
                  {TYPE_ICON[item.media_type] ?? '🎬'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-white text-lg leading-tight">{item.media_title}</p>
                {item.media_creator && (
                  <p className="text-white/60 text-sm mt-0.5">{item.media_creator}</p>
                )}
                <p className="text-white/40 text-xs capitalize mt-0.5">
                  {item.media_type}{item.year ? ` · ${item.year}` : ''}
                </p>
                {existingEntry && (
                  <p className="text-white/40 text-xs mt-1">Updating your rating</p>
                )}
              </div>
              <button onClick={onClose} className="btn-press text-white/40 hover:text-white ml-auto shrink-0 p-1 text-xl">✕</button>
            </div>

            {/* Star rating */}
            <div>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Your rating</p>
              <div className="flex items-center justify-center gap-1">
                {HALF_STARS.map(v => {
                  const isWhole = v % 1 === 0
                  const filled  = rating !== null && v <= rating
                  return (
                    <button key={v} onClick={() => setRating(v === rating ? null : v)}
                      className={`btn-press text-3xl leading-none transition-all ${
                        filled ? 'text-amber-300 scale-110' : 'text-white/20 hover:text-white/40'
                      }`}>
                      {isWhole ? '★' : '⯨'}
                    </button>
                  )
                })}
              </div>
              {rating && (
                <p className="text-center text-white/60 text-sm mt-2 font-semibold">{rating} / 5</p>
              )}
            </div>

            {/* Action buttons after rating selected */}
            {step === 'rate' && rating && (
              <div className="flex gap-3 pt-1">
                <button onClick={() => setStep('comment')}
                  className="btn-press flex-1 py-3.5 rounded-2xl font-bold text-sm text-purple-900"
                  style={{ background: 'white' }}>
                  Add a comment
                </button>
                <button onClick={() => save(false)} disabled={saving}
                  className="btn-press flex-1 py-3.5 rounded-2xl font-bold text-sm text-white border border-white/30 disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.15)' }}>
                  {saving ? 'Saving…' : 'Skip for now'}
                </button>
              </div>
            )}

            {/* Comment step */}
            {step === 'comment' && (
              <div className="space-y-3">
                <div className="relative">
                  <textarea autoFocus value={comment}
                    onChange={e => setComment(e.target.value.slice(0, 1000))}
                    rows={3} placeholder="What did you think? (optional)"
                    className="input-glass resize-none" />
                  <span className={`absolute bottom-2 right-3 text-xs ${comment.length > 900 ? 'text-amber-300' : 'text-white/25'}`}>
                    {comment.length}/1000
                  </span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => save(true)} disabled={saving}
                    className="btn-press flex-1 py-3.5 rounded-2xl font-bold text-sm text-purple-900 disabled:opacity-40"
                    style={{ background: 'white' }}>
                    {saving ? 'Saving…' : 'Save to my collection 📝'}
                  </button>
                  <button onClick={() => save(false)} disabled={saving}
                    className="btn-press py-3.5 px-4 rounded-2xl text-sm text-white/60 border border-white/20 disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.1)' }}>
                    Skip
                  </button>
                </div>
              </div>
            )}

            {!rating && (
              <p className="text-center text-white/30 text-sm pb-2">Select a rating to continue</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
