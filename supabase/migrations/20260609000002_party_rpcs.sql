-- ============================================================
-- QUEUED — Migration: Parties RPCs (join + pick)
-- ============================================================

-- ── join_party ────────────────────────────────────────────────
-- Accepts an invite token, adds the caller to the party, and
-- returns the party_id for client-side navigation.
-- Idempotent: calling while already a member just returns party_id.
create or replace function public.join_party(p_invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_party_id uuid;
begin
  if p_invite_token is null then
    raise exception 'invite token required';
  end if;

  select id into v_party_id
  from public.parties
  where invite_token = p_invite_token;

  if v_party_id is null then
    raise exception 'invalid invite token';
  end if;

  -- Insert membership; no-op if already a member
  insert into public.party_members (party_id, user_id)
  values (v_party_id, auth.uid())
  on conflict (party_id, user_id) do nothing;

  return v_party_id;
end;
$$;

revoke all on function public.join_party(uuid) from public, anon;
grant execute on function public.join_party(uuid) to authenticated;

-- ── pick_party_item ───────────────────────────────────────────
-- Marks a party list item as watched and fans out a 'finished'
-- entry to every party member's user_media_log atomically.
-- Runs in a single transaction: if any upsert fails, the item
-- stays unwatched and the caller can retry.
create or replace function public.pick_party_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item  record;
  v_uid   uuid;
begin
  select * into v_item
  from public.party_list_items
  where id = p_item_id;

  if v_item is null then
    raise exception 'item not found';
  end if;

  if not exists (
    select 1 from public.party_members
    where party_id = v_item.party_id and user_id = auth.uid()
  ) then
    raise exception 'not a party member';
  end if;

  if v_item.status = 'watched' then
    raise exception 'item already picked';
  end if;

  -- Mark as watched
  update public.party_list_items
  set status     = 'watched',
      watched_at = now(),
      picked_by  = auth.uid()
  where id = p_item_id;

  -- Fan out to every member's personal media log
  for v_uid in (
    select user_id from public.party_members where party_id = v_item.party_id
  ) loop
    insert into public.user_media_log (
      user_id,
      media_type,
      media_id,
      media_title,
      media_creator,
      media_poster_url,
      status,
      source_type,
      created_at
    )
    values (
      v_uid,
      v_item.media_type,
      v_item.media_id,
      v_item.media_title,
      v_item.media_creator,
      v_item.media_poster_url,
      'finished',
      'self',
      now()
    )
    on conflict on constraint unique_user_media_log
    do update set status = 'finished';
  end loop;
end;
$$;

revoke all on function public.pick_party_item(uuid) from public, anon;
grant execute on function public.pick_party_item(uuid) to authenticated;
