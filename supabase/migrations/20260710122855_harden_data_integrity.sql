-- Close party state-transition and vote-integrity gaps, make recommendation
-- state changes atomic, and correct cross-media identity constraints.

-- Party item state is RPC-owned. Members may still add and read items, but
-- cannot forge picked/watched state through the Data API.
drop policy if exists "party_list_items: update as member" on public.party_list_items;
revoke update, delete on public.party_list_items from authenticated;

-- One active rotating pick per party, including under concurrent requests.
create unique index if not exists party_list_items_one_picked_idx
  on public.party_list_items (party_id)
  where status = 'picked';

-- A vote's party must be the same party as its item.
delete from public.party_votes vote
where not exists (
  select 1
  from public.party_list_items item
  where item.id = vote.party_item_id
    and item.party_id = vote.party_id
);

alter table public.party_list_items
  add constraint party_list_items_id_party_unique unique (id, party_id);

alter table public.party_votes
  add constraint party_votes_item_party_fkey
  foreign key (party_item_id, party_id)
  references public.party_list_items (id, party_id)
  on delete cascade;

drop policy if exists "party_votes: insert own" on public.party_votes;
create policy "party_votes: insert own"
  on public.party_votes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_party_member(party_id)
  );

drop policy if exists "party_votes: update own" on public.party_votes;
create policy "party_votes: update own"
  on public.party_votes for update to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_party_member(party_id)
  )
  with check (
    user_id = (select auth.uid())
    and public.is_party_member(party_id)
  );

drop policy if exists "party_votes: delete own" on public.party_votes;
create policy "party_votes: delete own"
  on public.party_votes for delete to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_party_member(party_id)
  );

create or replace function public.pick_party_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.party_list_items%rowtype;
  v_picker_id uuid;
  v_watched_count integer;
  v_member_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  -- Lock the party row so two item picks in the same party serialize.
  perform 1
  from public.parties party
  join public.party_list_items item on item.party_id = party.id
  where item.id = p_item_id
    and party.mode = 'rotating_picker'
  for update of party;

  if not found then
    raise exception 'rotating group item not found';
  end if;

  select * into v_item
  from public.party_list_items
  where id = p_item_id
  for update;

  if not exists (
    select 1 from public.party_members
    where party_id = v_item.party_id
      and user_id = (select auth.uid())
  ) then
    raise exception 'not a party member';
  end if;

  if v_item.status <> 'unwatched' then
    raise exception 'item already picked';
  end if;

  if exists (
    select 1 from public.party_list_items
    where party_id = v_item.party_id and status = 'picked'
  ) then
    raise exception 'finish the current pick first';
  end if;

  select count(*) into v_member_count
  from public.party_members
  where party_id = v_item.party_id;

  select count(*) into v_watched_count
  from public.party_list_items
  where party_id = v_item.party_id and status = 'watched';

  select user_id into v_picker_id
  from public.party_members
  where party_id = v_item.party_id
  order by joined_at, user_id
  offset mod(v_watched_count, greatest(v_member_count, 1))
  limit 1;

  if v_picker_id is distinct from (select auth.uid()) then
    raise exception 'not your turn to pick';
  end if;

  update public.party_list_items
  set status = 'picked', picked_by = (select auth.uid())
  where id = p_item_id and status = 'unwatched';

  if not found then
    raise exception 'item already picked';
  end if;
end;
$$;

