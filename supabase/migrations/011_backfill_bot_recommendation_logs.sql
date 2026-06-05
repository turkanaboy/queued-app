-- ============================================================
-- QUEUED - Migration 011: Backfill bot recommendations into media log
-- ============================================================

insert into public.user_media_log (
  user_id,
  media_type,
  media_id,
  media_title,
  media_creator,
  media_poster_url,
  status,
  source_type,
  source_user_id,
  streaming_providers,
  created_at
)
select
  r.recipient_id,
  r.media_type,
  r.media_id,
  r.media_title,
  r.media_creator,
  r.media_poster_url,
  r.recipient_status,
  'recommendation',
  r.sender_id,
  coalesce(r.streaming_providers, '[]'::jsonb),
  r.created_at
from public.recommendations r
where r.sender_id = '00000000-0000-0000-0000-000000000001'
  and r.deleted_at is null
on conflict (user_id, media_id) do update
set
  source_type = excluded.source_type,
  source_user_id = excluded.source_user_id,
  status = excluded.status,
  media_title = excluded.media_title,
  media_creator = excluded.media_creator,
  media_poster_url = excluded.media_poster_url;
