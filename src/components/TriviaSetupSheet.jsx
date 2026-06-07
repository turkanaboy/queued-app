import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { generateChallenge } from '../lib/trivia'
import { Chip, MEDIA_ORDER, MEDIA, SheetShell } from '../lib/queuedDesign'
import { InitialsAvatar } from './Layout'

const MODES = [
  {
    key: 'balanced',
    label: 'Balanced',
    desc: 'Mix of both your libraries',
  },
  {
    key: 'my_media',
    label: 'My Media',
    desc: 'Questions from your logged titles',
  },
  {
    key: 'random',
    label: 'Random',
    desc: 'Pure pop culture trivia',
  },
]

export default function TriviaSetupSheet({ onClose }) {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('balanced')
  const [mediaTypes, setMediaTypes] = useState(['movie', 'tv', 'book', 'album'])
  const [friends, setFriends] = useState([])
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const uid = session?.user?.id

  useEffect(() => {
    if (!uid) return
    async function fetchFriends() {
      const { data } = await supabase
        .from('friendships')
        .select('*, user_a:users!friendships_user_a_id_fkey(*), user_b:users!friendships_user_b_id_fkey(*)')
        .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`)
        .eq('status', 'accepted')
      const list = (data ?? []).map(f => ({
        ...f,
        friend: f.user_a_id === uid ? f.user_b : f.user_a,
      })).filter(f => f.friend?.username || f.friend?.display_name)
      setFriends(list)
      setLoadingFriends(false)
    }
    fetchFriends()
  }, [uid])

  function toggleMediaType(type) {
    setMediaTypes(prev => {
      if (prev.includes(type)) {
        // Don't deselect the last one
        if (prev.length === 1) return prev
        return prev.filter(t => t !== type)
      }
      return [...prev, type]
    })
  }

  async function handleChallenge() {
    if (!selectedFriend || generating) return
    setError('')
    setGenerating(true)
    try {
      const types = mode === 'random' ? ['movie', 'tv', 'book', 'album'] : mediaTypes
      const result = await generateChallenge(uid, selectedFriend.friend.id, mode, types)
      onClose()
      navigate(`/trivia/${result.challenge_id}`)
    } catch (err) {
      setError(err?.message || 'Failed to generate challenge. Please try again.')
      setGenerating(false)
    }
  }

  const friendName = selectedFriend
    ? selectedFriend.friend?.display_name || selectedFriend.friend?.username || 'Friend'
    : null

  return (
    <SheetShell onClose={onClose} title="Trivia Challenge">
      {/* Mode selection */}
      <div className="mb-5">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-[1.4px] text-[rgba(214,240,224,0.5)]">Mode</p>
        <div className="space-y-2">
          {MODES.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`btn-press w-full rounded-[14px] border px-4 py-3 text-left transition-all ${
                mode === m.key
                  ? 'border-[#D8A84A] bg-[rgba(216,168,74,0.12)]'
                  : 'border-[rgba(150,214,180,0.16)] bg-[rgba(9,46,32,0.55)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${mode === m.key ? 'text-[#D8A84A]' : 'text-[#F7F1E4]'}`}>
                  {m.label}
                </span>
                {mode === m.key && (
                  <span className="text-[#D8A84A]">✓</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[rgba(214,240,224,0.5)]">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Media type filter (hidden for random) */}
      {mode !== 'random' && (
        <div className="mb-5">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-[1.4px] text-[rgba(214,240,224,0.5)]">
            Media types
          </p>
          <div className="flex flex-wrap gap-2">
            {MEDIA_ORDER.map(type => (
              <Chip
                key={type}
                active={mediaTypes.includes(type)}
                onClick={() => toggleMediaType(type)}
              >
                {MEDIA[type].label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Friend picker */}
      <div className="mb-5">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-[1.4px] text-[rgba(214,240,224,0.5)]">
          Challenge a friend
        </p>
        {loadingFriends ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 animate-pulse rounded-[14px] bg-white/5" />
            ))}
          </div>
        ) : friends.length === 0 ? (
          <div className="rounded-[14px] border border-[rgba(150,214,180,0.16)] bg-[rgba(9,46,32,0.55)] px-4 py-5 text-center">
            <p className="text-sm font-bold text-[#F7F1E4]">No friends yet</p>
            <p className="mt-1 text-xs text-[rgba(214,240,224,0.5)]">
              Add friends from the Friends tab to challenge them.
            </p>
          </div>
        ) : (
          <div className="max-h-52 overflow-y-auto rounded-[14px] border border-[rgba(150,214,180,0.16)] bg-[rgba(9,46,32,0.55)]">
            {friends.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFriend(f)}
                className={`btn-press flex w-full items-center gap-3 px-4 py-3 text-left transition-all ${
                  i > 0 ? 'border-t border-[rgba(150,214,180,0.12)]' : ''
                } ${
                  selectedFriend?.id === f.id
                    ? 'bg-[rgba(216,168,74,0.1)]'
                    : ''
                }`}
              >
                <InitialsAvatar name={f.friend?.display_name || f.friend?.username} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#F7F1E4]">
                    {f.friend?.display_name || f.friend?.username}
                  </p>
                  <p className="truncate text-xs text-[rgba(214,240,224,0.5)]">
                    @{f.friend?.username}
                  </p>
                </div>
                {selectedFriend?.id === f.id && (
                  <span className="text-[#D8A84A]">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mb-3 rounded-[12px] border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={handleChallenge}
        disabled={!selectedFriend || generating}
        className="btn-press btn-cream w-full rounded-full py-3.5 text-sm font-extrabold disabled:pointer-events-none disabled:opacity-40"
      >
        {generating
          ? 'Generating questions…'
          : friendName
          ? `Challenge ${friendName}`
          : 'Select a friend to challenge'}
      </button>
    </SheetShell>
  )
}
