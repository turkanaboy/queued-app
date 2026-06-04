-- ============================================================
-- QUEUED — Migration 009: Taste fields, source tracking, bot auto-friendship
-- ============================================================

-- Taste fields for richer onboarding
alter table public.users
  add column if not exists favorite_genres text[] not null default '{}',
  add column if not exists watching_style  text;

-- Source tracking on personal media log
alter table public.user_media_log
  add column if not exists source_type    text not null default 'self',
  add column if not exists source_user_id uuid references public.users(id) on delete set null;

-- Auto-create bot friendship when a user completes setup (username first assigned via SetupPage upsert)
create or replace function public.handle_user_setup_bot_friendship()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.username is null
     and new.username is not null
     and new.id != '00000000-0000-0000-0000-000000000001'
  then
    insert into public.friendships (user_a_id, user_b_id, requester_id, status)
    values (
      '00000000-0000-0000-0000-000000000001',
      new.id,
      '00000000-0000-0000-0000-000000000001',
      'accepted'
    ) on conflict (user_a_id, user_b_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_user_setup_completed on public.users;
create trigger on_user_setup_completed
  after update on public.users
  for each row execute procedure public.handle_user_setup_bot_friendship();
