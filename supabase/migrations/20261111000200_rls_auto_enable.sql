-- Supabase Cloud crea `public.rls_auto_enable()` (event trigger de «Enable automatic RLS» al crear el proyecto) con
-- permiso de ejecución para todos. No se puede llamar por la API (es de tipo event_trigger), pero
-- `revision_seguridad()` la marca como función pública para anon. Se le quita el permiso: los triggers no lo
-- revisan al dispararse, así que sigue activando RLS en las tablas nuevas. En local no existe y no hace nada.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
