alter table public.parties
  add column if not exists mode text not null default 'curated'
  check (mode in ('curated', 'rotating_picker'));

create or replace function public.create_party(p_name text, p_mode text default 'curated')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_party_id uuid;
  v_mode text := coalesce(nullif(trim(p_mode), ''), 'curated');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'party name required';
  end if;

  if v_mode not in ('curated', 'rotating_picker') then
    raise exception 'invalid group mode';
  end if;

  insert into public.parties (name, creator_id, mode)
  values (trim(p_name), auth.uid(), v_mode)
  returning id into v_party_id;

  insert into public.party_members (party_id, user_id)
  values (v_party_id, auth.uid())
  on conflict (party_id, user_id) do nothing;

  return v_party_id;
end;
$$;

revoke all on function public.create_party(text, text) from public, anon;
grant execute on function public.create_party(text, text) to authenticated;
