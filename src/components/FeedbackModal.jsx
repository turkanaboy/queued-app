import { useState } from 'react'
import { invokeEdgeFunction } from '../lib/edgeFunctions'
import { MAX_FEEDBACK_LENGTH, normalizeFeedback, validateFeedback } from '../lib/feedback'
import { SheetShell } from '../lib/queuedDesign'

export default function FeedbackModal({ onClose }) {
  const [feedback, setFeedback] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    const validationError = validateFeedback(feedback)
    if (validationError) {
      setError(validationError)
      return
    }

    setSending(true)
    setError('')
    try {
      await invokeEdgeFunction('submit-feedback', {
        method: 'POST',
        body: {
          message: normalizeFeedback(feedback),
          path: window.location.pathname,
        },
      })
      setSent(true)
    } catch (submitError) {
      setError(submitError.message || 'Feedback could not be sent. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <SheetShell onClose={onClose} title="Feedback sent" size="peek">
        <div className="space-y-4 text-center">
          <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2DD48F]/15 text-2xl text-[#2DD48F]">&#10003;</div>
          <p className="text-sm text-[rgba(214,240,224,0.7)]">Thanks for helping make Queued better.</p>
          <button type="button" onClick={onClose} className="btn-press btn-cream w-full rounded-2xl px-4 py-3 text-sm font-bold">Done</button>
        </div>
      </SheetShell>
    )
  }

  return (
    <SheetShell onClose={onClose} title="Send feedback" size="peek">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="feedback-message" className="mb-2 block text-sm font-bold text-[#F7F1E4]">What should we know?</label>
          <textarea
            id="feedback-message"
            value={feedback}
            maxLength={MAX_FEEDBACK_LENGTH}
            rows={6}
            onChange={event => { setFeedback(event.target.value); setError('') }}
            placeholder="Share an idea, report a problem, or tell us what feels confusing."
            aria-describedby={error ? 'feedback-help feedback-error' : 'feedback-help'}
            className="w-full resize-none rounded-[16px] border border-[rgba(150,214,180,0.16)] bg-[rgba(2,17,12,0.7)] px-3.5 py-3 text-sm text-[#F7F1E4] outline-none placeholder:text-[#F7F1E4]/35 focus:border-[#D8A84A]/80"
          />
          <div id="feedback-help" className="mt-1.5 flex justify-between gap-3 text-[11px] text-[rgba(214,240,224,0.45)]">
            <span>We may reply to your Queued account email.</span>
            <span className="font-mono-q shrink-0">{feedback.length}/{MAX_FEEDBACK_LENGTH.toLocaleString()}</span>
          </div>
        </div>

        {error && <p id="feedback-error" role="alert" className="rounded-[14px] border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}

        <button type="submit" disabled={sending} className="btn-press btn-cream w-full rounded-2xl px-4 py-3 text-sm font-bold disabled:opacity-50">
          {sending ? 'Sending...' : 'Send feedback'}
        </button>
      </form>
    </SheetShell>
  )
}
