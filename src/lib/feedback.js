export const MAX_FEEDBACK_LENGTH = 4000

export function normalizeFeedback(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function validateFeedback(value) {
  const feedback = normalizeFeedback(value)
  if (!feedback) return 'Tell us what happened or what you would like to see.'
  if (feedback.length > MAX_FEEDBACK_LENGTH) return `Feedback must be ${MAX_FEEDBACK_LENGTH.toLocaleString()} characters or fewer.`
  return ''
}