create or replace function public.finish_party_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.party_list_items%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  select item.* into v_item
  from public.party_list_items item
  join public.parties party on party.id = item.party_id
  where item.id = p_item_id
    and party.mode = 'rotating_picker'
  for update of item;

  if v_item is null then
    raise exception 'rotating group item not found';
  end if;

  if not exists (
    select 1 from public.party_members
    where party_id = v_item.party_id
      and user_id = (select auth.uid())
  ) then
    raise exception 'not a party member';
  end if;

  if v_item.status <> 'picked' then
    raise exception 'item is not picked';
  end if;

  if v_item.picked_by is distinct from (select auth.uid()) then
    raise exception 'only the picker can mark finished';
  end if;

  update public.party_list_items
  set status = 'watched', watched_at = now()
  where id = p_item_id and status = 'picked';

  insert into public.user_media_log (
    user_id,
    media_type,
    media_id,
    media_title,
    media_creator,
    media_poster_url,
    status,
    source_type,
    source_user_id,
    created_at
  )
  select
    member.user_id,
    v_item.media_type::public.media_type,
    v_item.media_id,
    v_item.media_title,
    v_item.media_creator,
    v_item.media_poster_url,
    'finished',
    'party',
    v_item.picked_by,
    now()
  from public.party_members member
  where member.party_id = v_item.party_id
  on conflict (user_id, media_type, media_id)
  do update set
    media_title = excluded.media_title,
    media_creator = excluded.media_creator,
    media_poster_url = excluded.media_poster_url,
    status = 'finished',
    source_type = 'party',
    source_user_id = excluded.source_user_id,
    created_at = now();
end;
$$;

revoke all on function public.pick_party_item(uuid) from public, anon;
grant execute on function public.pick_party_item(uuid) to authenticated;
revoke all on function public.finish_party_item(uuid) from public, anon;
grant execute on function public.finish_party_item(uuid) to authenticated;

-- Cross-media IDs are source-local, so media_type is part of identity.
drop index if exists public.unique_active_recommendation;
create unique index unique_active_recommendation
  on public.recommendations (sender_id, recipient_id, media_type, media_id)
  where deleted_at is null;

with ranked_bot_recommendations as (
  select id,
         row_number() over (partition by recipient_id order by created_at desc, id desc) as position
  from public.recommendations
  where sender_id = '00000000-0000-0000-0000-000000000001'::uuid
    and recipient_status in ('not_yet_viewed', 'queued', 'in_progress')
    and deleted_at is null
)
update public.recommendations recommendation
set recipient_status = 'skipped'
from ranked_bot_recommendations ranked
where recommendation.id = ranked.id
  and ranked.position > 1;

create unique index if not exists one_active_bot_recommendation
  on public.recommendations (sender_id, recipient_id)
  where sender_id = '00000000-0000-0000-0000-000000000001'::uuid
    and recipient_status in ('not_yet_viewed', 'queued', 'in_progress')
    and deleted_at is null;

-- Recipient-owned, atomic recommendation + personal-log transition.
create or replace function public.set_recommendation_state(
  p_recommendation_id uuid,
  p_status public.recipient_status,
  p_rating numeric default null,
  p_review text default null,
  p_streaming_providers jsonb default null
)
returns public.recommendations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.recommendations%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  select * into v_rec
  from public.recommendations
  where id = p_recommendation_id
    and recipient_id = (select auth.uid())
    and deleted_at is null
  for update;

  if v_rec is null then
    raise exception 'recommendation not found';
  end if;

  if p_rating is not null and p_status <> 'finished' then
    raise exception 'ratings require finished status';
  end if;

  update public.recommendations
  set recipient_status = p_status,
      rating = case when p_status = 'finished' then p_rating else null end
  where id = v_rec.id
  returning * into v_rec;

  if p_status not in ('not_yet_viewed', 'skipped') then
    insert into public.user_media_log (
      user_id,
      media_type,
      media_id,
      media_title,
      media_creator,
      media_poster_url,
      rating,
      review,
      status,
      source_type,
      source_user_id,
      streaming_providers,
      created_at
    )
    values (
      v_rec.recipient_id,
      v_rec.media_type,
      v_rec.media_id,
      v_rec.media_title,
      v_rec.media_creator,
      v_rec.media_poster_url,
      v_rec.rating,
      nullif(trim(p_review), ''),
      v_rec.recipient_status,
      'recommendation',
      v_rec.sender_id,
      coalesce(p_streaming_providers, v_rec.streaming_providers, '[]'::jsonb),
      now()
    )
    on conflict (user_id, media_type, media_id)
    do update set
      media_title = excluded.media_title,
      media_creator = excluded.media_creator,
      media_poster_url = excluded.media_poster_url,
      rating = excluded.rating,
      review = case
        when p_review is null then public.user_media_log.review
        else nullif(trim(p_review), '')
      end,
      status = excluded.status,
      source_type = 'recommendation',
      source_user_id = excluded.source_user_id,
      streaming_providers = case
        when p_streaming_providers is null then public.user_media_log.streaming_providers
        else p_streaming_providers
      end,
      created_at = now();
  else
    update public.user_media_log
    set status = p_status,
        rating = null,
        created_at = now()
    where user_id = v_rec.recipient_id
      and media_type = v_rec.media_type
      and media_id = v_rec.media_id
      and source_type = 'recommendation';
  end if;

  return v_rec;
