-- ============================================================
-- QUEUED — Migration 015: Merge duplicate @mariah account into @mariahrochelle
-- ============================================================
-- Duplicate (source):  ad30e9b8-5e52-476e-8041-db705411a17b  (@mariah)
-- Master (target):     8a97a757-d860-412c-b7a7-40d67390f851  (@mariahrochelle)
--
-- After this migration, run the following in the Supabase dashboard to also
-- delete the auth.users row for the duplicate:
--   DELETE FROM auth.users WHERE id = 'ad30e9b8-5e52-476e-8041-db705411a17b';

do $$
declare
  dup_id    uuid := 'ad30e9b8-5e52-476e-8041-db705411a17b';
  master_id uuid := '8a97a757-d860-412c-b7a7-40d67390f851';
  friend_id uuid;
  new_a     uuid;
  new_b     uuid;
begin

  -- 1. Merge media log: copy duplicate's entries to master, skip conflicts
  insert into public.user_media_log (
    user_id, media_type, media_id, media_title, media_creator, media_poster_url,
    rating, review, status, source_type, source_user_id, streaming_providers, created_at
  )
  select
    master_id,
    media_type, media_id, media_title, media_creator, media_poster_url,
    rating, review, status, source_type, source_user_id, streaming_providers, created_at
  from public.user_media_log
  where user_id = dup_id
  on conflict (user_id, media_type, media_id) do nothing;

  delete from public.user_media_log where user_id = dup_id;

  -- 2. Reroute sent recommendations
  -- Drop any sent recs from dup that would conflict with an existing active rec
  -- already sent by master to the same recipient for the same media.
  delete from public.recommendations
  where sender_id = dup_id
    and deleted_at is null
    and exists (
      select 1 from public.recommendations r2
      where r2.sender_id    = master_id
        and r2.recipient_id = recommendations.recipient_id
        and r2.media_id     = recommendations.media_id
        and r2.deleted_at is null
    );

  update public.recommendations set sender_id = master_id where sender_id = dup_id;

  -- 3. Reroute received recommendations
  -- Drop any recs on the duplicate that would conflict with an existing active rec
  -- on the master (same sender + same media already sent to master).
  delete from public.recommendations
  where recipient_id = dup_id
    and deleted_at is null
    and exists (
      select 1 from public.recommendations r2
      where r2.recipient_id = master_id
        and r2.sender_id    = recommendations.sender_id
        and r2.media_id     = recommendations.media_id
        and r2.deleted_at is null
    );

  update public.recommendations set recipient_id = master_id where recipient_id = dup_id;

  -- 4. Reroute source_user_id references in media log
  update public.user_media_log set source_user_id = master_id where source_user_id = dup_id;

  -- 5. Handle friendships
  -- Remove any direct friendship between duplicate and master (same person)
  delete from public.friendships
  where (user_a_id = dup_id and user_b_id = master_id)
     or (user_a_id = master_id and user_b_id = dup_id);

  -- For each remaining friendship involving the duplicate, re-register it under master.
  -- Friendships are stored with user_a_id = LEAST(a,b), user_b_id = GREATEST(a,b).
  for friend_id in
    select case when user_a_id = dup_id then user_b_id else user_a_id end
    from public.friendships
    where user_a_id = dup_id or user_b_id = dup_id
  loop
    new_a := least(master_id, friend_id);
    new_b := greatest(master_id, friend_id);

    insert into public.friendships (user_a_id, user_b_id, requester_id, status)
    select new_a, new_b,
      case when requester_id = dup_id then master_id else requester_id end,
      status
    from public.friendships
    where (user_a_id = dup_id and user_b_id = friend_id)
       or (user_a_id = friend_id and user_b_id = dup_id)
    limit 1
    on conflict (user_a_id, user_b_id) do nothing;
  end loop;

  delete from public.friendships where user_a_id = dup_id or user_b_id = dup_id;

  -- 6. Update comments authored by the duplicate
  update public.comments set author_id = master_id where author_id = dup_id;

  -- 7. Delete the duplicate's public profile row
  delete from public.users where id = dup_id;

end;
$$;
