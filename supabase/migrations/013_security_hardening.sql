-- ============================================================
-- QUEUED - Migration 013: Security hardening
-- ============================================================

-- Friend requests can only be accepted by the receiving party. Declines still
-- use DELETE, which either party can perform under the existing delete policy.
drop policy if exists "friendships: update" on public.friendships;
drop policy if exists "friendships: accept incoming" on public.friendships;

revoke update on public.friendships from authenticated;
grant update (status, updated_at) on public.friendships to authenticated;

create policy "friendships: accept incoming"
  on public.friendships for update
  to authenticated
  using (
    status = 'pending'
    and requester_id <> auth.uid()
    and (user_a_id = auth.uid() or user_b_id = auth.uid())
  )
  with check (
    status = 'accepted'
    and requester_id <> auth.uid()
    and (user_a_id = auth.uid() or user_b_id = auth.uid())
  );

-- Recommendation sends must target accepted friends. The bot uses the service
-- role in Edge Functions and bypasses RLS after verifying the caller.
drop policy if exists "recommendations: insert" on public.recommendations;
drop policy if exists "recommendations: insert friend" on public.recommendations;

create policy "recommendations: insert friend"
  on public.recommendations for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and recipient_id <> auth.uid()
    and public.are_friends(sender_id, recipient_id)
  );

-- Do not expose full finished recommendation rows to arbitrary friends. The
-- app can add a privacy-safe activity view/RPC later if it needs this surface.
drop policy if exists "recommendations: read finished as friend" on public.recommendations;

-- Keep the broad update grant for PostgREST upserts, but enforce the actual
-- column-level contract in a trigger:
--   sender:    may only set deleted_at
--   recipient: may only update recipient_status and rating
create or replace function public.enforce_recommendation_update_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_auth_role text := auth.role();
begin
  if current_auth_role = 'service_role'
     or current_user in ('postgres', 'supabase_admin')
  then
    return new;
  end if;

  if current_user_id is null then
    raise exception 'authenticated user required';
  end if;

  if old.sender_id = current_user_id then
    if new.deleted_at is distinct from old.deleted_at
       and new.id is not distinct from old.id
       and new.sender_id is not distinct from old.sender_id
       and new.recipient_id is not distinct from old.recipient_id
       and new.media_type is not distinct from old.media_type
       and new.media_id is not distinct from old.media_id
       and new.media_title is not distinct from old.media_title
       and new.media_creator is not distinct from old.media_creator
       and new.media_poster_url is not distinct from old.media_poster_url
       and new.note is not distinct from old.note
       and new.recipient_status is not distinct from old.recipient_status
       and new.rating is not distinct from old.rating
       and new.streaming_providers is not distinct from old.streaming_providers
       and new.created_at is not distinct from old.created_at
    then
      return new;
    end if;

    raise exception 'senders may only update deleted_at';
  end if;

  if old.recipient_id = current_user_id and old.deleted_at is null then
    if new.id is not distinct from old.id
       and new.sender_id is not distinct from old.sender_id
       and new.recipient_id is not distinct from old.recipient_id
       and new.media_type is not distinct from old.media_type
       and new.media_id is not distinct from old.media_id
       and new.media_title is not distinct from old.media_title
       and new.media_creator is not distinct from old.media_creator
       and new.media_poster_url is not distinct from old.media_poster_url
       and new.note is not distinct from old.note
       and new.deleted_at is not distinct from old.deleted_at
       and new.streaming_providers is not distinct from old.streaming_providers
       and new.created_at is not distinct from old.created_at
    then
      return new;
    end if;

    raise exception 'recipients may only update recipient_status and rating';
  end if;

  raise exception 'not allowed to update this recommendation';
end;
$$;

drop trigger if exists enforce_recommendation_update_scope on public.recommendations;
create trigger enforce_recommendation_update_scope
  before update on public.recommendations
  for each row execute function public.enforce_recommendation_update_scope();

-- Prevent personal log ownership transfer during updates/upserts.
drop policy if exists "media_log: update own" on public.user_media_log;

create policy "media_log: update own"
  on public.user_media_log for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Remove full-row friend access to media logs. This prevents friends from
-- selecting reviews, providers, source metadata, and any future private fields.
drop policy if exists "media_log: read as friend" on public.user_media_log;

-- Privacy-safe friend surfaces. These intentionally expose a fixed column set
-- and keep the auth.uid() friendship predicate inside the view.
create or replace view public.friend_media_log
with (security_barrier = true)
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
from public.user_media_log
where user_id = auth.uid()
   or public.are_friends(auth.uid(), user_id);

create or replace view public.friend_recommendation_activity
with (security_barrier = true)
as
select
  id,
  recipient_id,
  media_title,
  media_poster_url,
  media_type,
  rating,
  created_at
from public.recommendations
where recipient_status = 'finished'
  and deleted_at is null
  and (
    recipient_id = auth.uid()
    or public.are_friends(auth.uid(), recipient_id)
  );

grant select on public.friend_media_log to authenticated;
grant select on public.friend_recommendation_activity to authenticated;
