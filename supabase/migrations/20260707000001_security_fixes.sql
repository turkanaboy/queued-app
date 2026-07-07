-- ============================================================
-- QUEUED — Migration: security fixes
--   1. Hide users.email from the client API
--   2. Move trivia answer keys out of client reach
--   3. Expire unanswered challenges in both pending states
-- ============================================================

-- ── 1. users.email privacy ────────────────────────────────────
-- The select RLS policy on users is using(true), so any authenticated user
-- could `select email from users` for every account. The app never reads
-- email from this table; restrict the API to public profile columns.
-- (Clients must select explicit columns from users — select('*') will now
-- fail with a column permission error.)
revoke select on public.users from authenticated, anon;
grant select (id, username, display_name, created_at, platforms, favorite_genres, watching_style)
  on public.users to authenticated;

-- ── 2. Trivia answer keys ─────────────────────────────────────
-- questions stored correct_index / accepted_answers / correct_display in a
-- column participants can select — the quiz shipped with its own answer key.
-- Keep the full key in a private table reachable only through service-role
-- definer RPCs; the public row keeps sanitized questions.
create schema if not exists private;

create table if not exists private.trivia_answer_keys (
  challenge_id uuid primary key references public.trivia_challenges(id) on delete cascade,
  questions    jsonb not null
);

revoke all on private.trivia_answer_keys from public, anon, authenticated;

-- Backfill keys for in-flight challenges, then strip answers from public rows.
insert into private.trivia_answer_keys (challenge_id, questions)
select id, questions
from public.trivia_challenges
where questions is not null
on conflict (challenge_id) do nothing;

update public.trivia_challenges
set questions = (
  select jsonb_agg(q - 'correct_index' - 'accepted_answers' - 'correct_display')
  from jsonb_array_elements(questions) as q
)
where questions is not null;

-- Service-role-only accessors (the private schema is not exposed over
-- PostgREST, so edge functions go through these public definer RPCs).
create or replace function public.store_trivia_answer_key(p_challenge_id uuid, p_questions jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.trivia_answer_keys (challenge_id, questions)
  values (p_challenge_id, p_questions)
  on conflict (challenge_id) do update set questions = excluded.questions;
$$;

create or replace function public.get_trivia_answer_key(p_challenge_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select questions from private.trivia_answer_keys where challenge_id = p_challenge_id;
$$;

revoke all on function public.store_trivia_answer_key(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_trivia_answer_key(uuid) from public, anon, authenticated;
grant execute on function public.store_trivia_answer_key(uuid, jsonb) to service_role;
grant execute on function public.get_trivia_answer_key(uuid) to service_role;

-- ── 3. Expire unanswered challenges in both pending states ────
-- Previously only pending_challenger rows expired; a challenge the initiator
-- never played kept its questions (and its badge) forever.
create or replace function public.wipe_expired_trivia_questions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trivia_challenges
  set questions = null, status = 'expired'
  where status in ('pending_initiator', 'pending_challenger')
    and expires_at < now();

  delete from private.trivia_answer_keys k
  using public.trivia_challenges tc
  where k.challenge_id = tc.id
    and tc.status in ('expired', 'completed');
end;
$$;
