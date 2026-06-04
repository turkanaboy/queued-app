-- ============================================================
-- QUEUED — Migration 005: Platform awareness
-- ============================================================

-- User's streaming platforms (array of TMDB provider IDs)
alter table public.users
  add column if not exists platforms integer[] not null default '{}';

-- Streaming providers fetched from TMDB at send time
-- Stored as [{provider_id, provider_name, logo_path}]
alter table public.recommendations
  add column if not exists streaming_providers jsonb not null default '[]';
