-- ============================================================
-- QUEUED — Migration 002: Row Level Security
-- ============================================================

alter table public.users enable row level security;
alter table public.friendships enable row level security;
alter table public.recommendations enable row level security;
alter table public.comments enable row level security;

-- ── Helper: check accepted friendship between two users ───────
create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (user_a_id = least(a, b) and user_b_id = greatest(a, b))
      )
  );
$$;

-- ── Users ─────────────────────────────────────────────────────
-- Anyone authenticated can read public profile fields.
create policy "users: read any"
  on public.users for select
  to authenticated
  using (true);

-- Users can only update their own row.
create policy "users: update own"
  on public.users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── Friendships ───────────────────────────────────────────────
-- Each user sees only friendships they are a party to.
create policy "friendships: read own"
  on public.friendships for select
  to authenticated
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

-- Either user can insert (send a request).
create policy "friendships: insert"
  on public.friendships for insert
  to authenticated
  with check (
    requester_id = auth.uid()
    and (user_a_id = auth.uid() or user_b_id = auth.uid())
  );

-- Either party can update (accept/decline).
create policy "friendships: update"
  on public.friendships for update
  to authenticated
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

-- Either party can delete (unfriend).
create policy "friendships: delete"
  on public.friendships for delete
  to authenticated
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

-- ── Recommendations ───────────────────────────────────────────
-- Sender and recipient can always read their own recs (active only for recipient).
create policy "recommendations: read as sender"
  on public.recommendations for select
  to authenticated
  using (sender_id = auth.uid());

create policy "recommendations: read as recipient"
  on public.recommendations for select
  to authenticated
  using (recipient_id = auth.uid() and deleted_at is null);

-- Friends can read finished recs for the profile activity feed
-- (title + rating only — the app layer should select specific columns).
create policy "recommendations: read finished as friend"
  on public.recommendations for select
  to authenticated
  using (
    recipient_status = 'finished'
    and deleted_at is null
    and (
      public.are_friends(auth.uid(), sender_id)
      or public.are_friends(auth.uid(), recipient_id)
    )
  );

-- Only the sender can insert.
create policy "recommendations: insert"
  on public.recommendations for insert
  to authenticated
  with check (sender_id = auth.uid());

-- Sender can soft-delete (set deleted_at); recipient can update recipient_status and rating.
create policy "recommendations: update as sender"
  on public.recommendations for update
  to authenticated
  using (sender_id = auth.uid());

create policy "recommendations: update as recipient"
  on public.recommendations for update
  to authenticated
  using (recipient_id = auth.uid() and deleted_at is null);

-- ── Comments ──────────────────────────────────────────────────
-- Sender and recipient of the parent recommendation can read comments.
create policy "comments: read"
  on public.comments for select
  to authenticated
  using (
    exists (
      select 1 from public.recommendations r
      where r.id = recommendation_id
        and (r.sender_id = auth.uid() or r.recipient_id = auth.uid())
    )
  );

-- Sender and recipient of the parent recommendation can insert comments.
create policy "comments: insert"
  on public.comments for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.recommendations r
      where r.id = recommendation_id
        and (r.sender_id = auth.uid() or r.recipient_id = auth.uid())
        and r.deleted_at is null
    )
  );

-- Only the comment author can delete their own comment.
create policy "comments: delete own"
  on public.comments for delete
  to authenticated
  using (author_id = auth.uid());
