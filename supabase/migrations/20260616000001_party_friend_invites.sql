-- ============================================================
-- QUEUED - Migration: Party friend invites
-- ============================================================

create or replace function public.invite_friend_to_party(
  p_party_id uuid,
  p_friend_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authenticated user required';
  end if;

  if p_party_id is null or p_friend_id is null then
    raise exception 'party and friend are required';
  end if;

  if p_friend_id = auth.uid() then
    raise exception 'cannot invite yourself';
  end if;

  if not exists (
    select 1
    from public.party_members
    where party_id = p_party_id
      and user_id = auth.uid()
  ) then
    raise exception 'not a party member';
  end if;

  if not exists (
    select 1
    from public.friendships
    where status = 'accepted'
      and user_a_id = least(auth.uid(), p_friend_id)
      and user_b_id = greatest(auth.uid(), p_friend_id)
  ) then
    raise exception 'friendship required';
  end if;

  insert into public.party_members (party_id, user_id)
  values (p_party_id, p_friend_id)
  on conflict (party_id, user_id) do nothing;
end;
$$;

revoke all on function public.invite_friend_to_party(uuid, uuid) from public, anon;
grant execute on function public.invite_friend_to_party(uuid, uuid) to authenticated;
