import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ratingToStep, stepToRating, displayRating, ratingLabel } from './ratings.js'

// The app stores ratings on a 0.5–5.0 half-step scale and displays them doubled
// (a 1–10 scale). The bug these tests guard: SharedListPage once showed the raw
// stored value while ProfilePage showed the doubled value, so the same rating
// read as "4" in one place and "8" in another. displayRating is now the single
// display path — keep it consistent with the step round-trip.

test('step <-> rating round-trips', () => {
  for (let step = 1; step <= 10; step++) {
    assert.equal(ratingToStep(stepToRating(step)), step)
  }
})

test('displayRating doubles the stored 0.5-5 value', () => {
  assert.equal(displayRating(5), '10')
  assert.equal(displayRating(4), '8')
  assert.equal(displayRating(0.5), '1')
})

test('a stored rating displays the same as its step label', () => {
  // step (what the picker writes) === displayRating(stored value it maps to)
  for (let step = 1; step <= 10; step++) {
    assert.equal(displayRating(stepToRating(step)), ratingLabel(step))
  }
})

test('null ratings pass through', () => {
  assert.equal(ratingToStep(null), null)
  assert.equal(stepToRating(null), null)
  assert.equal(displayRating(null), null)
})
