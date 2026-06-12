-- ============================================================
-- QUEUED — Migration: create_party RPC
-- Bypasses direct INSERT + RLS by handling party creation
-- and creator membership atomically in security definer context.
-- ============================================================

create or replace function public.create_party(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_party_id uuid;
begin
  if p_name is null or trim(p_name) = '' then
    raise exception 'party name required';
  end if;

  insert into public.parties (name, creator_id)
  values (trim(p_name), auth.uid())
  returning id into v_party_id;

  -- Add creator as first member (trigger may also do this; ON CONFLICT makes it idempotent)
  insert into public.party_members (party_id, user_id)
  values (v_party_id, auth.uid())
  on conflict (party_id, user_id) do nothing;

  return v_party_id;
end;
$$;

revoke all on function public.create_party(text) from public, anon;
grant execute on function public.create_party(text) to authenticated;
