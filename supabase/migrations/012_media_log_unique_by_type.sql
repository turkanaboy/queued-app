-- Media IDs are source-local, so the same ID can exist across movies, TV,
-- books, and albums. Keep one log row per user per medium-specific title.
drop index if exists unique_user_media_log;

create unique index unique_user_media_log
  on public.user_media_log (user_id, media_type, media_id);
