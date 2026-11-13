-- Rol «Familiar» del diseño (Invitar a alguien al hogar): ve el hogar y solo registra gastos.
-- Va en su propia migración: un valor nuevo de un enum no se puede usar en la misma transacción que lo crea.
alter type public.rol_miembro add value if not exists 'familiar';
