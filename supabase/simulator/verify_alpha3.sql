begin;
create temporary table sim_a3_context(user_a uuid, user_b uuid, run_id uuid);
insert into sim_a3_context values(gen_random_uuid(),gen_random_uuid(),null);
insert into auth.users(id) select user_a from sim_a3_context union all select user_b from sim_a3_context;
grant select,update on sim_a3_context to authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',user_a,'role','authenticated')::text,true) from sim_a3_context;
set local role authenticated;
do $$
declare r uuid; s uuid; failed boolean; init jsonb; later jsonb;
begin
 if (select count(*) from public.sim_measures where version_id='alpha-3')<>50 then raise exception 'Catalogue incomplete';end if;
 select id into s from public.sim_scenarios where version_id='alpha-3' and country_code='ES' and city_id is null;
 if s is null then raise exception 'Missing national geography';end if;
 r:=public.sim_create_run(s,20,'Verificación nacional','Prueba');update sim_a3_context set run_id=r;
 select state->'national' into init from public.sim_turns where run_id=r and turn_no=0;
 if (init->>'population')::numeric<>49801559 or (init->>'gdp')::numeric<>1690012000000 then raise exception 'Wrong national initial data';end if;
 failed:=false;
 begin perform public.sim_advance_turn(r,0,'[{"measure_id":"a3_tourist_days","intensity":1,"funding":[]}]');exception when others then failed:=true;end;
 if not failed or (select current_turn from public.sim_runs where id=r)<>0 then raise exception 'Unfunded transaction accepted';end if;
 perform public.sim_advance_turn(r,0,'[{"measure_id":"a3_tourist_days","intensity":1,"funding":[{"source_id":"a3_tax_irpf","initial_amount":120000000,"quarterly_amount":60000000}]}]');
 for t in 1..7 loop perform public.sim_advance_turn(r,t,'[]');end loop;
 select state->'national' into later from public.sim_turns where run_id=r and turn_no=8;
 if (later->>'tourist_homes')::numeric>=(init->>'tourist_homes')::numeric or (later->>'population')::numeric=(init->>'population')::numeric then raise exception 'National transition not applied';end if;
 failed:=false;
 begin perform public.sim_advance_turn(r,7,'[]');exception when serialization_failure then failed:=true;end;
 if not failed then raise exception 'Stale turn accepted';end if;
 for t in 8..79 loop perform public.sim_advance_turn(r,t,'[]');end loop;
 if not exists(select 1 from public.sim_runs where id=r and status='completed') then raise exception 'Completion failed';end if;
 if exists(select 1 from public.sim_turns where run_id=r and ((state->'national'->>'population')::numeric<=0 or (state->'national'->>'gdp')::numeric<=0 or state->>'model_version'<>'alpha-3')) then raise exception 'Invalid national state';end if;
end $$;
select turn_no,rent_m2,sale_m2,state from public.sim_turns where run_id=(select run_id from sim_a3_context) and turn_no in(1,8,80) order by turn_no;
select set_config('request.jwt.claims',jsonb_build_object('sub',user_b,'role','authenticated')::text,true) from sim_a3_context;
do $$declare failed boolean:=false;begin
 if exists(select 1 from public.sim_runs where id=(select run_id from sim_a3_context)) then raise exception 'RLS exposed another game';end if;
 begin perform public.sim_advance_turn((select run_id from sim_a3_context),80,'[]');exception when insufficient_privilege then failed:=true;end;
 if not failed then raise exception 'Ownership check missing';end if;
end $$;
reset role;
rollback;
