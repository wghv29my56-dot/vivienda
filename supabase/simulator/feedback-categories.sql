alter table public.sim_bug_reports add column category text not null default 'error'
 check (category in ('error','improvement','new_measure'));
grant insert (category) on public.sim_bug_reports to anon, authenticated;
comment on table public.sim_bug_reports is 'Private simulator feedback: errors, improvement suggestions and new policy proposals.';