end;
$$;

revoke all on function public.set_recommendation_state(uuid, public.recipient_status, numeric, text, jsonb)
  from public, anon;
grant execute on function public.set_recommendation_state(uuid, public.recipient_status, numeric, text, jsonb)
  to authenticated;

-- Atomic, service-role-only quota used by expensive Edge Functions.
create schema if not exists private;

create table if not exists private.edge_rate_limits (
  user_id uuid not null,
  action text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, action)
);

revoke all on private.edge_rate_limits from public, anon, authenticated;

create or replace function public.consume_edge_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_user_id is null
     or p_action is null
     or p_limit < 1
     or p_window_seconds < 1 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into private.edge_rate_limits (user_id, action, window_started_at, request_count)
  values (p_user_id, p_action, now(), 1)
  on conflict (user_id, action)
  do update set
    window_started_at = case
      when private.edge_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now()
      else private.edge_rate_limits.window_started_at
    end,
    request_count = case
      when private.edge_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1
      else private.edge_rate_limits.request_count + 1
    end
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_edge_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(uuid, text, integer, integer)
  to service_role;

-- Account self-service export validates the caller's JWT before using the
-- service role, which still needs explicit table privileges.
grant select on table
  public.comments,
  public.parties,
  public.party_members,
  public.party_list_items,
  public.party_votes,
  public.invite_links
to service_role;

-- Commit trivia turns under one row lock so retries and concurrent requests
-- cannot both advance or complete the same challenge.
create or replace function public.commit_trivia_score(
  p_challenge_id uuid,
  p_user_id uuid,
  p_score integer
)
returns public.trivia_challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge public.trivia_challenges%rowtype;
begin
  if p_score < 0 then
    raise exception 'invalid score';
  end if;

  select * into v_challenge
  from public.trivia_challenges
  where id = p_challenge_id
  for update;

  if v_challenge is null then
    raise exception 'challenge not found';
  end if;

  if v_challenge.status in ('pending_initiator', 'pending_challenger')
     and v_challenge.expires_at <= now() then
    update public.trivia_challenges
    set questions = null, status = 'expired'
    where id = p_challenge_id
    returning * into v_challenge;

    delete from private.trivia_answer_keys where challenge_id = p_challenge_id;
    return v_challenge;
  end if;

  if p_user_id = v_challenge.initiator_id
     and v_challenge.status = 'pending_initiator' then
    update public.trivia_challenges
    set initiator_score = p_score, status = 'pending_challenger'
    where id = p_challenge_id
    returning * into v_challenge;
    return v_challenge;
  end if;

  if p_user_id = v_challenge.challenger_id
     and v_challenge.status = 'pending_challenger' then
    update public.trivia_challenges
    set challenger_score = p_score,
        status = 'completed',
        questions = null,
        completed_at = now()
    where id = p_challenge_id
    returning * into v_challenge;

    delete from private.trivia_answer_keys where challenge_id = p_challenge_id;
    return v_challenge;
  end if;

  if p_user_id <> v_challenge.initiator_id
     and p_user_id <> v_challenge.challenger_id then
    raise exception 'forbidden';
  end if;

  raise exception 'not your turn';
end;
$$;

