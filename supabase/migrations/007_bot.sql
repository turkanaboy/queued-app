-- ============================================================
-- QUEUED — Migration 007: Bot user
-- The bot is a special user that doesn't need an auth.users row.
-- We drop the FK constraint so it can be inserted directly.
-- Real users are still created via the handle_new_user trigger.
-- ============================================================

-- Drop the auth.users FK (cascade delete is handled by the trigger instead)
alter table public.users drop constraint if exists users_id_fkey;

-- Recreate cascade delete via trigger so real users still auto-clean
create or replace function public.handle_auth_user_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.users where id = old.id;
  return old;
end;
$$;

create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute procedure public.handle_auth_user_deleted();

-- Insert the Queued bot user
insert into public.users (id, email, username, display_name, platforms)
values (
  '00000000-0000-0000-0000-000000000001',
  'bot@queued.app',
  'queued_bot',
  'Queued ✨',
  '{8,9,15,337,384,350,386,531}'
) on conflict (id) do nothing;
