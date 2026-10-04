-- Remove broad default privileges. TRUNCATE is especially important because it
-- is not governed by row-level security policies.
revoke all privileges
on public.propuestas_desarrollo_urbano
from anon, authenticated;

revoke all privileges
on public.propuestas_fiscalidad_mejorada
from anon, authenticated;

grant select, insert
on public.propuestas_desarrollo_urbano
to anon;

grant select, insert, update, delete
on public.propuestas_desarrollo_urbano
to authenticated;

grant select, insert
on public.propuestas_fiscalidad_mejorada
to anon;

grant select, insert, update, delete
on public.propuestas_fiscalidad_mejorada
to authenticated;

-- Keep one SELECT policy per role/action. Visitors see approved proposals;
-- authenticated reviewers see every proposal only when the protected
-- app_metadata flag is present in their verified Supabase Auth JWT.
drop policy if exists "public_select_approved_desarrollo"
on public.propuestas_desarrollo_urbano;

drop policy if exists "review_admin_select_all_desarrollo"
on public.propuestas_desarrollo_urbano;

create policy "public_select_approved_desarrollo"
on public.propuestas_desarrollo_urbano
for select
to anon
using (status = 'aprobada');

create policy "authenticated_select_desarrollo"
on public.propuestas_desarrollo_urbano
for select
to authenticated
using (
  status = 'aprobada'
  or coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'vtt_review_admin') = 'true',
    false
  )
);

drop policy if exists "public_select_approved_fiscalidad"
on public.propuestas_fiscalidad_mejorada;

drop policy if exists "review_admin_select_all_fiscalidad"
on public.propuestas_fiscalidad_mejorada;

create policy "public_select_approved_fiscalidad"
on public.propuestas_fiscalidad_mejorada
for select
to anon
using (status = 'aprobada');

create policy "authenticated_select_fiscalidad"
on public.propuestas_fiscalidad_mejorada
for select
to authenticated
using (
  status = 'aprobada'
  or coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'vtt_review_admin') = 'true',
    false
  )
);
