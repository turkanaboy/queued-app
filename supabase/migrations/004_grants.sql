-- ============================================================
-- QUEUED — Migration 004: Table grants
-- RLS alone isn't enough — the authenticated role needs explicit
-- table-level privileges too.
-- ============================================================

grant usage on schema public to anon, authenticated;

-- Allow users to insert their own row (needed for upsert on setup)
create policy if not exists "users: insert own"
  on public.users for insert
  to authenticated
  with check (id = auth.uid());

grant select on public.users to anon;
grant select, insert, update on public.users to authenticated;

grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, update, delete on public.recommendations to authenticated;
grant select, insert, update, delete on public.comments to authenticated;
