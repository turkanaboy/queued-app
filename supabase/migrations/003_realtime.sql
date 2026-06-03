-- ============================================================
-- QUEUED — Migration 003: Realtime
-- Enable Realtime on recommendations for the unread badge.
-- ============================================================

alter publication supabase_realtime add table public.recommendations;
