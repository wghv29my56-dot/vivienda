-- Anonymous behavioral events: submission only. Read access requires the existing review administrator.
create table public.sim_tracking_settings (
 id boolean primary key default true check (id),
 enabled boolean not null default true,
 idle_seconds integer not null default 90 check (idle_seconds between 30 and 300),
 updated_at timestamptz not null default now()
);
insert into public.sim_tracking_settings (id) values (true);
alter table public.sim_tracking_settings enable row level security;
revoke all on public.sim_tracking_settings from public, anon, authenticated;
grant select on public.sim_tracking_settings to anon, authenticated;
grant update (enabled,idle_seconds,updated_at) on public.sim_tracking_settings to authenticated;
grant all on public.sim_tracking_settings to service_role;
create policy tracking_settings_read on public.sim_tracking_settings for select to anon,authenticated using (true);
create policy tracking_settings_admin on public.sim_tracking_settings for update to authenticated
 using (coalesce((select auth.jwt())->'app_metadata'->>'vtt_review_admin'='true',false))
 with check (coalesce((select auth.jwt())->'app_metadata'->>'vtt_review_admin'='true',false));

create table public.sim_tracking_events (
 id uuid primary key,
 received_at timestamptz not null default now(),
 occurred_at timestamptz not null,
 game_id uuid not null,
 session_id uuid not null,
 model_version text not null check (char_length(model_version) between 1 and 100),
 turn integer not null check (turn between 0 and 1000),
 event_type text not null check (event_type in ('game_started','game_completed','game_ended','game_checkpoint','measure_opened','measure_info_opened','measure_source_clicked','measure_config_changed','measure_funding_changed','measure_blocked','measure_prepare_attempted','measure_prepared','measure_closed','measure_removed','measure_applied','turn_committed')),
 measure_id text check (char_length(measure_id) between 1 and 150),
 active_seconds numeric not null check (active_seconds between 0 and 31536000),
 visible_seconds numeric not null check (visible_seconds between 0 and 31536000),
 measure_active_seconds numeric not null default 0 check (measure_active_seconds between 0 and 31536000),
 measure_visible_seconds numeric not null default 0 check (measure_visible_seconds between 0 and 31536000),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object' and octet_length(data::text)<=12000)
);
create index sim_tracking_events_game_time_idx on public.sim_tracking_events (game_id,occurred_at);
create index sim_tracking_events_received_idx on public.sim_tracking_events (received_at desc,id);
alter table public.sim_tracking_events enable row level security;
revoke all on public.sim_tracking_events from public, anon, authenticated;
grant insert (id,occurred_at,game_id,session_id,model_version,turn,event_type,measure_id,active_seconds,visible_seconds,measure_active_seconds,measure_visible_seconds,data) on public.sim_tracking_events to anon,authenticated;
grant select on public.sim_tracking_events to authenticated;
grant all on public.sim_tracking_events to service_role;
create policy tracking_submit on public.sim_tracking_events for insert to anon,authenticated
 with check ((select enabled from public.sim_tracking_settings where id=true) and occurred_at<=now()+interval '1 day');
create policy tracking_admin_read on public.sim_tracking_events for select to authenticated
 using (coalesce((select auth.jwt())->'app_metadata'->>'vtt_review_admin'='true',false));

-- Existing feedback retains public submission and becomes readable/moderatable only by review admins.
grant select on public.sim_bug_reports to authenticated;
grant update (status) on public.sim_bug_reports to authenticated;
create policy feedback_admin_read on public.sim_bug_reports for select to authenticated
 using (coalesce((select auth.jwt())->'app_metadata'->>'vtt_review_admin'='true',false));
create policy feedback_admin_status on public.sim_bug_reports for update to authenticated
 using (coalesce((select auth.jwt())->'app_metadata'->>'vtt_review_admin'='true',false))
 with check (coalesce((select auth.jwt())->'app_metadata'->>'vtt_review_admin'='true',false));
