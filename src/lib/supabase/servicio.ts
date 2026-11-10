import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/*
 * Cliente con la llave service_role: salta RLS. Solo en el servidor y solo para lo que ninguna persona puede hacer:
 * confirmar pagos (webhook), vencimientos y avisos (cron), y leer secretos de integraciones. Nunca en una página
 * con datos de un hogar: ahí va el cliente con la sesión (crearClienteServidor).
 */
export type Servicio = SupabaseClient<Database>;

export const hayServicio = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);

export function crearClienteServicio(): Servicio {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
