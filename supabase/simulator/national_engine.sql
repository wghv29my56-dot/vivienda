-- Mirror of assets/simulator/national.js and national outcome feedback.
create or replace function simulator_private.calculate_alpha3(p_run_id uuid,p_turn integer)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.sim_runs; b public.sim_turns; p public.sim_turns; c public.sim_turns; d record; s record; k text; params jsonb;
 baseline jsonb; prev jsonb; e jsonb:='{"gdp":0,"migration":0,"rent_demand":0,"buy_demand":0,"tourists":0,"tourist_homes":0}'; n jsonb;
 force double precision; spend double precision:=0; opportunity double precision:=0; fiscal double precision;
 gdp double precision; population double precision; tourists double precision; tourist_homes double precision; rent_demand double precision; buy_demand double precision;
 growth double precision; pressure double precision; income double precision; rent_feedback double precision; sale_feedback double precision; burden double precision;
begin
 select * into r from public.sim_runs where id=p_run_id and user_id=auth.uid();
 if not found then raise exception 'Run not owned' using errcode='42501';end if;
 select assumptions->'national'->'baseline' into baseline from public.sim_scenarios where id=r.scenario_id;
 select * into b from public.sim_turns where run_id=r.id and turn_no=0;
 select * into p from public.sim_turns where run_id=r.id and turn_no=p_turn-1;
 select * into c from public.sim_turns where run_id=r.id and turn_no=p_turn;
 prev:=p.state->'national';
 if baseline is null or prev is null then raise exception 'Missing national baseline or previous state';end if;
 for d in select * from public.sim_decisions where run_id=r.id loop
  params:=d.measure_snapshot->'model_parameters';
  if p_turn>=d.turn_no then spend:=spend+case when p_turn>d.end_turn then d.post_quarterly_cost else d.quarterly_cost+case when p_turn=d.turn_no then d.initial_cost else 0 end end;end if;
  if p_turn<d.effect_start_turn or (p_turn>d.end_turn and not coalesce((params->>'permanent')::boolean,false)) then continue;end if;
  force:=(1-exp(-2*d.intensity::double precision))/(1-exp(-2::double precision))*greatest(0,least(1,(p_turn-d.effect_start_turn+1)::double precision/4));
  for k in select jsonb_object_keys(e) loop
   e:=jsonb_set(e,array[k],to_jsonb((e->>k)::double precision+coalesce((params->'national_effects'->>k)::double precision,0)*force));
  end loop;
 end loop;
 for s in select tb.committed,bs.reference_parameters from public.sim_turn_budgets tb join public.sim_budget_sources bs on bs.id=tb.source_id where tb.run_id=r.id and tb.turn_no=p_turn loop
  opportunity:=opportunity+s.committed*(s.reference_parameters->>'gdp_multiplier')::double precision;
 end loop;
 fiscal:=(spend*.8-opportunity)*4/(baseline->>'gdp')::double precision;
 gdp:=(baseline->>'gdp')::double precision*power(1.006::double precision,p_turn)*(1+greatest(-.3,least(.3,(e->>'gdp')::double precision+fiscal)));
 growth:=gdp/(prev->>'gdp')::double precision-1;
 pressure:=p.rent_m2/b.rent_m2-1;
 population:=(prev->>'population')::double precision*(1+greatest(-.006,least(.006,.0022+.08*(growth-.006)-.008*pressure+(e->>'migration')::double precision)));
 tourists:=(baseline->>'tourists')::double precision*power(1.005::double precision,p_turn)*(1+greatest(-.7,least(.5,(e->>'tourists')::double precision)));
 tourist_homes:=(baseline->>'tourist_homes')::double precision*power(1.004::double precision,p_turn)*(1+greatest(-.85,least(1,(e->>'tourist_homes')::double precision)));
 income:=(gdp/population)/((baseline->>'gdp')::double precision/(baseline->>'population')::double precision)-1;
 rent_demand:=(baseline->>'rent_demand')::double precision*(population/(baseline->>'population')::double precision)*(1+greatest(-.75,least(1,(e->>'rent_demand')::double precision+.25*(p.sale_m2/b.sale_m2-1)-.15*pressure+.1*income)));
 buy_demand:=(baseline->>'buy_demand')::double precision*(population/(baseline->>'population')::double precision)*(1+greatest(-.75,least(1,(e->>'buy_demand')::double precision-.3*(p.sale_m2/b.sale_m2-1)+.2*income)));
 rent_feedback:=greatest(-.15,least(.15,.1*ln(rent_demand/(baseline->>'rent_demand')::double precision)+.02*ln(tourist_homes/(baseline->>'tourist_homes')::double precision)));
 sale_feedback:=greatest(-.15,least(.15,.1*ln(buy_demand/(baseline->>'buy_demand')::double precision)+.04*ln(1+income)));
 n:=jsonb_build_object('gdp',gdp,'population',population,'rent_demand',rent_demand,'buy_demand',buy_demand,'tourists',tourists,'tourist_homes',tourist_homes);
 burden:=(c.rent_m2*(1+rent_feedback)/b.rent_m2-1)-income;
 update public.sim_turn_groups set unrest=round(greatest(0,least(100,unrest+case when group_id='tenants' then 10*tanh(burden) when group_id='domestic_buyers' then 8*tanh(sale_feedback) else 0 end))::numeric,2) where run_id=r.id and turn_no=p_turn;
 update public.sim_turns set rent_m2=round((rent_m2*(1+rent_feedback))::numeric,2),sale_m2=round((sale_m2*(1+sale_feedback))::numeric,2),
 collective_unrest=(select round(sum(unrest*weight_percent)/100,2) from public.sim_turn_groups where run_id=r.id and turn_no=p_turn),
 state=state||jsonb_build_object('model_version','alpha-3','national',n,'free_rent_m2',round(((state->>'free_rent_m2')::double precision*(1+rent_feedback))::numeric,2)),
 summary='España: variables nacionales dinámicas, demanda estimada y efectos hipotéticos; no una previsión.' where run_id=r.id and turn_no=p_turn;
end $$;
revoke all on function simulator_private.calculate_alpha3(uuid,integer) from public,anon,authenticated;
