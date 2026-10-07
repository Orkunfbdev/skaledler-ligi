-- Atomic, idempotent settlement for single and multi-match predictions.
create schema if not exists app_private;

create or replace function app_private.settle_match(
  p_match_id uuid, p_home_score integer, p_away_score integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_match public.matches%rowtype;
  v_bet public.bets%rowtype;
  v_leg jsonb;
  v_leg_match public.matches%rowtype;
  v_result text;
  v_all_won boolean;
  v_all_finished boolean;
begin
  if p_home_score < 0 or p_away_score < 0 or p_home_score is null or p_away_score is null then
    raise exception 'Invalid score';
  end if;

  -- ponytail: one transaction lock serializes the small private league's settlements.
  perform pg_catalog.pg_advisory_xact_lock(260029825);

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found: %', p_match_id; end if;
  if v_match.settled then return false; end if;

  v_result := case when p_home_score > p_away_score then '1'
                   when p_home_score = p_away_score then '0' else '2' end;
  update public.matches
  set home_score = p_home_score, away_score = p_away_score, is_finished = true
  where id = p_match_id;

  for v_bet in
    select * from public.bets
    where match_id = p_match_id and status = 'pending' and coalesce(bet_type, 'single') = 'single'
    for update
  loop
    if v_bet.prediction = v_result then
      update public.bets set status = 'won' where id = v_bet.id;
      update public.profiles
      set balance = balance + v_bet.bet_amount * v_bet.odds
      where id = v_bet.user_id;
      if not found then raise exception 'Profile missing for bet %', v_bet.id; end if;
    else
      update public.bets set status = 'lost' where id = v_bet.id;
    end if;
  end loop;

  for v_bet in
    select * from public.bets
    where bet_type = 'combo' and status = 'pending'
      and combo_details::jsonb @> jsonb_build_array(jsonb_build_object('match_id', p_match_id::text))
    for update
  loop
    if jsonb_typeof(v_bet.combo_details::jsonb) <> 'array'
       or jsonb_array_length(v_bet.combo_details::jsonb) < 2 then
      raise exception 'Invalid combo details for bet %', v_bet.id;
    end if;
    v_all_won := true;
    v_all_finished := true;
    for v_leg in select value from jsonb_array_elements(v_bet.combo_details::jsonb) loop
      select * into v_leg_match from public.matches
      where id::text = v_leg->>'match_id';
      if not found then raise exception 'Combo % references missing match', v_bet.id; end if;
      if not v_leg_match.is_finished then
        v_all_finished := false;
        exit;
      end if;
      if v_leg_match.home_score is null or v_leg_match.away_score is null then
        raise exception 'Finished combo match has no score';
      end if;
      if v_leg->>'prediction' <> (case
          when v_leg_match.home_score > v_leg_match.away_score then '1'
          when v_leg_match.home_score = v_leg_match.away_score then '0' else '2' end) then
        v_all_won := false;
      end if;
    end loop;
    if v_all_finished then
      if v_all_won then
        update public.bets set status = 'won' where id = v_bet.id;
        update public.profiles
        set balance = balance + v_bet.bet_amount * v_bet.odds
        where id = v_bet.user_id;
        if not found then raise exception 'Profile missing for combo %', v_bet.id; end if;
      else
        update public.bets set status = 'lost' where id = v_bet.id;
      end if;
    end if;
  end loop;

  update public.matches set settled = true where id = p_match_id;
  update public.league_settings
  set active_matchday = v_match.matchday + 1
  where id = 1 and active_matchday = v_match.matchday
    and not exists (
      select 1 from public.matches
      where matchday = v_match.matchday and not is_finished
    );
  return true;
end $$;
REVOKE ALL ON FUNCTION app_private.settle_match(uuid, integer, integer) FROM PUBLIC;
