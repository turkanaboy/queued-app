-- Use the actual user_media_log unique index columns for party pick fan-out.
-- The index is named unique_user_media_log, but it is not a table constraint,
-- so ON CONFLICT ON CONSTRAINT cannot target it.

create or replace function public.pick_party_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_uid uuid;
  v_picker_id uuid;
  v_watched_count integer;
  v_member_count integer;
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

  select count(*) into v_member_count
  from public.party_members
  where party_id = v_item.party_id;

  select count(*) into v_watched_count
  from public.party_list_items
  where party_id = v_item.party_id
    and status = 'watched';

  select user_id into v_picker_id
  from public.party_members
  where party_id = v_item.party_id
  order by joined_at asc
  offset mod(v_watched_count, greatest(v_member_count, 1))
  limit 1;

  if v_picker_id is distinct from auth.uid() then
    raise exception 'not your turn to pick';
  end if;

  update public.party_list_items
  set status = 'watched',
      watched_at = now(),
      picked_by = auth.uid()
  where id = p_item_id;

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
      v_item.media_type::public.media_type,
      v_item.media_id,
      v_item.media_title,
      v_item.media_creator,
      v_item.media_poster_url,
      'finished',
      'self',
      now()
    )
    on conflict (user_id, media_type, media_id)
    do update set
      media_title = excluded.media_title,
      media_creator = excluded.media_creator,
      media_poster_url = excluded.media_poster_url,
      status = 'finished';
  end loop;
end;
$$;

revoke all on function public.pick_party_item(uuid) from public, anon;
grant execute on function public.pick_party_item(uuid) to authenticated;
