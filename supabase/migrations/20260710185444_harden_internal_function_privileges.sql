-- Remove PostgreSQL's inherited PUBLIC execute grant from trigger-only and
-- service-only SECURITY DEFINER functions exposed through the public schema.
revoke all on function public.handle_new_user()
  from public, anon, authenticated;
revoke all on function public.handle_auth_user_deleted()
  from public, anon, authenticated;
revoke all on function public.handle_user_setup_bot_friendship()
  from public, anon, authenticated;
revoke all on function public.add_party_creator_as_member()
  from public, anon, authenticated;

revoke all on function public.wipe_expired_trivia_questions()
  from public, anon, authenticated;
grant execute on function public.wipe_expired_trivia_questions()
  to service_role;

-- This dashboard-created helper is not present in every environment.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

-- RLS policies need this helper as authenticated users, but anonymous callers
-- do not. Its body already schema-qualifies every referenced object.
alter function public.is_party_member(uuid) set search_path = '';
revoke all on function public.is_party_member(uuid)
  from public, anon, authenticated;
grant execute on function public.is_party_member(uuid)
  to authenticated;
