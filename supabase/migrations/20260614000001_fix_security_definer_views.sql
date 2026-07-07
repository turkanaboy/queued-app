-- ============================================================
-- QUEUED - Migration: fix Security Definer View advisor findings
-- ============================================================

-- Supabase's advisor flags public views that run with the view owner's
-- privileges. Keep the public API as invoker views, and move the intentionally
-- privileged read into non-exposed private-schema functions with fixed columns.
create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to anon, authenticated;

drop view if exists public.friend_media_log;
drop view if exists public.friend_recommendation_activity;

create or replace function private.friend_media_log_rows()
returns table (
  id uuid,
  user_id uuid,
  media_type public.media_type,
  media_id text,
  media_title text,
  media_creator text,
  media_poster_url text,
  rating numeric(2,1),
  status public.recipient_status,
  source_type text,
  source_user_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    uml.id,
    uml.user_id,
    uml.media_type,
    uml.media_id,
    uml.media_title,
    uml.media_creator,
    uml.media_poster_url,
    uml.rating,
    uml.status,
    uml.source_type,
    uml.source_user_id,
    uml.created_at
  from public.user_media_log as uml
  where (uml.user_id = auth.uid() or public.are_friends(auth.uid(), uml.user_id));
$$;

create or replace function private.friend_recommendation_activity_rows()
returns table (
  id uuid,
  recipient_id uuid,
  media_title text,
  media_poster_url text,
  media_type public.media_type,
  rating numeric(2,1),
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.recipient_id,
    r.media_title,
    r.media_poster_url,
    r.media_type,
    r.rating,
    r.created_at
  from public.recommendations as r
  where r.recipient_status = 'finished'
    and r.deleted_at is null
    and (r.recipient_id = auth.uid() or public.are_friends(auth.uid(), r.recipient_id));
$$;

revoke all on function private.friend_media_log_rows() from public, anon;
revoke all on function private.friend_recommendation_activity_rows() from public, anon;
grant execute on function private.friend_media_log_rows() to authenticated;
grant execute on function private.friend_recommendation_activity_rows() to authenticated;

create or replace view public.friend_media_log
with (security_invoker = true, security_barrier = true)
as
select
  id,
  user_id,
  media_type,
  media_id,
  media_title,
  media_creator,
  media_poster_url,
  rating,
  status,
  source_type,
  source_user_id,
  created_at
from private.friend_media_log_rows();

create or replace view public.friend_recommendation_activity
with (security_invoker = true, security_barrier = true)
as
select
  id,
  recipient_id,
  media_title,
  media_poster_url,
  media_type,
  rating,
  created_at
from private.friend_recommendation_activity_rows();

grant select on public.friend_media_log to authenticated;
grant select on public.friend_recommendation_activity to authenticated;
