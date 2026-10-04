-- Authorize the moderation panel with a normal Supabase Auth session.
-- The administrator flag belongs in app_metadata because users cannot edit it.
-- After applying this migration, grant access to an existing user from the
-- Supabase SQL Editor (replace the email) and ask them to sign in again:
--
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--   || '{"vtt_review_admin": true}'::jsonb
-- where lower(email) = lower('admin@example.com');

grant select, update, delete
on public.propuestas_desarrollo_urbano
to authenticated;

grant select, update, delete
on public.propuestas_fiscalidad_mejorada
to authenticated;

drop policy if exists "review_admin_select_all_desarrollo"
on public.propuestas_desarrollo_urbano;

create policy "review_admin_select_all_desarrollo"
on public.propuestas_desarrollo_urbano
for select
to authenticated
using (
  coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'vtt_review_admin') = 'true',
    false
  )
);

drop policy if exists "review_admin_update_desarrollo"
on public.propuestas_desarrollo_urbano;

create policy "review_admin_update_desarrollo"
on public.propuestas_desarrollo_urbano
for update
to authenticated
using (
  coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'vtt_review_admin') = 'true',
    false
  )
)
with check (
  coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'vtt_review_admin') = 'true',
    false
  )
);

drop policy if exists "review_admin_delete_desarrollo"
on public.propuestas_desarrollo_urbano;

create policy "review_admin_delete_desarrollo"
on public.propuestas_desarrollo_urbano
for delete
to authenticated
using (
  coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'vtt_review_admin') = 'true',
    false
  )
);

drop policy if exists "review_admin_select_all_fiscalidad"
on public.propuestas_fiscalidad_mejorada;

create policy "review_admin_select_all_fiscalidad"
on public.propuestas_fiscalidad_mejorada
for select
to authenticated
using (
  coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'vtt_review_admin') = 'true',
    false
  )
);

drop policy if exists "review_admin_update_fiscalidad"
on public.propuestas_fiscalidad_mejorada;

create policy "review_admin_update_fiscalidad"
on public.propuestas_fiscalidad_mejorada
for update
to authenticated
using (
  coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'vtt_review_admin') = 'true',
    false
  )
)
with check (
  coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'vtt_review_admin') = 'true',
    false
  )
);

drop policy if exists "review_admin_delete_fiscalidad"
on public.propuestas_fiscalidad_mejorada;

create policy "review_admin_delete_fiscalidad"
on public.propuestas_fiscalidad_mejorada
for delete
to authenticated
using (
  coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'vtt_review_admin') = 'true',
    false
  )
);
