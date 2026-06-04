import { useState } from 'react'
import { Link } from 'react-router-dom'
import CommentsDrawer from './CommentsDrawer'
import { ProviderRows } from '../pages/AddRecommendationPage'

const STATUS_OPTIONS = ['not_yet_viewed', 'queued', 'in_progress', 'finished', 'skipped', 'bailed']
const STATUS_LABELS = {
  not_yet_viewed: 'New', queued: 'Queued', in_progress: 'Watching',
  finished: 'Finished', skipped: 'Skipped', bailed: 'Bailed'
}
const STATUS_COLORS = {
  not_yet_viewed: 'bg-blue-400/30 text-blue-100',
  queued:         'bg-sky-400/30 text-sky-100',
  in_progress:    'bg-amber-400/30 text-amber-100',
  finished:       'bg-green-400/30 text-green-100',
  skipped:        'bg-white/10 text-white/50',
  bailed:         'bg-rose-400/30 text-rose-100',
}

export default function RecommendationCard({ rec, currentUserId, myPlatforms = [], onStatusChange, onRatingChange, onDelete }) {
  const [showComments, setShowComments] = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const isRecipient = rec.recipient_id === currentUserId
  const isSender    = rec.sender_id === currentUserId

  const myProviderIds = myPlatforms ?? []

  async function handleStatusChange(status) {
    setShowStatusPicker(false)
    await onStatusChange(rec.id, status)
    if (status === 'finished') setShowComments(true)
  }

  return (
    <div className="glass rounded-3xl overflow-hidden anim-up">
      <div className="flex gap-3 p-4">
        {/* Poster */}
        <div className="shrink-0">
          {rec.media_poster_url ? (
            <img src={rec.media_poster_url} alt={rec.media_title}
              className="w-16 h-24 object-cover rounded-2xl shadow-lg" />
          ) : (
            <div className="w-16 h-24 rounded-2xl flex items-center justify-center text-white/20 text-2xl"
              style={{ background: 'rgba(255,255,255,0.1)' }}>🎬</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-white text-sm leading-tight truncate">{rec.media_title}</p>
              {rec.media_creator && (
                <p className="text-white/50 text-xs mt-0.5 truncate">{rec.media_creator}</p>
              )}
              <p className="text-white/40 text-xs mt-0.5 capitalize">{rec.media_type}</p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${STATUS_COLORS[rec.recipient_status]}`}>
              {STATUS_LABELS[rec.recipient_status]}
            </span>
          </div>

          {rec.note && (
            <p className="text-white/60 text-xs mt-2 leading-relaxed italic line-clamp-2">"{rec.note}"</p>
          )}

          <p className="text-white/40 text-xs mt-2">
            from{' '}
            <Link to={`/profile/${rec.sender_id}`} className="text-white/70 font-semibold hover:text-white">
              {rec.sender?.display_name || rec.sender?.username}
            </Link>
            {' · '}{new Date(rec.created_at).toLocaleDateString()}
          </p>

          {rec.rating && <StarDisplay value={rec.rating} className="mt-1.5" />}

          {/* Streaming / buy / listen links */}
          <div className="mt-2">
            <ProviderRows
              providers={rec.streaming_providers}
              title={rec.media_title}
              creator={rec.media_creator}
              mediaType={rec.media_type}
              myPlatforms={myProviderIds}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10">
        <div className="flex items-center gap-2">
          {isRecipient && (
            <div className="relative">
              <button
                onClick={() => setShowStatusPicker(v => !v)}
                className="btn-press text-xs text-white/60 font-semibold border border-white/20 px-3 py-1.5 rounded-full flex items-center gap-1"
                style={{ background: 'rgba(255,255,255,0.1)' }}
              >
                Update ▾
              </button>
              {showStatusPicker && (
                <div className="absolute left-0 bottom-full mb-2 glass rounded-2xl shadow-2xl z-10 overflow-hidden min-w-36 py-1">
                  {STATUS_OPTIONS.map(s => (
                    <button key={s} onClick={() => handleStatusChange(s)}
                      className={`block w-full text-left px-4 py-2 text-xs font-semibold hover:bg-white/10 ${rec.recipient_status === s ? 'text-white' : 'text-white/60'}`}>
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {isRecipient && rec.recipient_status === 'finished' && (
            <StarPicker value={rec.rating} onChange={v => onRatingChange(rec.id, v)} />
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setShowComments(v => !v)}
            className="btn-press text-white/50 hover:text-white text-xs font-semibold flex items-center gap-1">
            💬 {rec.comments?.length ?? 0}
          </button>
          {isSender && (
            <button onClick={() => onDelete(rec.id)}
              className="btn-press text-white/30 hover:text-rose-300 text-xs font-semibold">
              Unsend
            </button>
          )}
        </div>
      </div>

      {showComments && <CommentsDrawer recommendationId={rec.id} currentUserId={currentUserId} />}
    </div>
  )
}

// Shows a read-only star rating with proper half-star rendering
export function StarDisplay({ value, className = '' }) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map(s => {
        const filled = value >= s
        const half   = !filled && value >= s - 0.5
        return (
          <span key={s} className="relative text-xs leading-none" style={{ display: 'inline-block', width: '0.7rem' }}>
            <span className="text-white/20">★</span>
            {(filled || half) && (
              <span
                className="absolute inset-0 text-amber-300"
                style={half ? { clipPath: 'inset(0 50% 0 0)' } : {}}
              >★</span>
            )}
          </span>
        )
      })}
      <span className="text-xs text-white/40 ml-1">{value}</span>
    </div>
  )
}

// Whole-star picker used on finished recommendations
function StarPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} onClick={() => onChange(s)}
          className={`btn-press text-base leading-none ${value && s <= value ? 'text-amber-300' : 'text-white/20'} hover:text-amber-200`}>
          ★
        </button>
      ))}
    </div>
  )
}
