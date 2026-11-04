-- Tenencia: hogares, miembros, invitaciones y helpers de RLS.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create type public.rol_miembro as enum ('admin', 'editor', 'contador');

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null check (char_length(btrim(nombre)) between 1 and 80),
  pais       char(2) not null default 'CO',
  moneda     char(3) not null default 'COP',
  plan       text    not null default 'gratis',
  config     jsonb   not null default '{"cuota_imprevistos_pct": 10}',
  created_at timestamptz not null default now()
);

create table public.members (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households on delete cascade,
  user_id        uuid references auth.users on delete set null,   -- null = dependiente sin acceso
  nombre         text not null check (char_length(btrim(nombre)) between 1 and 80),
  rol            public.rol_miembro,
  es_dependiente boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (household_id, user_id),
  unique (id, household_id),
  check (user_id is null or rol is not null)
);
create index members_user_id_idx on public.members (user_id);

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  email        text not null check (position('@' in email) > 1),
  rol          public.rol_miembro not null default 'editor',
  token        text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  creada_por   uuid default auth.uid() references auth.users on delete set null,
  expira_en    timestamptz not null default now() + interval '7 days',
  aceptada_en  timestamptz,
  created_at   timestamptz not null default now()
);
create index invitations_household_idx on public.invitations (household_id);

-- Helpers RLS. security definer evita la recursión al consultar members desde sus propias políticas.
create function private.mis_hogares() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select household_id from public.members where user_id = (select auth.uid())
$$;

create function private.tiene_rol(h uuid, roles public.rol_miembro[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members
    where household_id = h and user_id = (select auth.uid()) and rol = any (roles)
  )
$$;

revoke all on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.mis_hogares() to authenticated;
grant execute on function private.tiene_rol(uuid, public.rol_miembro[]) to authenticated;

-- RLS
alter table public.households  enable row level security;
alter table public.members     enable row level security;
alter table public.invitations enable row level security;

-- Hogares: sin insert/delete directos; se crean con public.crear_hogar().
create policy hogar_select on public.households for select to authenticated
  using (id in (select private.mis_hogares()));
create policy hogar_update on public.households for update to authenticated
  using (private.tiene_rol(id, '{admin}')) with check (private.tiene_rol(id, '{admin}'));

create policy miembros_select on public.members for select to authenticated
  using (household_id in (select private.mis_hogares()));
-- Solo dependientes (sin usuario); los usuarios entran por invitación.
create policy miembros_insert on public.members for insert to authenticated
  with check (private.tiene_rol(household_id, '{admin}') and user_id is null);
create policy miembros_update on public.members for update to authenticated
  using (private.tiene_rol(household_id, '{admin}'))
  with check (private.tiene_rol(household_id, '{admin}'));
create policy miembros_delete on public.members for delete to authenticated
  using (private.tiene_rol(household_id, '{admin}') and user_id is distinct from (select auth.uid()));

create policy invitaciones_admin on public.invitations for all to authenticated
  using (private.tiene_rol(household_id, '{admin}'))
  with check (private.tiene_rol(household_id, '{admin}'));

-- Un admin no puede cambiarse su propio rol ni el user_id de nadie (evita quedar sin admin o secuestrar filas).
create function private.proteger_miembro() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'no se puede cambiar el usuario de un miembro';
  end if;
  if old.user_id = (select auth.uid()) and new.rol is distinct from old.rol then
    raise exception 'no puede cambiar su propio rol';
  end if;
  return new;
end $$;

create trigger members_proteger before update on public.members
  for each row execute function private.proteger_miembro();
