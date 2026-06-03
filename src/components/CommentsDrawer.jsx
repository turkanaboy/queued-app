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
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No comments yet.</p>
      ) : (
        <div className="space-y-2">
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-2">
              <div className="flex-1">
                <span className="text-xs font-medium text-gray-700">
                  {c.author?.display_name || c.author?.username}
                </span>
                <span className="text-xs text-gray-500 ml-2">{c.body}</span>
              </div>
              {c.author_id === currentUserId && (
                <button onClick={() => deleteComment(c.id)} className="text-xs text-gray-300 hover:text-red-400 shrink-0">✕</button>
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
          className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
        />
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
        >
          Post
        </button>
      </form>
    </div>
  )
}
