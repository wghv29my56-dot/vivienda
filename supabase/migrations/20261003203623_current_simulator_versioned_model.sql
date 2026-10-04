-- Current simulator contract: immutable JSONB versions, analytical views, public active model.
-- Historical sim_* tables remain intact. The JavaScript engine is authoritative.
create function simulator_private.model_errors(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare m jsonb:=p->'model'; k text; item jsonb; measure jsonb; effect jsonb; id text;
 errors jsonb:='[]'; collections text[]:=array['groups','variables','measures','categories','competencies','funding_sources','sources','territories'];
begin
 if p->>'format' is distinct from 'vivienda-simulator-model' or p->>'schema_version' is distinct from '1'
 or jsonb_typeof(m) is distinct from 'object' then return '[{"path":"$","message":"Unsupported model contract"}]'::jsonb; end if;
 if nullif(p#>>'{metadata,id}','') is null or nullif(p#>>'{metadata,version}','') is null then errors:=errors||jsonb_build_array(jsonb_build_object('path','metadata','message','ID and version required')); end if;
 if coalesce(p->'comments','[]')<>'[]'::jsonb then errors:=errors||jsonb_build_array(jsonb_build_object('path','comments','message','Private review comments must not be published')); end if;
 foreach k in array collections loop
  if jsonb_typeof(m->k) is distinct from 'array' then return jsonb_build_array(jsonb_build_object('path',k,'message','Array required')); end if;
  if jsonb_array_length(m->k)>1000 then errors:=errors||jsonb_build_array(jsonb_build_object('path',k,'message','Maximum 1000 elements')); end if;
  if exists(select 1 from jsonb_array_elements(m->k) x where jsonb_typeof(x)<>'object' or coalesce(x->>'id','')!~'^[a-zA-Z][a-zA-Z0-9_-]{0,79}$')
  or (select count(*) from jsonb_array_elements(m->k))<>(select count(distinct x->>'id') from jsonb_array_elements(m->k) x)
  then errors:=errors||jsonb_build_array(jsonb_build_object('path',k,'message','Invalid or duplicate IDs')); end if;
  for item in select value from jsonb_array_elements(m->k) loop
   if k<>'sources' and nullif(item->>'name','') is null then errors:=errors||jsonb_build_array(jsonb_build_object('path',k,'message','Name required')); end if;
   if item ? 'sources' and (jsonb_typeof(item->'sources')<>'array' or exists(select 1 from jsonb_array_elements_text(item->'sources') r where not exists(select 1 from jsonb_array_elements(m->'sources') s where s->>'id'=r))) then errors:=errors||jsonb_build_array(jsonb_build_object('path',k,'message','Broken source reference')); end if;
  end loop;
 end loop;
 if abs((select coalesce(sum((x->>'weight')::numeric),0) from jsonb_array_elements(m->'groups') x)-100)>0.000001 then errors:=errors||'[{"path":"groups","message":"Happiness weights must sum to 100"}]'::jsonb; end if;
 for item in select value from jsonb_array_elements(m->'groups') loop
  if jsonb_typeof(item->'initial')<>'number' or (item->>'initial')::numeric not between 0 and 100 or (item->>'weight')::numeric not between 0 and 100 or (item->>'min')::numeric<0 or (item->>'max')::numeric>100 or (item->>'initial')::numeric not between (item->>'min')::numeric and (item->>'max')::numeric then errors:=errors||jsonb_build_array(jsonb_build_object('path','groups.'||(item->>'id'),'message','Invalid happiness range')); end if;
 end loop;
 for item in select value from jsonb_array_elements(m->'variables') loop
  if jsonb_typeof(item->'initial') is distinct from 'number' or (item->>'initial')::numeric<0 or nullif(item->>'unit','') is null then errors:=errors||jsonb_build_array(jsonb_build_object('path','variables.'||(item->>'id'),'message','Initial value and unit required')); end if;
 end loop;
 foreach k in array array['population_share','household_share'] loop
  if jsonb_array_length(m->'territories')=0 or abs((select coalesce(sum((x->>k)::numeric),0) from jsonb_array_elements(m->'territories') x)-100)>0.000001 or exists(select 1 from jsonb_array_elements(m->'territories') x where (x->>k)::numeric not between 0 and 100) then errors:=errors||jsonb_build_array(jsonb_build_object('path','territories.'||k,'message','Territorial shares must sum to 100')); end if;
 end loop;
 for item in select value from jsonb_array_elements(m->'sources') loop
  if coalesce(item->>'url','')!~'^https?://' or nullif(item->>'title','') is null then errors:=errors||jsonb_build_array(jsonb_build_object('path','sources.'||(item->>'id'),'message','Source title and URL required')); end if;
 end loop;
 for item in select value from jsonb_array_elements(m->'funding_sources') loop
  if (item->>'annual_reference')::numeric<=0 or item->>'kind' not in ('tax_increase','spending_cut') or (item->>'response')::numeric not between 0.001 and 1 then errors:=errors||jsonb_build_array(jsonb_build_object('path','funding_sources.'||(item->>'id'),'message','Invalid fiscal reference')); end if;
  if item ? 'fiscal_control' and ((item#>>'{fiscal_control,min}')::numeric<0 or (item#>>'{fiscal_control,base}')::numeric not between (item#>>'{fiscal_control,min}')::numeric and (item#>>'{fiscal_control,max}')::numeric or (item#>>'{fiscal_control,step}')::numeric<=0) then errors:=errors||jsonb_build_array(jsonb_build_object('path','funding_sources.'||(item->>'id'),'message','Invalid fiscal levels')); end if;
  if exists(select 1 from jsonb_object_keys(item->'group_effects') g where not exists(select 1 from jsonb_array_elements(m->'groups') x where x->>'id'=g)) then errors:=errors||'[{"path":"funding_sources","message":"Broken happiness reference"}]'::jsonb; end if;
 end loop;
 for measure in select value from jsonb_array_elements(m->'measures') loop
  id:=measure->>'id';
  if not exists(select 1 from jsonb_array_elements(m->'categories') x where x->>'id'=measure->>'category') then errors:=errors||jsonb_build_array(jsonb_build_object('path','measures.'||id,'message','Unknown category')); end if;
  if nullif(measure->>'mechanism','') is null or jsonb_typeof(measure->'enabled') is distinct from 'boolean'
  or (measure->>'initial_cost')::numeric<0 or (measure->>'quarterly_cost')::numeric<0
  or (measure->>'intensity_min')::numeric<0 or (measure->>'intensity_max')::numeric>1
  or (measure->>'intensity_min')::numeric>=(measure->>'intensity_max')::numeric
  or (measure->>'intensity_step')::numeric<=0
  or (measure->>'duration_turns')::numeric<1 or (measure->>'delay_turns')::numeric<0
  then errors:=errors||jsonb_build_array(jsonb_build_object('path','measures.'||id,'message','Invalid cost, intensity or duration')); end if;
  foreach k in array array['pros','cons','competencies','dependencies','allowed_funding_sources','effects'] loop
   if jsonb_typeof(measure->k) is distinct from 'array' then errors:=errors||jsonb_build_array(jsonb_build_object('path','measures.'||id||'.'||k,'message','Array required')); end if;
  end loop;
  if jsonb_array_length(measure->'pros')=0 or jsonb_array_length(measure->'cons')=0 or jsonb_array_length(measure->'competencies')=0 then errors:=errors||jsonb_build_array(jsonb_build_object('path','measures.'||id,'message','Pros, cons and competencies required')); end if;
  if (measure->>'initial_cost')::numeric+(measure->>'quarterly_cost')::numeric>0 and jsonb_array_length(measure->'allowed_funding_sources')=0 then errors:=errors||jsonb_build_array(jsonb_build_object('path','measures.'||id,'message','Spending requires a funding source')); end if;
  foreach k in array array['competencies','dependencies','allowed_funding_sources','regulation_sources'] loop
   if exists(select 1 from jsonb_array_elements_text(coalesce(measure->k,'[]')) r where not exists(select 1 from jsonb_array_elements(m->case k when 'dependencies' then 'measures' when 'allowed_funding_sources' then 'funding_sources' when 'regulation_sources' then 'sources' else 'competencies' end) x where x->>'id'=r)) then errors:=errors||jsonb_build_array(jsonb_build_object('path','measures.'||id||'.'||k,'message','Broken reference')); end if;
  end loop;
  if (select count(*) from jsonb_array_elements(measure->'effects'))<>(select count(distinct x->>'id') from jsonb_array_elements(measure->'effects') x) then errors:=errors||jsonb_build_array(jsonb_build_object('path','measures.'||id||'.effects','message','Duplicate effect IDs')); end if;
  for effect in select value from jsonb_array_elements(measure->'effects') loop
   if nullif(effect->>'id','') is null or jsonb_typeof(effect->'amount') is distinct from 'number' or effect->>'target_type' not in ('price','group','variable') or effect->>'operation' not in ('percent','points','absolute') then errors:=errors||jsonb_build_array(jsonb_build_object('path','measures.'||id||'.effects','message','Invalid effect')); end if;
   if (effect->>'target_type'='price' and (effect->>'target_id' not in ('rent','sale','free_rent') or effect->>'operation'<>'percent'))
   or (effect->>'target_type'='group' and (effect->>'operation'<>'points' or not exists(select 1 from jsonb_array_elements(m->'groups') g where g->>'id'=effect->>'target_id')))
   or (effect->>'target_type'='variable' and (effect->>'operation'='points' or not exists(select 1 from jsonb_array_elements(m->'variables') v where v->>'id'=effect->>'target_id')))
   then errors:=errors||jsonb_build_array(jsonb_build_object('path','measures.'||id||'.effects','message','Orphan effect or incompatible operation')); end if;
   if (effect->>'delay_turns')::numeric<0 or (effect->>'duration_turns')::numeric<1 or (effect->>'maturation_turns')::numeric<0 or (coalesce((effect->>'permanent')::boolean,false)=false and (effect->>'delay_turns')::numeric>=(effect->>'duration_turns')::numeric)
   then errors:=errors||jsonb_build_array(jsonb_build_object('path','measures.'||id||'.effects','message','Invalid effect timing')); end if;
   if exists(select 1 from jsonb_array_elements_text(coalesce(effect->'requires','[]')) r where not exists(select 1 from jsonb_array_elements(m->'measures') x where x->>'id'=r)) then errors:=errors||jsonb_build_array(jsonb_build_object('path','measures.'||id||'.effects','message','Broken effect dependency')); end if;
  end loop;
 end loop;
 if exists(with recursive edges as (
 select a->>'id' as src,b.value as dst from jsonb_array_elements(m->'measures') a cross join lateral jsonb_array_elements_text(a->'dependencies') b
 union select a->>'id',r.value from jsonb_array_elements(m->'measures') a cross join lateral jsonb_array_elements(a->'effects') e cross join lateral jsonb_array_elements_text(e->'requires') r
 ), walk(src,dst,path,cycle) as (
 select src,dst,array[src,dst],src=dst from edges union all
 select w.src,e.dst,w.path||e.dst,e.dst=any(w.path) from walk w join edges e on e.src=w.dst where not w.cycle
 ) select 1 from walk where cycle) then errors:=errors||'[{"path":"measures","message":"Cyclic dependency"}]'::jsonb; end if;
 if (m#>>'{prices,rent,value}')::numeric<=0 or (m#>>'{prices,sale,value}')::numeric<=0 or jsonb_typeof(m->'rules') is distinct from 'object' then errors:=errors||'[{"path":"prices","message":"Prices and rules required"}]'::jsonb; end if;
 for k in select generate_series(2027,2047)::text loop
  item:=m#>array['scenario','demography',k];
  if item is null or (item->>'population')::numeric<=0 then errors:=errors||jsonb_build_array(jsonb_build_object('path','scenario.demography.'||k,'message','Annual population path required')); end if;
 end loop;
 if abs((select coalesce(sum(value::numeric),0) from jsonb_each_text(m#>'{scenario,tenure_percent}'))-100)>0.000001 then errors:=errors||'[{"path":"scenario.tenure_percent","message":"Tenure percentages must sum to 100"}]'::jsonb; end if;
 return errors;
exception when others then return jsonb_build_array(jsonb_build_object('path','$','message','Invalid structure or scalar type: '||sqlerrm));
end $$;
revoke all on function simulator_private.model_errors(jsonb) from public,anon,authenticated;

create table public.sim_model_versions (
 id text primary key, label text not null,
 status text not null default 'draft' check(status in ('draft','published','retired')),
 engine_id text not null check(engine_id='js-national-v1'),
 payload jsonb not null, engine_manifest jsonb not null,
 source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),
 payload_checksum text generated always as (md5(payload::text)) stored,
 created_at timestamptz not null default now(),
 check(id=payload#>>'{metadata,version}'),
 check(jsonb_typeof(engine_manifest)='object')
);
create table public.sim_model_active (
 channel text primary key check(channel='national'),
 version_id text not null references public.sim_model_versions(id),
 updated_at timestamptz not null default now()
);
create index sim_model_active_version_idx on public.sim_model_active(version_id);
alter table public.sim_model_versions enable row level security;
alter table public.sim_model_active enable row level security;
revoke all on public.sim_model_versions,public.sim_model_active from anon,authenticated;
grant select on public.sim_model_versions,public.sim_model_active to anon,authenticated;
create policy published_model_read on public.sim_model_versions for select to anon,authenticated using(status='published');
create policy active_model_read on public.sim_model_active for select to anon,authenticated using(true);

create function simulator_private.check_model_version() returns trigger language plpgsql set search_path='' as $$
declare errors jsonb;
begin
 if tg_op='UPDATE' and old.status in ('published','retired') and
 (new.payload is distinct from old.payload or new.engine_id is distinct from old.engine_id or new.engine_manifest is distinct from old.engine_manifest or new.source_sha256 is distinct from old.source_sha256 or new.id is distinct from old.id)
 then raise exception 'Published model is immutable: create a new version'; end if;
 if tg_op='UPDATE' and new.status<>'published' and exists(select 1 from public.sim_model_active where version_id=old.id) then raise exception 'Move active pointer before retiring its version'; end if;
 errors:=simulator_private.model_errors(new.payload);
 if jsonb_array_length(errors)>0 then raise exception 'Invalid simulator model: %',errors; end if;
 return new;
end $$;
create trigger validate_model_version before insert or update on public.sim_model_versions for each row execute function simulator_private.check_model_version();
create function simulator_private.check_active_model() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.sim_model_versions where id=new.version_id and status='published') then raise exception 'Active model must be published'; end if;
 new.updated_at:=now();return new;
end $$;
create trigger validate_active_model before insert or update on public.sim_model_active for each row execute function simulator_private.check_active_model();
revoke all on function simulator_private.check_model_version(),simulator_private.check_active_model() from public,anon,authenticated;

create view public.sim_current_model with(security_invoker=true) as
select a.channel,v.id as version_id,v.label,v.engine_id,v.payload,v.engine_manifest,v.source_sha256,v.payload_checksum,a.updated_at
from public.sim_model_active a join public.sim_model_versions v on v.id=a.version_id where v.status='published';
