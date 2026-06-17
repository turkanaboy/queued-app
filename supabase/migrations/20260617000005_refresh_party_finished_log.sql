-- Keep party-finished titles visible in each member's personal log by marking
-- the source and refreshing the log row recency on conflict.

create or replace function public.finish_party_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_uid uuid;
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

  if v_item.status <> 'picked' then
    raise exception 'item is not picked';
  end if;

  if v_item.picked_by is distinct from auth.uid() then
    raise exception 'only the picker can mark finished';
  end if;

  update public.party_list_items
  set status = 'watched',
      watched_at = now()
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
      source_user_id,
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
      'party',
      v_item.picked_by,
      now()
    )
    on conflict (user_id, media_type, media_id)
    do update set
      media_title = excluded.media_title,
      media_creator = excluded.media_creator,
      media_poster_url = excluded.media_poster_url,
      status = 'finished',
      source_type = 'party',
      source_user_id = excluded.source_user_id,
      created_at = now();
  end loop;
end;
$$;

revoke all on function public.finish_party_item(uuid) from public, anon;
grant execute on function public.finish_party_item(uuid) to authenticated;
