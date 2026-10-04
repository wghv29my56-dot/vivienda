-- VIVIENDA SIMULATOR alpha: synthetic catalogue, private saves, transactional turns.
-- Applied remotely with Supabase MCP; migration filename is taken from server history.
create schema if not exists simulator_private;
revoke all on schema simulator_private from public, anon;
grant usage on schema simulator_private to authenticated;

create table public.sim_versions (
 id text primary key, name text not null, status text not null check(status in ('draft','published','retired')),
 is_synthetic boolean not null default true, methodology text not null, created_at timestamptz not null default now()
);
create table public.sim_cities (
 id text primary key, name text not null, territorial_scope text not null
);
create table public.sim_groups (
 id text primary key, name text not null, display_order smallint not null unique,
 is_primary boolean not null default true, definition text not null
);
create table public.sim_scenarios (
 id uuid primary key default gen_random_uuid(), version_id text not null references public.sim_versions(id),
 city_id text not null references public.sim_cities(id), code text not null, name text not null,
 baseline_date date not null, is_synthetic boolean not null default true,
 rent_m2 numeric(12,2) not null check(rent_m2>0), sale_m2 numeric(12,2) not null check(sale_m2>0),
 reference_area_m2 numeric(8,2) not null check(reference_area_m2>0), assumptions jsonb not null default '{}'::jsonb,
 unique(version_id,city_id,code), unique(id,version_id)
);
create index sim_scenarios_city_idx on public.sim_scenarios(city_id);
create table public.sim_scenario_groups (
 scenario_id uuid not null references public.sim_scenarios(id), group_id text not null references public.sim_groups(id),
 weight_percent numeric(6,3) not null check(weight_percent between 0 and 100),
 initial_unrest numeric(5,2) not null check(initial_unrest between 0 and 100), primary key(scenario_id,group_id)
);
create index sim_scenario_groups_group_idx on public.sim_scenario_groups(group_id);
create table public.sim_categories (id text primary key, name text not null, display_order smallint not null);
create table public.sim_measures (
 id text primary key, version_id text not null references public.sim_versions(id), category_id text not null references public.sim_categories(id),
 name text not null, description text not null, competencies text[] not null,
 initial_cost numeric(14,2) not null default 0 check(initial_cost>=0), quarterly_cost numeric(14,2) not null default 0 check(quarterly_cost>=0),
 duration_turns integer not null check(duration_turns between 1 and 80), delay_turns integer not null default 0 check(delay_turns>=0),
 max_intensity numeric(5,2) not null default 1 check(max_intensity>0), is_synthetic boolean not null default true,
 check(cardinality(competencies)>0 and competencies <@ array['national','regional','local','unverified']::text[])
);
create index sim_measures_version_idx on public.sim_measures(version_id);
create index sim_measures_category_idx on public.sim_measures(category_id);
create table public.sim_measure_effects (
 id uuid primary key default gen_random_uuid(), measure_id text not null references public.sim_measures(id),
 kind text not null check(kind in ('pro','con')), icon text not null, title text not null, description text not null,
 group_id text references public.sim_groups(id), display_order smallint not null,
 parameters jsonb not null default '{}'::jsonb, unique(measure_id,kind,display_order)
);
create index sim_measure_effects_group_idx on public.sim_measure_effects(group_id);
create table public.sim_budget_sources (
 id text primary key, name text not null, kind text not null check(kind in ('spending_cut','tax_increase')),
 consequences text not null, competencies text[] not null
);
create table public.sim_scenario_budgets (
 scenario_id uuid not null references public.sim_scenarios(id), source_id text not null references public.sim_budget_sources(id),
 quarterly_capacity numeric(14,2) not null check(quarterly_capacity>=0), primary key(scenario_id,source_id)
);
create index sim_scenario_budgets_source_idx on public.sim_scenario_budgets(source_id);
create table public.sim_runs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 scenario_id uuid not null, version_id text not null, name text not null check(char_length(name) between 1 and 60),
 years smallint not null check(years in (5,10,15,20)), max_turns integer generated always as (years*4) stored,
 current_turn integer not null default 0 check(current_turn>=0), objective text not null,
 status text not null default 'active' check(status in ('active','completed')),
 configuration jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(scenario_id,version_id) references public.sim_scenarios(id,version_id),
 check(current_turn<=years*4), check((status='completed')=(current_turn=years*4))
);
create index sim_runs_user_idx on public.sim_runs(user_id,updated_at desc);
create index sim_runs_scenario_version_idx on public.sim_runs(scenario_id,version_id);
create table public.sim_turns (
 run_id uuid not null references public.sim_runs(id) on delete cascade, turn_no integer not null check(turn_no between 0 and 80),
 simulated_date date not null, rent_m2 numeric(12,2) not null check(rent_m2>0), sale_m2 numeric(12,2) not null check(sale_m2>0),
 collective_unrest numeric(5,2) not null check(collective_unrest between 0 and 100),
 reference_area_m2 numeric(8,2) not null check(reference_area_m2>0),
 rent_home numeric(14,2) generated always as (rent_m2*reference_area_m2) stored,
 sale_home numeric(16,2) generated always as (sale_m2*reference_area_m2) stored,
 summary text not null, state jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), primary key(run_id,turn_no)
);
create table public.sim_turn_groups (
 run_id uuid not null, turn_no integer not null, group_id text not null references public.sim_groups(id),
 unrest numeric(5,2) not null check(unrest between 0 and 100), weight_percent numeric(6,3) not null check(weight_percent between 0 and 100),
 explanation text not null, primary key(run_id,turn_no,group_id),
 foreign key(run_id,turn_no) references public.sim_turns(run_id,turn_no) on delete cascade
);
create index sim_turn_groups_group_idx on public.sim_turn_groups(group_id);
create table public.sim_decisions (
 id uuid primary key default gen_random_uuid(), run_id uuid not null, turn_no integer not null,
 slot smallint not null check(slot between 1 and 5), measure_id text not null references public.sim_measures(id),
 intensity numeric(5,2) not null check(intensity>0), initial_cost numeric(14,2) not null check(initial_cost>=0),
 quarterly_cost numeric(14,2) not null check(quarterly_cost>=0), end_turn integer not null, effect_start_turn integer not null,
 measure_snapshot jsonb not null, unique(run_id,turn_no,slot), unique(run_id,turn_no,measure_id), unique(id,run_id),
 check(end_turn>=turn_no), check(effect_start_turn>=turn_no),
 foreign key(run_id,turn_no) references public.sim_turns(run_id,turn_no) on delete cascade
);
create index sim_decisions_measure_idx on public.sim_decisions(measure_id);
create table public.sim_funding (
 decision_id uuid not null, run_id uuid not null, source_id text not null references public.sim_budget_sources(id),
 initial_amount numeric(14,2) not null check(initial_amount>=0), quarterly_amount numeric(14,2) not null check(quarterly_amount>=0),
 primary key(decision_id,source_id), foreign key(decision_id,run_id) references public.sim_decisions(id,run_id) on delete cascade
);
create index sim_funding_run_idx on public.sim_funding(run_id);
create index sim_funding_source_idx on public.sim_funding(source_id);
create table public.sim_turn_budgets (
 run_id uuid not null, turn_no integer not null, source_id text not null references public.sim_budget_sources(id),
 capacity numeric(14,2) not null check(capacity>=0), committed numeric(14,2) not null check(committed>=0 and committed<=capacity),
 remaining numeric(14,2) generated always as (capacity-committed) stored,
 primary key(run_id,turn_no,source_id), foreign key(run_id,turn_no) references public.sim_turns(run_id,turn_no) on delete cascade
);
create index sim_turn_budgets_source_idx on public.sim_turn_budgets(source_id);

