import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_FEEDBACK_LENGTH, normalizeFeedback, validateFeedback } from './feedback.js'

test('feedback must contain non-whitespace text', () => {
  assert.equal(validateFeedback('   '), 'Tell us what happened or what you would like to see.')
  assert.equal(validateFeedback(null), 'Tell us what happened or what you would like to see.')
})

test('feedback is trimmed and accepts useful text', () => {
  assert.equal(normalizeFeedback('  Please add filters.  '), 'Please add filters.')
  assert.equal(validateFeedback('Please add filters.'), '')
})

test('feedback rejects text beyond the server limit', () => {
  assert.equal(
    validateFeedback('a'.repeat(MAX_FEEDBACK_LENGTH + 1)),
    `Feedback must be ${MAX_FEEDBACK_LENGTH.toLocaleString()} characters or fewer.`,
  )
})
