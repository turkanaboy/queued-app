export function ratingToStep(rating) {
  return rating == null ? null : Number(rating) * 2
}

export function stepToRating(step) {
  return step == null ? null : Number(step) / 2
}

export function ratingLabel(step) {
  return String(step)
}

export function displayRating(rating) {
  return rating == null ? null : String(Number(rating) * 2)
}
