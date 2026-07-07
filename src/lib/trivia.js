import { supabase } from './supabase'
import { invokeEdgeFunction } from './edgeFunctions'

// Max points per game: 10 MCQs x 1pt + fill-in-the-blank bonus x 3pts.
export const MAX_SCORE = 13

/**
 * Kick off a new trivia challenge. Calls the generate-trivia edge function
 * which builds questions and inserts the challenge row.
 *
 * @param {string} initiatorId
 * @param {string} challengerId
 * @param {'balanced'|'my_media'|'random'} mode
 * @param {string[]} mediaTypes  e.g. ['movie','tv','book','album']
 * @returns {Promise<{ challenge_id: string }>}
 */
export async function generateChallenge(initiatorId, challengerId, mode, mediaTypes) {
  return invokeEdgeFunction('generate-trivia', {
    method: 'POST',
    body: {
      initiator_id: initiatorId,
      challenger_id: challengerId,
      mode,
      media_types: mediaTypes,
    },
  })
}

/**
 * Submit answers for a challenge. The answers array must have exactly 11
 * entries: positions 0–9 are numbers (0–3 = selected option index, -1 =
 * timed out), position 10 is a string (typed answer for Q11, "" = timed out).
 *
 * @param {string} challengeId
 * @param {(number|string)[]} answers  length 11
 * @returns {Promise<object>}
 */
export async function submitAnswers(challengeId, answers) {
  return invokeEdgeFunction('submit-trivia', {
    method: 'POST',
    body: { challenge_id: challengeId, answers },
  })
}

/**
 * Fetch a single challenge by ID, including the full questions array.
 * Used by TriviaChallengePage to display questions and reveal correct answers.
 *
 * Also joins initiator and challenger user rows for display names.
 *
 * @param {string} challengeId
 * @returns {Promise<object|null>}
 */
export async function fetchChallenge(challengeId) {
  const { data, error } = await supabase
    .from('trivia_challenges')
    .select(`
      *,
      initiator:users!trivia_challenges_initiator_id_fkey(id, username, display_name),
      challenger:users!trivia_challenges_challenger_id_fkey(id, username, display_name)
    `)
    .eq('id', challengeId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Fetch all challenges for a user (as initiator or challenger).
 * Strips the questions column — history display never needs question content.
 * Joins opponent user rows for display.
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function fetchMyChallenges(userId) {
  const { data, error } = await supabase
    .from('trivia_challenges')
    .select(`
      id,
      initiator_id,
      challenger_id,
      mode,
      media_types,
      status,
      initiator_score,
      challenger_score,
      created_at,
      completed_at,
      initiator:users!trivia_challenges_initiator_id_fkey(id, username, display_name),
      challenger:users!trivia_challenges_challenger_id_fkey(id, username, display_name)
    `)
    .or(`initiator_id.eq.${userId},challenger_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Fetch challenges where it is the user's turn to act (or they are waiting
 * for the challenger). Used for the notification badge and FriendsPage cards.
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function getPendingForUser(userId) {
  const { data, error } = await supabase
    .from('trivia_challenges')
    .select(`
      id,
      initiator_id,
      challenger_id,
      mode,
      media_types,
      status,
      initiator_score,
      created_at,
      expires_at,
      initiator:users!trivia_challenges_initiator_id_fkey(id, username, display_name),
      challenger:users!trivia_challenges_challenger_id_fkey(id, username, display_name)
    `)
    .or(
      `and(initiator_id.eq.${userId},status.eq.pending_initiator),` +
      `and(challenger_id.eq.${userId},status.eq.pending_challenger),` +
      `and(initiator_id.eq.${userId},status.eq.pending_challenger)`
    )
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}
