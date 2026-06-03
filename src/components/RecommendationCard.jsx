import { useState } from 'react'
import { Link } from 'react-router-dom'
import CommentsDrawer from './CommentsDrawer'

const STATUS_OPTIONS = ['not_yet_viewed', 'queued', 'in_progress', 'finished', 'skipped', 'bailed']
const STATUS_LABELS = {
  not_yet_viewed: 'New', queued: 'Queued', in_progress: 'Watching',
  finished: 'Finished', skipped: 'Skipped', bailed: 'Bailed'
}
const STATUS_COLORS = {
  not_yet_viewed: 'bg-blue-100 text-blue-700',
  queued: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-amber-100 text-amber-700',
  finished: 'bg-green-100 text-green-700',
  skipped: 'bg-gray-100 text-gray-500',
  bailed: 'bg-red-100 text-red-600',
}

export default function RecommendationCard({ rec, currentUserId, onStatusChange, onRatingChange, onDelete }) {
  const [showComments, setShowComments] = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const isRecipient = rec.recipient_id === currentUserId
  const isSender = rec.sender_id === currentUserId

  async function handleStatusChange(status) {
    setShowStatusPicker(false)
    await onStatusChange(rec.id, status)
    if (status === 'finished') setShowComments(true)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex gap-3 p-4">
        {rec.media_poster_url ? (
          <img
            src={rec.media_poster_url}
            alt={rec.media_title}
            className="w-16 h-24 object-cover rounded-lg shrink-0"
          />
        ) : (
          <div className="w-16 h-24 bg-gray-100 rounded-lg shrink-0 flex items-center justify-center text-gray-300 text-xs">No img</div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-tight">{rec.media_title}</p>
              <p className="text-xs text-gray-400 mt-0.5 capitalize">{rec.media_type}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[rec.recipient_status]}`}>
              {STATUS_LABELS[rec.recipient_status]}
            </span>
          </div>

          {rec.note && (
            <p className="text-xs text-gray-600 mt-2 leading-relaxed italic">"{rec.note}"</p>
          )}

          <p className="text-xs text-gray-400 mt-2">
            from{' '}
            <Link to={`/profile/${rec.sender_id}`} className="text-indigo-600 hover:underline">
              {rec.sender?.display_name || rec.sender?.username}
            </Link>
            {' · '}
            {new Date(rec.created_at).toLocaleDateString()}
          </p>

          {rec.rating && (
            <StarRating value={rec.rating} readonly className="mt-1" />
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isRecipient && (
            <div className="relative">
              <button
                onClick={() => setShowStatusPicker(v => !v)}
                className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 px-2 py-1 rounded-lg"
              >
                Update status ▾
              </button>
              {showStatusPicker && (
                <div className="absolute left-0 bottom-full mb-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden min-w-36">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${rec.recipient_status === s ? 'font-semibold text-indigo-600' : 'text-gray-700'}`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {isRecipient && rec.recipient_status === 'finished' && (
            <StarRating
              value={rec.rating}
              onChange={v => onRatingChange(rec.id, v)}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowComments(v => !v)}
            className="text-xs text-gray-400 hover:text-indigo-600"
          >
            💬 {rec.comments?.length ?? 0}
          </button>
          {isSender && (
            <button
              onClick={() => onDelete(rec.id)}
              className="text-xs text-gray-300 hover:text-red-400"
            >
              Unsend
            </button>
          )}
        </div>
      </div>

      {showComments && (
        <CommentsDrawer recommendationId={rec.id} currentUserId={currentUserId} />
      )}
    </div>
  )
}

function StarRating({ value, onChange, readonly = false, className = '' }) {
  const stars = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

  if (readonly) {
    return (
      <div className={`flex items-center gap-0.5 ${className}`}>
        {[1, 2, 3, 4, 5].map(s => (
          <span key={s} className={`text-sm ${s <= Math.ceil(value) ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
        ))}
        <span className="text-xs text-gray-400 ml-1">{value}</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          onMouseEnter={() => {}}
          className={`text-base leading-none ${value && s <= value ? 'text-amber-400' : 'text-gray-200'} hover:text-amber-300`}
        >
          ★
        </button>
      ))}
      {value && <span className="text-xs text-gray-400 ml-1">{value}</span>}
    </div>
  )
}
