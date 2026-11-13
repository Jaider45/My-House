-- Permiso nuevo del equipo: contenido que ve la app (Academia, ofertas y enlaces, plantillas de WhatsApp y documentos
-- legales). Un valor nuevo de enum va en su propia migración: no se puede usar en la misma transacción.
alter type public.permiso_staff add value if not exists 'contenido_app' after 'campanas';
