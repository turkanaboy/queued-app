import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function CommentsDrawer({ recommendationId, currentUserId }) {
  const [comments, setComments] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchComments() }, [recommendationId])

  async function fetchComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, author:users!comments_author_id_fkey(username, display_name)')
      .eq('recommendation_id', recommendationId)
      .order('created_at', { ascending: true })
    setComments(data ?? [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    await supabase.from('comments').insert({
      recommendation_id: recommendationId,
      author_id: currentUserId,
      body: body.trim(),
    })
    setBody('')
    await fetchComments()
    setSubmitting(false)
  }

  async function deleteComment(id) {
    await supabase.from('comments').delete().eq('id', id)
    fetchComments()
  }

  return (
    <div className="border-t border-white/10 px-4 py-3 space-y-3"
      style={{ background: 'rgba(0,0,0,0.15)' }}>
      {loading ? (
        <p className="text-white/30 text-xs">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-white/30 text-xs italic">No comments yet — be the first!</p>
      ) : (
        <div className="space-y-2.5">
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-2">
              <div className="flex-1">
                <span className="text-xs font-bold text-white/70">
                  {c.author?.display_name || c.author?.username}
                </span>
                <span className="text-xs text-white/50 ml-2">{c.body}</span>
              </div>
              {c.author_id === currentUserId && (
                <button onClick={() => deleteComment(c.id)} className="btn-press text-white/20 hover:text-rose-300 text-xs shrink-0">✕</button>
              )}
            </div>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1 text-xs rounded-xl px-3 py-2 focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
        />
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="btn-press text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-40 text-[#040C21]"
          style={{ background: 'white' }}
        >
          Post
        </button>
      </form>
    </div>
  )
}
