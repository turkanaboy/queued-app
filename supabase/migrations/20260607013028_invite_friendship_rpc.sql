-- ============================================================
-- QUEUED - Invite links
-- ============================================================

create table if not exists public.invite_links (
  token      uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint invite_links_unique_inviter unique (inviter_id)
);

alter table public.invite_links enable row level security;

create policy "invite_links: read own"
  on public.invite_links for select
  to authenticated
  using (inviter_id = auth.uid());

create policy "invite_links: insert own"
  on public.invite_links for insert
  to authenticated
  with check (inviter_id = auth.uid());

grant select, insert on public.invite_links to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.accept_friend_invite(invite_token uuid, invitee uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  inviter uuid;
  user_a uuid;
  user_b uuid;
begin
  if invitee is null or invite_token is null then
    return false;
  end if;

  select inviter_id into inviter
  from public.invite_links
  where token = invite_token;

  if inviter is null or invitee = inviter then
    return false;
  end if;

  user_a := least(invitee, inviter);
  user_b := greatest(invitee, inviter);

  insert into public.friendships (user_a_id, user_b_id, requester_id, status, updated_at)
  values (user_a, user_b, inviter, 'accepted', now())
  on conflict (user_a_id, user_b_id) do update
    set status = 'accepted',
        updated_at = now();

  return true;
exception
  when foreign_key_violation then
    return false;
end;
$$;

revoke all on function private.accept_friend_invite(uuid, uuid) from public, anon;
grant execute on function private.accept_friend_invite(uuid, uuid) to authenticated;

create or replace function public.accept_friend_invite(invite_token uuid)
returns boolean
language sql
set search_path = public, private
as $$
  select private.accept_friend_invite(invite_token, auth.uid());
$$;

revoke all on function public.accept_friend_invite(uuid) from public, anon;
grant execute on function public.accept_friend_invite(uuid) to authenticated;
