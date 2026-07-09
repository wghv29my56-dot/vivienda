create table if not exists public.propuestas_desarrollo_urbano (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada')),
  nombre_zona text not null check (char_length(nombre_zona) between 3 and 160),
  provincia text not null check (char_length(provincia) between 2 and 120),
  municipio text not null check (char_length(municipio) between 2 and 160),
  viviendas_estimadas integer check (viviendas_estimadas is null or viviendas_estimadas >= 0),
  justificacion text not null check (char_length(justificacion) between 20 and 4000),
  contacto text check (contacto is null or char_length(contacto) <= 320),
  coordenadas jsonb not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.propuestas_fiscalidad_mejorada (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada')),
  nombre_zona text not null check (char_length(nombre_zona) between 3 and 160),
  provincia text not null check (char_length(provincia) between 2 and 120),
  municipio text not null check (char_length(municipio) between 2 and 160),
  poblacion integer check (poblacion is null or poblacion >= 0),
  justificacion text not null check (char_length(justificacion) between 20 and 4000),
  contacto text check (contacto is null or char_length(contacto) <= 320),
  coordenadas jsonb not null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.propuestas_desarrollo_urbano enable row level security;
alter table public.propuestas_fiscalidad_mejorada enable row level security;

grant select, insert on public.propuestas_desarrollo_urbano to anon, authenticated;
grant select, insert on public.propuestas_fiscalidad_mejorada to anon, authenticated;

drop policy if exists "public_select_approved_desarrollo" on public.propuestas_desarrollo_urbano;
create policy "public_select_approved_desarrollo"
on public.propuestas_desarrollo_urbano
for select
to anon, authenticated
using (status = 'aprobada');

drop policy if exists "public_insert_pending_desarrollo" on public.propuestas_desarrollo_urbano;
create policy "public_insert_pending_desarrollo"
on public.propuestas_desarrollo_urbano
for insert
to anon, authenticated
with check (status = 'pendiente');

drop policy if exists "public_select_approved_fiscalidad" on public.propuestas_fiscalidad_mejorada;
create policy "public_select_approved_fiscalidad"
on public.propuestas_fiscalidad_mejorada
for select
to anon, authenticated
using (status = 'aprobada');

drop policy if exists "public_insert_pending_fiscalidad" on public.propuestas_fiscalidad_mejorada;
create policy "public_insert_pending_fiscalidad"
on public.propuestas_fiscalidad_mejorada
for insert
to anon, authenticated
with check (status = 'pendiente');

create index if not exists propuestas_desarrollo_estado_fecha_idx
on public.propuestas_desarrollo_urbano (status, created_at desc);

create index if not exists propuestas_fiscalidad_estado_fecha_idx
on public.propuestas_fiscalidad_mejorada (status, created_at desc);
