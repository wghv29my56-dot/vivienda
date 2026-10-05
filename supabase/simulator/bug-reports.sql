create table public.sim_bug_reports (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 status text not null default 'new' check (status in ('new','reviewing','resolved')),
 description text not null check (char_length(btrim(description)) between 10 and 3000),
 reproduction_steps text not null default '' check (char_length(reproduction_steps) <= 1500),
 page_path text not null check (char_length(page_path) between 1 and 200),
 model_version text check (char_length(model_version) <= 100),
 context jsonb not null default '{}' check (jsonb_typeof(context) = 'object' and octet_length(context::text) <= 8000)
);
create index sim_bug_reports_status_created_idx on public.sim_bug_reports (status, created_at desc);
alter table public.sim_bug_reports enable row level security;
revoke all on public.sim_bug_reports from public, anon, authenticated;
grant insert (id,description,reproduction_steps,page_path,model_version,context) on public.sim_bug_reports to anon, authenticated;
grant select,insert,update,delete on public.sim_bug_reports to service_role;
create policy submit_bug_report on public.sim_bug_reports for insert to anon,authenticated
 with check (status = 'new');
comment on table public.sim_bug_reports is 'User-submitted simulator errors. Public clients can submit only; reports are private.';
