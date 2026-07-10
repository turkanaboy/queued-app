begin;

select plan(10);

select ok(
  not has_function_privilege('anon', 'public.handle_new_user()', 'execute')
    and not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'handle_new_user is trigger-only'
);

select ok(
  not has_function_privilege('anon', 'public.handle_auth_user_deleted()', 'execute')
    and not has_function_privilege('authenticated', 'public.handle_auth_user_deleted()', 'execute'),
  'handle_auth_user_deleted is trigger-only'
);

select ok(
  not has_function_privilege('anon', 'public.handle_user_setup_bot_friendship()', 'execute')
    and not has_function_privilege('authenticated', 'public.handle_user_setup_bot_friendship()', 'execute'),
  'handle_user_setup_bot_friendship is trigger-only'
);

select ok(
  not has_function_privilege('anon', 'public.add_party_creator_as_member()', 'execute')
    and not has_function_privilege('authenticated', 'public.add_party_creator_as_member()', 'execute'),
  'add_party_creator_as_member is trigger-only'
);

select ok(
  case
    when to_regprocedure('public.rls_auto_enable()') is null then true
    else not has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')
      and not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute')
  end,
  'rls_auto_enable is unavailable through the Data API when present'
);

select ok(
  not has_function_privilege('anon', 'public.wipe_expired_trivia_questions()', 'execute')
    and not has_function_privilege('authenticated', 'public.wipe_expired_trivia_questions()', 'execute'),
  'trivia expiry housekeeping is unavailable to API users'
);

select ok(
  not has_function_privilege('anon', 'public.is_party_member(uuid)', 'execute'),
  'is_party_member is unavailable to anonymous callers'
);

select ok(
  has_function_privilege('authenticated', 'public.is_party_member(uuid)', 'execute'),
  'is_party_member remains available to authenticated RLS policies'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral unnest(p.proconfig) as setting
    where n.nspname = 'public'
      and p.proname = 'is_party_member'
      and split_part(setting, '=', 1) = 'search_path'
  ),
  'is_party_member has a fixed search_path'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.wipe_expired_trivia_questions()',
    'execute'
  ),
  'trivia expiry housekeeping remains available to service_role'
);

select * from finish();

rollback;
