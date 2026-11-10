-- Permiso para gestionar cuentas de usuarios desde la consola (cerrar sesiones, restablecer 2FA). Va solo en esta
-- migración: un valor nuevo de enum no se puede usar en la misma transacción en que se crea.
alter type public.permiso_staff add value if not exists 'usuarios' after 'ver_finanzas';
