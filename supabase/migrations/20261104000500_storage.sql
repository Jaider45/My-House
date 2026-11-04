-- Soportes (facturas, certificados, extractos). Ruta: {household_id}/{transaction_id}/{archivo}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('soportes', 'soportes', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp', 'text/csv']);

-- Devuelve el hogar de la ruta, o null si la ruta no empieza por un uuid (en vez de lanzar error).
create function private.hogar_de_ruta(p_name text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end $$;
grant execute on function private.hogar_de_ruta(text) to authenticated;

create policy soportes_select on storage.objects for select to authenticated
  using (bucket_id = 'soportes' and private.hogar_de_ruta(name) in (select private.mis_hogares()));
create policy soportes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'soportes' and private.tiene_rol(private.hogar_de_ruta(name), '{admin,editor}'));
create policy soportes_update on storage.objects for update to authenticated
  using (bucket_id = 'soportes' and private.tiene_rol(private.hogar_de_ruta(name), '{admin,editor}'))
  with check (bucket_id = 'soportes' and private.tiene_rol(private.hogar_de_ruta(name), '{admin,editor}'));
create policy soportes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'soportes' and private.tiene_rol(private.hogar_de_ruta(name), '{admin,editor}'));
