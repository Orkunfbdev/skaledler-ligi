-- Local PostgreSQL test only. Every fixture and settlement is rolled back.
begin;

do $$
declare
  v_match uuid;
  v_user uuid := gen_random_uuid();
  v_bet uuid;
  v_balance numeric;
  v_status text;
begin
  select id into v_match from public.matches where matchday = 3 and not settled order by id limit 1;
  if v_match is null then raise exception 'No unprocessed week 3 match'; end if;
  insert into public.users (id, email, password_hash) values (v_user, 'idempotence@example.invalid', 'test-only');
  insert into public.profiles (id, username, balance) values (v_user, 'idempotence_test', 150);
  insert into public.bets (id, user_id, match_id, prediction, bet_amount, odds, status, bet_type)
  values (gen_random_uuid(), v_user, v_match, '1', 50, 2.00, 'pending', 'single') returning id into v_bet;

  if not app_private.settle_match(v_match, 1, 0) then raise exception 'First call should process'; end if;
  if app_private.settle_match(v_match, 1, 0) then raise exception 'Second call must skip'; end if;
  select balance into v_balance from public.profiles where id = v_user;
  select status into v_status from public.bets where id = v_bet;
  if v_balance <> 250 or v_status <> 'won' then raise exception 'Double payout or wrong bet status'; end if;
  raise notice 'Idempotence passed: one payout, second call skipped';
end $$;

rollback;

begin;

do $$
declare
  v_first uuid;
  v_second uuid;
  v_user uuid := gen_random_uuid();
  v_bet uuid;
  v_balance numeric;
  v_status text;
begin
  select id into v_first from public.matches where matchday = 3 and not settled order by id limit 1;
  select id into v_second from public.matches where matchday = 3 and not settled and id <> v_first order by id limit 1;
  if v_second is null then raise exception 'Need two unprocessed week 3 matches'; end if;
  insert into public.users (id, email, password_hash) values (v_user, 'combo@example.invalid', 'test-only');
  insert into public.profiles (id, username, balance) values (v_user, 'combo_test', 150);
  insert into public.bets (id, user_id, prediction, bet_amount, odds, status, bet_type, combo_details)
  values (gen_random_uuid(), v_user, 'KOMBO', 50, 4.00, 'pending', 'combo',
          jsonb_build_array(jsonb_build_object('match_id', v_first::text, 'prediction', '1'),
                            jsonb_build_object('match_id', v_second::text, 'prediction', '2')))
  returning id into v_bet;

  perform app_private.settle_match(v_first, 1, 0);
  select status into v_status from public.bets where id = v_bet;
  if v_status <> 'pending' then raise exception 'Combo settled before last leg'; end if;
  perform app_private.settle_match(v_second, 0, 1);
  select status into v_status from public.bets where id = v_bet;
  select balance into v_balance from public.profiles where id = v_user;
  if v_status <> 'won' or v_balance <> 350 then raise exception 'Combo payout failed'; end if;
  if app_private.settle_match(v_second, 0, 1) then raise exception 'Combo duplicate processing'; end if;
  raise notice 'Combo passed: waits for both legs and pays once';
end $$;

rollback;

begin;

create function public._test_reject_balance() returns trigger language plpgsql as $$
begin
  if new.id::text = current_setting('test.user_id', true) then
    raise exception 'forced payout failure';
  end if;
  return new;
end $$;
create trigger _test_reject_balance before update of balance on public.profiles
for each row execute function public._test_reject_balance();

do $$
declare
  v_match uuid;
  v_user uuid := gen_random_uuid();
  v_bet uuid;
  v_finished boolean;
  v_settled boolean;
  v_balance numeric;
  v_status text;
begin
  select id into v_match from public.matches where matchday = 3 and not settled order by id limit 1;
  if v_match is null then raise exception 'No unprocessed week 3 match'; end if;
  insert into public.users (id, email, password_hash) values (v_user, 'rollback@example.invalid', 'test-only');
  insert into public.profiles (id, username, balance) values (v_user, 'rollback_test', 150);
  insert into public.bets (id, user_id, match_id, prediction, bet_amount, odds, status, bet_type)
  values (gen_random_uuid(), v_user, v_match, '1', 50, 2.00, 'pending', 'single') returning id into v_bet;
  perform set_config('test.user_id', v_user::text, true);

  begin
    perform app_private.settle_match(v_match, 1, 0);
    raise exception 'Expected payout failure did not occur';
  exception when others then
    if sqlerrm <> 'forced payout failure' then raise; end if;
  end;

  select is_finished, settled into v_finished, v_settled from public.matches where id = v_match;
  select balance into v_balance from public.profiles where id = v_user;
  select status into v_status from public.bets where id = v_bet;
  if v_finished or v_settled or v_balance <> 150 or v_status <> 'pending' then
    raise exception 'Settlement was not rolled back';
  end if;
  raise notice 'Rollback passed: score, status and balance unchanged';
end $$;

rollback;
