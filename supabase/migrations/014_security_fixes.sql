-- ============================================================
-- QUEUED — Migration 014: Security hardening (Supabase advisor)
-- ============================================================

-- ── 1. Fix are_friends ────────────────────────────────────────
-- Change from SECURITY DEFINER to SECURITY INVOKER: this function only reads
-- public.friendships, which authenticated callers can already access via their
-- own RLS policy ("friendships: read own"). INVOKER is safer and still works
-- correctly when called from RLS policies or the views below.
-- Add explicit search_path to prevent search_path injection.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
security invoker
stable
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and user_a_id = least(a, b)
      and user_b_id = greatest(a, b)
  );
$$;

-- ── 2. Revoke anon EXECUTE from trigger-only functions ────────
-- These functions are only meant to be called by triggers (after insert/delete
-- on auth.users) or by the handle_user_setup_bot_friendship trigger. They must
-- not be callable by unauthenticated or authenticated users via the REST API.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.handle_auth_user_deleted() from anon, authenticated;
revoke execute on function public.handle_user_setup_bot_friendship() from anon, authenticated;

-- ── 3. Views — intentional SECURITY DEFINER design ───────────
-- friend_media_log and friend_recommendation_activity are effectively
-- SECURITY DEFINER views (they run with the owner's privileges to bypass the
-- "read own only" RLS on the base tables). This is the intended design:
--
--   • security_barrier = true  prevents malicious WHERE-clause pushdown attacks
--   • auth.uid() in the WHERE clause correctly reads the JWT session variable
--   • Column restriction in the SELECT list hides private fields (review, note)
--
-- Converting to SECURITY INVOKER would require re-adding broad friend-read RLS
-- policies on the base tables, which would re-expose private columns (review,
-- streaming_providers) to direct table queries. The current approach is safe.
-- No SQL changes needed here; this comment documents the deliberate choice.

-- ── 4. rls_auto_enable ────────────────────────────────────────
-- This function is a Supabase-internal utility created via the dashboard.
-- Revoke public execute access to prevent it being called via REST API.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from anon, authenticated;
  end if;
end;
$$;
