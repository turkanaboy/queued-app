-- ============================================================
-- QUEUED — Migration 008: Books and Albums media types
-- ============================================================

-- Extend enum (PostgreSQL 9.3+ supports IF NOT EXISTS)
alter type media_type add value if not exists 'book';
alter type media_type add value if not exists 'album';

-- Creator field: author for books, artist for albums (null for movie/tv)
alter table public.recommendations
  add column if not exists media_creator text;

alter table public.user_media_log
  add column if not exists media_creator text;
