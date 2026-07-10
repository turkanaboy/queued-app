begin;

insert into public.users (id, email, username) values
  ('10000000-0000-4000-8000-000000000001', 'one@example.test', 'review_one'),
  ('10000000-0000-4000-8000-000000000002', 'two@example.test', 'review_two'),
  ('10000000-0000-4000-8000-000000000003', 'three@example.test', 'review_three');

insert into public.parties (id, name, creator_id, mode) values
  ('20000000-0000-4000-8000-000000000001', 'Rotating', '10000000-0000-4000-8000-000000000001', 'rotating_picker'),
  ('20000000-0000-4000-8000-000000000002', 'Curated', '10000000-0000-4000-8000-000000000001', 'curated');

insert into public.party_members (party_id, user_id) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002');

insert into public.party_list_items (id, party_id, media_type, media_id, media_title, added_by) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'movie', '1', 'One', '10000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'movie', '2', 'Two', '10000000-0000-4000-8000-000000000002');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

do $$
begin
  begin
    update public.party_list_items set status = 'picked' where id = '30000000-0000-4000-8000-000000000001';
    raise exception 'direct party item update unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.party_votes (party_item_id, party_id, user_id, vote)
    values (
      '30000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000002',
      true
    );
    raise exception 'cross-party vote unexpectedly succeeded';
  exception when foreign_key_violation then
    null;
  end;

  begin
    perform public.pick_party_item('30000000-0000-4000-8000-000000000002');
    raise exception 'curated group pick unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'rotating group item not found' then raise; end if;
  end;
end;
$$;

reset role;

update public.party_list_items
set status = 'picked', picked_by = '10000000-0000-4000-8000-000000000002'
where id = '30000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
do $$
begin
  begin
    perform public.leave_party('20000000-0000-4000-8000-000000000001');
    raise exception 'active picker unexpectedly left the group';
  exception when others then
    if sqlerrm <> 'finish the current pick before leaving the group' then raise; end if;
  end;
end;
$$;

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
do $$
begin
  begin
    perform public.remove_party_member(
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002'
    );
    raise exception 'active picker was unexpectedly removed';
  exception when others then
    if sqlerrm <> 'finish the member''s current pick before removing them' then raise; end if;
  end;
end;
$$;

reset role;
update public.party_list_items
set status = 'unwatched', picked_by = null
where id = '30000000-0000-4000-8000-000000000001';

insert into public.friendships (user_a_id, user_b_id, requester_id, status)
values (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'accepted'
);

insert into public.recommendations (id, sender_id, recipient_id, media_type, media_id, media_title)
values (
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'movie',
  '42',
  'Atomic Recommendation'
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
select public.set_recommendation_state(
  '40000000-0000-4000-8000-000000000001',
  'finished',
  4.5,
  'Saved together',
  '[]'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.recommendations
    where id = '40000000-0000-4000-8000-000000000001'
      and recipient_status = 'finished'
      and rating = 4.5
  ) then raise exception 'recommendation state was not updated'; end if;

  if not exists (
    select 1 from public.user_media_log
    where user_id = '10000000-0000-4000-8000-000000000002'
      and media_type = 'movie'
      and media_id = '42'
      and status = 'finished'
      and rating = 4.5
      and review = 'Saved together'
  ) then raise exception 'recommendation log was not synchronized'; end if;
end;
$$;

reset role;
set local role service_role;

do $$
begin
  if not public.consume_edge_rate_limit('10000000-0000-4000-8000-000000000001', 'test', 2, 60) then raise exception 'first quota use rejected'; end if;
  if not public.consume_edge_rate_limit('10000000-0000-4000-8000-000000000001', 'test', 2, 60) then raise exception 'second quota use rejected'; end if;
  if public.consume_edge_rate_limit('10000000-0000-4000-8000-000000000001', 'test', 2, 60) then raise exception 'quota overflow accepted'; end if;
end;
$$;

do $$
declare
  v_challenge_id uuid;
begin
  v_challenge_id := public.create_trivia_challenge(
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    'random',
    array['movie'],
    '[{"type":"multiple_choice","question":"Public"}]'::jsonb,
    '[{"type":"multiple_choice","question":"Private","correct_index":0}]'::jsonb
  );
  if not exists (select 1 from public.trivia_challenges where id = v_challenge_id)
     or public.get_trivia_answer_key(v_challenge_id) is null then
    raise exception 'atomic trivia creation did not store both records';
  end if;
end;
$$;

insert into public.trivia_challenges (id, initiator_id, challenger_id, mode, media_types, status, questions)
values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'random', '{}', 'pending_initiator', '[]'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'random', '{}', 'pending_initiator', '[]');

update public.trivia_challenges
set expires_at = now() - interval '1 minute'
where id = '50000000-0000-4000-8000-000000000002';

select public.commit_trivia_score('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 8);

do $$
declare
  expired public.trivia_challenges%rowtype;
begin
  begin
    perform public.commit_trivia_score('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 9);
    raise exception 'duplicate trivia turn unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'not your turn' then raise; end if;
  end;

  select * into expired from public.commit_trivia_score(
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    1
  );
  if expired.status <> 'expired' then raise exception 'expired challenge advanced'; end if;
end;
$$;

select public.commit_trivia_score('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 7);

do $$
begin
  if not exists (
    select 1 from public.trivia_challenges
    where id = '50000000-0000-4000-8000-000000000001'
      and status = 'completed'
      and initiator_score = 8
      and challenger_score = 7
  ) then raise exception 'trivia score commit failed'; end if;
end;
$$;

reset role;
rollback;
