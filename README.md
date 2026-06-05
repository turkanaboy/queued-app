# Queued

Queued is a shared multimedia recommendation app for movies, TV, books, and albums.

## Product Vision

Queued has two related surfaces:

- **Friend/shared list:** visiting a friend's list is a shared multimedia playlist between you and that person. It shows recommendations sent in either direction, with statuses, comments, ratings, and availability links.
- **Profile queue:** your own profile is the personal task list of things to watch, read, or listen to. It combines titles you added yourself with titles recommended by friends or Queued Bot.

Every title in the personal queue should have an origin:

- `Added by you`
- `Recommended by <friend>`
- `Recommended by Queued Bot`

The personal queue can be filtered by:

- Origin: all, mine, recommendations
- Status: new, queued, in progress, skipped, bailed, finished
- Media type: movies, TV, books, albums

## Queued Bot

Queued Bot creates a bot friendship and can recommend one active title at a time. If the user already has a bot recommendation with `new`, `queued`, or `in progress` status, the bot waits until that title is marked `skipped`, `bailed`, or `finished` before adding another.

Today it recommends a strong movie or TV candidate available on the user's selected platforms, nudged by favorite genres and watching style when those intake fields exist.

The intended future behavior is richer: Queued Bot should use onboarding intake, selected platforms, favorite genres, watching style, and the user's ratings history to make recommendations with more critical capacity. In practice, this means it should learn from what the user likes and dislikes, explain why a title fits, and avoid acting like a generic trending carousel.

## Current Implementation Notes

- Self-added queue items live in `user_media_log`.
- Incoming friend and bot recommendations live in `recommendations`.
- `user_media_log.status` tracks personal task status for self-added titles.
- Recommendation status still lives on `recommendations.recipient_status`, and profile merges those recommendations into the personal queue view.
- Queued Bot is triggered from the profile queue and is limited to one active recommendation per user.
- Adding a title to the queue from Discover saves it without a rating.
- Rating a title marks it as finished.
