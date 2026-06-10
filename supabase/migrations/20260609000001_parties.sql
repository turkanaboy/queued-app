-- ============================================================
-- QUEUED — Migration: Parties feature (schema)
-- ============================================================

-- ── Enum ──────────────────────────────────────────────────────
create type party_item_status as enum ('unwatched', 'watched');

-- ── Tables ────────────────────────────────────────────────────

create table public.parties (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  creator_id   uuid not null references public.users(id) on delete cascade,
  invite_token uuid not null unique default gen_random_uuid(),
  created_at   timestamptz not null default now()
);

create table public.party_members (
  id        uuid primary key default gen_random_uuid(),
  party_id  uuid not null references public.parties(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  constraint party_members_unique unique (party_id, user_id)
);

create table public.party_list_items (
  id               uuid primary key default gen_random_uuid(),
  party_id         uuid not null references public.parties(id) on delete cascade,
  media_type       text not null,
  media_id         text not null,
  media_title      text not null,
  media_creator    text,
  media_poster_url text,
  added_by         uuid not null references public.users(id) on delete cascade,
  status           party_item_status not null default 'unwatched',
  watched_at       timestamptz,
  picked_by        uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint party_list_items_unique unique (party_id, media_type, media_id)
);

create table public.party_votes (
  id             uuid primary key default gen_random_uuid(),
  party_item_id  uuid not null references public.party_list_items(id) on delete cascade,
  party_id       uuid not null references public.parties(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  vote           boolean not null,
  created_at     timestamptz not null default now(),
  constraint party_votes_unique unique (party_item_id, user_id)
);

-- ── Indexes ───────────────────────────────────────────────────
create index party_members_party_user_idx on public.party_members (party_id, user_id);
create index party_list_items_party_status_idx on public.party_list_items (party_id, status);
create index party_votes_item_idx on public.party_votes (party_item_id);

-- ── Helper function ───────────────────────────────────────────
create or replace function public.is_party_member(p_party_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.party_members
    where party_id = p_party_id
      and user_id = auth.uid()
  );
$$;

-- ── Trigger: auto-add creator as member ───────────────────────
create or replace function public.add_party_creator_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.party_members (party_id, user_id)
  values (new.id, new.creator_id);
  return new;
end;
$$;

create trigger on_party_created
  after insert on public.parties
  for each row execute function public.add_party_creator_as_member();

-- ── RLS ───────────────────────────────────────────────────────
alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.party_list_items enable row level security;
alter table public.party_votes enable row level security;

-- parties: members can read, authenticated users can create, creator can delete
create policy "parties: select as member"
  on public.parties for select to authenticated
  using (public.is_party_member(id));

create policy "parties: insert own"
  on public.parties for insert to authenticated
  with check (creator_id = auth.uid());

create policy "parties: delete as creator"
  on public.parties for delete to authenticated
  using (creator_id = auth.uid());

-- party_members: members can read; insert/delete only via RPCs (service_role or trigger)
create policy "party_members: select as member"
  on public.party_members for select to authenticated
  using (public.is_party_member(party_id));

-- party_list_items: members can read, insert, and update
create policy "party_list_items: select as member"
  on public.party_list_items for select to authenticated
  using (public.is_party_member(party_id));

create policy "party_list_items: insert as member"
  on public.party_list_items for insert to authenticated
  with check (
    public.is_party_member(party_id)
    and added_by = auth.uid()
  );

create policy "party_list_items: update as member"
  on public.party_list_items for update to authenticated
  using (public.is_party_member(party_id));

-- party_votes: members can read; own votes only for write
create policy "party_votes: select as member"
  on public.party_votes for select to authenticated
  using (public.is_party_member(party_id));

create policy "party_votes: insert own"
  on public.party_votes for insert to authenticated
  with check (
    public.is_party_member(party_id)
    and user_id = auth.uid()
  );

create policy "party_votes: update own"
  on public.party_votes for update to authenticated
  using (user_id = auth.uid());

create policy "party_votes: delete own"
  on public.party_votes for delete to authenticated
  using (user_id = auth.uid());

-- ── Grants ────────────────────────────────────────────────────
grant select, insert, delete on public.parties to authenticated;
grant select on public.party_members to authenticated;
grant select, insert, update, delete on public.party_list_items to authenticated;
grant select, insert, update, delete on public.party_votes to authenticated;
