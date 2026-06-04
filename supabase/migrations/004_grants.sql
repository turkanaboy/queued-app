-- ============================================================
-- QUEUED — Migration 004: Table grants + insert policy
-- ============================================================

grant usage on schema public to anon, authenticated;

create policy "users: insert own"
  on public.users for insert
  to authenticated
  with check (id = auth.uid());

grant select, insert, update on public.users to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, update, delete on public.recommendations to authenticated;
grant select, insert, update, delete on public.comments to authenticated;