revoke all on function public.commit_trivia_score(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.commit_trivia_score(uuid, uuid, integer)
  to service_role;

-- Store the public challenge and private answer key in one transaction.
create or replace function public.create_trivia_challenge(
  p_initiator_id uuid,
  p_challenger_id uuid,
  p_mode public.trivia_mode,
  p_media_types text[],
  p_public_questions jsonb,
  p_answer_key jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge_id uuid;
begin
  if p_initiator_id = p_challenger_id then
    raise exception 'cannot challenge yourself';
  end if;

  insert into public.trivia_challenges (
    initiator_id, challenger_id, mode, media_types, status, questions
  ) values (
    p_initiator_id,
    p_challenger_id,
    p_mode,
    p_media_types,
    'pending_initiator',
    p_public_questions
  )
  returning id into v_challenge_id;

  insert into private.trivia_answer_keys (challenge_id, questions)
  values (v_challenge_id, p_answer_key);

  return v_challenge_id;
end;
$$;

revoke all on function public.create_trivia_challenge(uuid, uuid, public.trivia_mode, text[], jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_trivia_challenge(uuid, uuid, public.trivia_mode, text[], jsonb, jsonb)
  to service_role;

-- Minimal group lifecycle operations. Direct table permissions stay narrow;
-- each operation owns its authorization and state rules.
create or replace function public.rename_party(p_party_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_name is null or length(trim(p_name)) = 0 or length(trim(p_name)) > 60 then
    raise exception 'group name must be between 1 and 60 characters';
  end if;

  update public.parties
  set name = trim(p_name)
  where id = p_party_id and creator_id = (select auth.uid());

  if not found then raise exception 'only the group creator can rename it'; end if;
end;
$$;

create or replace function public.leave_party(p_party_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.parties
    where id = p_party_id and creator_id = (select auth.uid())
  ) then
    raise exception 'the group creator must delete the group';
  end if;

  if exists (
    select 1 from public.party_list_items
    where party_id = p_party_id
      and status = 'picked'
      and picked_by = (select auth.uid())
  ) then
    raise exception 'finish the current pick before leaving the group';
  end if;

  delete from public.party_members
  where party_id = p_party_id and user_id = (select auth.uid());

  if not found then raise exception 'not a group member'; end if;
end;
$$;

create or replace function public.remove_party_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.party_list_items item
  using public.parties party
  where item.id = p_item_id
    and party.id = item.party_id
    and item.status = 'unwatched'
    and (item.added_by = (select auth.uid()) or party.creator_id = (select auth.uid()));

  if not found then raise exception 'only an unwatched item you added can be removed'; end if;
end;
$$;

create or replace function public.remove_party_member(p_party_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id = (select auth.uid()) then
    raise exception 'use leave_party to leave a group';
  end if;

  if exists (
    select 1 from public.party_list_items
    where party_id = p_party_id
      and status = 'picked'
      and picked_by = p_user_id
  ) then
    raise exception 'finish the member''s current pick before removing them';
  end if;

  delete from public.party_members member
  using public.parties party
  where member.party_id = p_party_id
    and member.user_id = p_user_id
    and party.id = member.party_id
    and party.creator_id = (select auth.uid())
    and member.user_id <> party.creator_id;

  if not found then raise exception 'only the group creator can remove that member'; end if;
end;
$$;

revoke all on function public.rename_party(uuid, text) from public, anon;
revoke all on function public.leave_party(uuid) from public, anon;
revoke all on function public.remove_party_item(uuid) from public, anon;
revoke all on function public.remove_party_member(uuid, uuid) from public, anon;
grant execute on function public.rename_party(uuid, text) to authenticated;
grant execute on function public.leave_party(uuid) to authenticated;
grant execute on function public.remove_party_item(uuid) to authenticated;
grant execute on function public.remove_party_member(uuid, uuid) to authenticated;

delete from public.comments where length(trim(body)) = 0;
update public.comments set body = left(body, 1000) where length(body) > 1000;
alter table public.comments
  add constraint comments_body_length check (length(trim(body)) between 1 and 1000);

update public.users set watching_style = left(watching_style, 280)
where watching_style is not null and length(watching_style) > 280;
alter table public.users
  add constraint users_watching_style_length check (watching_style is null or length(watching_style) <= 280);
