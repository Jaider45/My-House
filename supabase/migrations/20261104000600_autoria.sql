-- La autoría la fija la base de datos: un cliente no puede registrar algo a nombre de otro usuario.

create function private.fijar_autor() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Solo para sesiones de usuario; procesos internos (pg_cron, service_role) no tienen auth.uid().
  if (select auth.uid()) is not null then
    if tg_table_name = 'invitations' then
      new.creada_por := (select auth.uid());
    else
      new.created_by := (select auth.uid());
    end if;
  end if;
  return new;
end $$;

create trigger transactions_autor before insert on public.transactions
  for each row execute function private.fijar_autor();
create trigger import_batches_autor before insert on public.import_batches
  for each row execute function private.fijar_autor();
create trigger invitations_autor before insert on public.invitations
  for each row execute function private.fijar_autor();

-- Tampoco se puede cambiar después.
create function private.conservar_autor() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_by := old.created_by;
  return new;
end $$;

create trigger transactions_conservar_autor before update on public.transactions
  for each row execute function private.conservar_autor();