-- Catalogue is public read only. Saved games are readable only by their owner.
-- All writes to runs and descendants go through the private transactional functions.
do $$ declare t text; begin
 foreach t in array array['sim_versions','sim_cities','sim_groups','sim_scenarios','sim_scenario_groups','sim_categories','sim_measures','sim_measure_effects','sim_budget_sources','sim_scenario_budgets'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to anon, authenticated',t);
  execute format('create policy catalogue_read on public.%I for select to anon, authenticated using (true)',t);
 end loop;
 foreach t in array array['sim_runs','sim_turns','sim_turn_groups','sim_decisions','sim_funding','sim_turn_budgets'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  if t='sim_runs' then
   execute 'create policy owner_read on public.sim_runs for select to authenticated using (user_id=(select auth.uid()))';
  else
   execute format('create policy owner_read on public.%I for select to authenticated using (run_id in (select id from public.sim_runs where user_id=(select auth.uid())))',t);
  end if;
 end loop;
end $$;

create function simulator_private.create_run(p_scenario_id uuid,p_years integer,p_name text,p_objective text,p_configuration jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.sim_scenarios; r uuid; total numeric; n integer;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select x.* into s from public.sim_scenarios x join public.sim_versions v on v.id=x.version_id where x.id=p_scenario_id and v.status='published';
 if not found then raise exception 'Unknown or unpublished scenario'; end if;
 if p_years is null or p_years not in (5,10,15,20) then raise exception 'Invalid duration'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then raise exception 'Invalid name'; end if;
 if p_objective is null or char_length(p_objective)>200 then raise exception 'Invalid objective'; end if;
 if p_configuration is null or jsonb_typeof(p_configuration)<>'object' or octet_length(p_configuration::text)>8192 then raise exception 'Invalid configuration'; end if;
 select sum(weight_percent),count(*) into total,n from public.sim_scenario_groups where scenario_id=s.id;
 if total<>100 or total is null or n<>6 then raise exception 'Scenario needs six groups with weights totalling 100'; end if;
 insert into public.sim_runs(user_id,scenario_id,version_id,name,years,objective,configuration)
 values(u,s.id,s.version_id,btrim(p_name),p_years,p_objective,p_configuration) returning id into r;
 insert into public.sim_turns(run_id,turn_no,simulated_date,rent_m2,sale_m2,collective_unrest,reference_area_m2,summary,state)
 select r,0,s.baseline_date,s.rent_m2,s.sale_m2,round(sum(weight_percent*initial_unrest)/100,2),s.reference_area_m2,
 'Estado inicial ficticio. Modelo alfa sin calibrar.',jsonb_build_object('synthetic',s.is_synthetic,'model_version',s.version_id)
 from public.sim_scenario_groups where scenario_id=s.id;
 insert into public.sim_turn_groups select r,0,group_id,initial_unrest,weight_percent,'Valor inicial de prueba' from public.sim_scenario_groups where scenario_id=s.id;
 insert into public.sim_turn_budgets(run_id,turn_no,source_id,capacity,committed)
 select r,0,source_id,quarterly_capacity,0 from public.sim_scenario_budgets where scenario_id=s.id;
 return r;
end $$;

create function simulator_private.advance_turn(p_run_id uuid,p_expected_turn integer,p_decisions jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.sim_runs; s public.sim_scenarios; m public.sim_measures;
 next_t integer; j jsonb; f jsonb; slot integer:=0; did uuid; intensity numeric; si numeric; sq numeric; needed_i numeric; needed_q numeric;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into r from public.sim_runs where id=p_run_id and user_id=u for update;
 if not found then raise exception 'Run not found or not owned' using errcode='42501'; end if;
 if p_expected_turn is null or r.current_turn<>p_expected_turn then raise exception 'Stale turn: refresh saved game' using errcode='40001'; end if;
 if r.status<>'active' then raise exception 'Game already completed'; end if;
 if p_decisions is null or jsonb_typeof(p_decisions)<>'array' then raise exception 'Decisions must be an array'; end if;
 if jsonb_array_length(p_decisions)>5 or octet_length(p_decisions::text)>32768 then raise exception 'Maximum five decisions'; end if;
 select * into s from public.sim_scenarios where id=r.scenario_id;
 next_t:=r.current_turn+1;
 -- Deliberately illustrative trajectory. Policies are recorded and financed, but their economic effects are not calibrated.
 insert into public.sim_turns(run_id,turn_no,simulated_date,rent_m2,sale_m2,collective_unrest,reference_area_m2,summary,state)
 values(r.id,next_t,(s.baseline_date+make_interval(months=>next_t*3))::date,
 round(s.rent_m2*(1+next_t*0.001),2),round(s.sale_m2*(1+next_t*0.0015),2),0,s.reference_area_m2,
 'Trayectoria ficticia. Las medidas se registran y financian; sus efectos económicos aún no se calculan.',
 jsonb_build_object('synthetic',true,'model_version',r.version_id));
 insert into public.sim_turn_groups(run_id,turn_no,group_id,unrest,weight_percent,explanation)
 select r.id,next_t,group_id,greatest(0,least(100,initial_unrest+round(sin(next_t*0.6)*2))),weight_percent,'Oscilación ilustrativa; no es efecto de las medidas'
 from public.sim_scenario_groups where scenario_id=s.id;
 update public.sim_turns set collective_unrest=(select round(sum(unrest*weight_percent)/100,2) from public.sim_turn_groups where run_id=r.id and turn_no=next_t)
 where run_id=r.id and turn_no=next_t;
 for j in select value from jsonb_array_elements(p_decisions) loop
  slot:=slot+1;
  select * into m from public.sim_measures where id=j->>'measure_id' and version_id=r.version_id;
  if not found then raise exception 'Unknown measure for this model version'; end if;
  intensity:=coalesce((j->>'intensity')::numeric,1);
  if intensity<=0 or intensity>m.max_intensity then raise exception 'Invalid intensity'; end if;
  if exists(select 1 from public.sim_decisions where run_id=r.id and measure_id=m.id and end_turn>=next_t) then raise exception 'Measure already active'; end if;
  needed_i:=round(m.initial_cost*intensity,2);needed_q:=round(m.quarterly_cost*intensity,2);
  insert into public.sim_decisions(run_id,turn_no,slot,measure_id,intensity,initial_cost,quarterly_cost,end_turn,effect_start_turn,measure_snapshot)
  values(r.id,next_t,slot,m.id,intensity,needed_i,needed_q,next_t+m.duration_turns-1,next_t+m.delay_turns,to_jsonb(m)) returning id into did;
  if j->'funding' is not null and jsonb_typeof(j->'funding')<>'array' then raise exception 'Funding must be an array'; end if;
  for f in select value from jsonb_array_elements(coalesce(j->'funding','[]'::jsonb)) loop
   if not exists(select 1 from public.sim_scenario_budgets where scenario_id=s.id and source_id=f->>'source_id') then raise exception 'Funding source unavailable'; end if;
   insert into public.sim_funding(decision_id,run_id,source_id,initial_amount,quarterly_amount)
   values(did,r.id,f->>'source_id',coalesce((f->>'initial_amount')::numeric,0),coalesce((f->>'quarterly_amount')::numeric,0));
  end loop;
  select coalesce(sum(initial_amount),0),coalesce(sum(quarterly_amount),0) into si,sq from public.sim_funding where decision_id=did;
  if si<>needed_i or sq<>needed_q then raise exception 'Funding must exactly cover initial and quarterly costs'; end if;
 end loop;
 -- Reject duplicate use of funds now AND in future quarters. Prior recurring commitments remain reserved.
 if exists(
  select 1 from generate_series(next_t,r.max_turns) as quarters(t)
  cross join public.sim_scenario_budgets b
  where b.scenario_id=s.id and b.quarterly_capacity < (
   select coalesce(sum(f.quarterly_amount+case when d.turn_no=quarters.t then f.initial_amount else 0 end),0)
   from public.sim_funding f join public.sim_decisions d on d.id=f.decision_id
   where d.run_id=r.id and f.source_id=b.source_id and d.turn_no<=quarters.t and d.end_turn>=quarters.t)
 ) then raise exception 'Funding source capacity exceeded in this or a future quarter'; end if;
 insert into public.sim_turn_budgets(run_id,turn_no,source_id,capacity,committed)
 select r.id,next_t,b.source_id,b.quarterly_capacity,
 coalesce((select sum(f.quarterly_amount+case when d.turn_no=next_t then f.initial_amount else 0 end)
 from public.sim_funding f join public.sim_decisions d on d.id=f.decision_id where d.run_id=r.id and f.source_id=b.source_id and d.turn_no<=next_t and d.end_turn>=next_t),0)
 from public.sim_scenario_budgets b where b.scenario_id=s.id;
 update public.sim_runs set current_turn=next_t,status=case when next_t=max_turns then 'completed' else 'active' end,updated_at=now() where id=r.id;
 return next_t;
end $$;

revoke all on function simulator_private.create_run(uuid,integer,text,text,jsonb) from public,anon;
revoke all on function simulator_private.advance_turn(uuid,integer,jsonb) from public,anon;
grant execute on function simulator_private.create_run(uuid,integer,text,text,jsonb) to authenticated;
grant execute on function simulator_private.advance_turn(uuid,integer,jsonb) to authenticated;
create function public.sim_create_run(p_scenario_id uuid,p_years integer,p_name text,p_objective text,p_configuration jsonb default '{}'::jsonb)
returns uuid language sql security invoker set search_path='' as $$ select simulator_private.create_run(p_scenario_id,p_years,p_name,p_objective,p_configuration); $$;
create function public.sim_advance_turn(p_run_id uuid,p_expected_turn integer,p_decisions jsonb default '[]'::jsonb)
returns integer language sql security invoker set search_path='' as $$ select simulator_private.advance_turn(p_run_id,p_expected_turn,p_decisions); $$;
revoke all on function public.sim_create_run(uuid,integer,text,text,jsonb) from public,anon;
revoke all on function public.sim_advance_turn(uuid,integer,jsonb) from public,anon;
grant execute on function public.sim_create_run(uuid,integer,text,text,jsonb) to authenticated;
grant execute on function public.sim_advance_turn(uuid,integer,jsonb) to authenticated;
