-- Avisos programados por correo (/api/avisos, una vez al día con Vercel Cron): recordatorios, pagos vencidos,
-- resumen semanal y Renta DIAN. Esta tabla evita repetir un aviso ya enviado. Solo la usa el servidor con la llave
-- service_role: RLS activo y sin políticas (nadie más la lee ni la escribe).
create table public.avisos_enviados (
  household_id uuid not null references public.households on delete cascade,
  clave        text not null check (char_length(clave) <= 200),
  tipo         text not null,
  destinatarios smallint not null default 0,
  created_at   timestamptz not null default now(),
  primary key (household_id, clave)
);
alter table public.avisos_enviados enable row level security;
comment on table public.avisos_enviados is 'Avisos por correo ya enviados (clave única por hogar). Solo service_role.';

-- El trabajo diario calcula el semáforo DIAN de cada hogar con la llave de servicio.
grant execute on function public.acumulados_tributarios(uuid, int) to service_role;
