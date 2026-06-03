-- ============================================================
-- QUEUED — Migration 001: Core Schema
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "citext";

-- ── Enums ────────────────────────────────────────────────────
create type friendship_status as enum ('pending', 'accepted');

create type media_type as enum ('movie', 'tv');
-- v2: add 'music', 'book'

create type recipient_status as enum (
  'not_yet_viewed',
  'queued',
  'in_progress',
  'finished',
  'skipped',
  'bailed'
);

-- ── Users ─────────────────────────────────────────────────────
-- Mirrors auth.users; populated via trigger on first sign-in.
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  username      citext unique,            -- null until onboarding complete
  display_name  text,
  created_at    timestamptz not null default now()
);

create index on public.users (username);

-- Auto-insert row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Friendships ───────────────────────────────────────────────
-- Symmetric: user_a_id < user_b_id enforced to prevent duplicate pairs.
create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  user_a_id     uuid not null references public.users(id) on delete cascade,
  user_b_id     uuid not null references public.users(id) on delete cascade,
  requester_id  uuid not null references public.users(id) on delete cascade,
  status        friendship_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint user_order check (user_a_id < user_b_id),
  constraint unique_pair unique (user_a_id, user_b_id)
);

create index on public.friendships (user_a_id, status);
create index on public.friendships (user_b_id, status);

-- ── Recommendations ───────────────────────────────────────────
create table public.recommendations (
  id                uuid primary key default gen_random_uuid(),
  sender_id         uuid not null references public.users(id) on delete cascade,
  recipient_id      uuid not null references public.users(id) on delete cascade,
  media_type        media_type not null,
  media_id          text not null,          -- TMDB ID
  media_title       text not null,
  media_poster_url  text,
  note              text check (char_length(note) <= 500),
  recipient_status  recipient_status not null default 'not_yet_viewed',
  rating            numeric(2,1) check (
                      rating is null or (
                        rating >= 0.5 and rating <= 5.0
                        and (rating * 2) = floor(rating * 2)  -- 0.5 increments only
                      )
                    ),
  deleted_at        timestamptz,            -- soft delete by sender
  created_at        timestamptz not null default now()
);

-- Prevent duplicate active recs (same sender→recipient→media)
create unique index unique_active_recommendation
  on public.recommendations (sender_id, recipient_id, media_id)
  where deleted_at is null;

create index on public.recommendations (recipient_id, recipient_status);
create index on public.recommendations (sender_id);

-- ── Comments ──────────────────────────────────────────────────
create table public.comments (
  id                  uuid primary key default gen_random_uuid(),
  recommendation_id   uuid not null references public.recommendations(id) on delete cascade,
  author_id           uuid not null references public.users(id) on delete cascade,
  body                text not null,
  created_at          timestamptz not null default now()
);

create index on public.comments (recommendation_id);
