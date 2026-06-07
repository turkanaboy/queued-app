-- Queued Bot runs inside an Edge Function using the service role key after
-- verifying the caller's JWT. The role bypasses RLS, but it still needs table
-- privileges to read context and save the generated recommendation/log row.
grant usage on schema public to service_role;

grant select, insert, update, delete on public.users to service_role;
grant select, insert, update, delete on public.friendships to service_role;
grant select, insert, update, delete on public.recommendations to service_role;
grant select, insert, update, delete on public.user_media_log to service_role;
