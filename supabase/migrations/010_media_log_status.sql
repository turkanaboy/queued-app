-- ============================================================
-- QUEUED - Migration 010: Personal queue status
-- ============================================================

alter table public.user_media_log
  add column if not exists status recipient_status not null default 'queued';

update public.user_media_log
set status = case
  when rating is not null then 'finished'::recipient_status
  else 'queued'::recipient_status
end
where status is null or status = 'not_yet_viewed';

create index if not exists user_media_log_user_status_idx
  on public.user_media_log (user_id, status, created_at desc);
