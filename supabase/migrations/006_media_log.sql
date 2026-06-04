-- ============================================================
-- QUEUED — Migration 006: Personal media log (Letterboxd-style)
-- ============================================================

create table public.user_media_log (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  media_type          media_type not null,
  media_id            text not null,
  media_title         text not null,
  media_poster_url    text,
  rating              numeric(2,1) check (
                        rating is null or (
                          rating >= 0.5 and rating <= 5.0
                          and (rating * 2) = floor(rating * 2)
                        )
                      ),
  review              text check (char_length(review) <= 1000),
  streaming_providers jsonb not null default '[]',
  created_at          timestamptz not null default now()
);

-- One log entry per user per media item
create unique index unique_user_media_log
  on public.user_media_log (user_id, media_id);

create index on public.user_media_log (user_id, created_at desc);

alter table public.user_media_log enable row level security;

create policy "media_log: read own"
  on public.user_media_log for select to authenticated
  using (user_id = auth.uid());

create policy "media_log: read as friend"
  on public.user_media_log for select to authenticated
  using (public.are_friends(auth.uid(), user_id));

create policy "media_log: insert own"
  on public.user_media_log for insert to authenticated
  with check (user_id = auth.uid());

create policy "media_log: update own"
  on public.user_media_log for update to authenticated
  using (user_id = auth.uid());

create policy "media_log: delete own"
  on public.user_media_log for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.user_media_log to authenticated;
