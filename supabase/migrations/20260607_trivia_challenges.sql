-- ============================================================
-- QUEUED — Migration: Trivia challenge feature
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────
create type trivia_mode as enum ('balanced', 'my_media', 'random');

create type trivia_status as enum (
  'pending_initiator',
  'pending_challenger',
  'completed',
  'expired'
);

-- ── Table ─────────────────────────────────────────────────────
create table public.trivia_challenges (
  id               uuid primary key default gen_random_uuid(),
  initiator_id     uuid not null references public.users(id) on delete cascade,
  challenger_id    uuid not null references public.users(id) on delete cascade,
  mode             trivia_mode not null,
  media_types      text[] not null default '{}',
  status           trivia_status not null default 'pending_initiator',

  -- Temporary: 11 question objects, wiped when challenge completes or expires.
  -- Q1–Q10 are multiple_choice; Q11 (index 10) is fill_in_blank worth 3 pts.
  questions        jsonb,

  -- Scores (0–13). Null until each player submits.
  initiator_score  int check (initiator_score is null or (initiator_score >= 0 and initiator_score <= 13)),
  challenger_score int check (challenger_score is null or (challenger_score >= 0 and challenger_score <= 13)),

  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '48 hours',
  completed_at     timestamptz
);

create index trivia_challenges_initiator_status_idx
  on public.trivia_challenges (initiator_id, status);

create index trivia_challenges_challenger_status_idx
  on public.trivia_challenges (challenger_id, status);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.trivia_challenges enable row level security;

-- Participants can read their own challenges
create policy "trivia: select as participant"
  on public.trivia_challenges for select to authenticated
  using (initiator_id = auth.uid() or challenger_id = auth.uid());

-- Only service role may insert (edge functions use service role key)
create policy "trivia: insert service role only"
  on public.trivia_challenges for insert to service_role
  with check (true);

-- Only service role may update
create policy "trivia: update service role only"
  on public.trivia_challenges for update to service_role
  using (true);

grant select on public.trivia_challenges to authenticated;
grant insert, update on public.trivia_challenges to service_role;

-- ── Realtime ──────────────────────────────────────────────────
alter publication supabase_realtime add table public.trivia_challenges;

-- ── Cleanup function ──────────────────────────────────────────
-- Nulls questions and marks expired for challenges that sat in
-- pending_challenger longer than their expiry window.
-- Called as housekeeping from the submit-trivia edge function.
create or replace function public.wipe_expired_trivia_questions()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.trivia_challenges
  set
    questions = null,
    status    = 'expired'
  where
    status    = 'pending_challenger'
    and expires_at < now();
end;
$$;
