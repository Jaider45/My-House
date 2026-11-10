import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./database.types";

/**
 * Cliente con la sesión del usuario (RLS aplica). Llamar solo detrás de <Suspense> o en Server Actions.
 * `cabeceras` viajan en cada petición a PostgREST (la consola manda IP y navegador para la auditoría).
 */
export async function crearClienteServidor(cabeceras?: Record<string, string>) {
  // Todo lo que pasa por Supabase es por request: supabase-js usa Date.now() para la sesión y los datos
  // financieros no se cachean.
  await connection();
  const almacen = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cabeceras && { global: { headers: cabeceras } }),
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (lista) => {
          try {
            lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
          } catch {
            // Desde un Server Component no se pueden escribir cookies; el proxy refresca la sesión.
          }
        },
      },
    },
  );
}
