import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const clave = "Clave-de-prueba-123";

/** Crea usuarios y hogares de prueba y los borra al final. */
export function entornoDePrueba() {
  if (!url || !anonKey || !serviceKey) throw new Error("Faltan variables en .env.local (ver .env.example)");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const sufijo = Math.random().toString(36).slice(2, 8);
  const userIds: string[] = [];
  const hogares: string[] = [];

  return {
    admin,
    async usuario(nombre: string): Promise<{ email: string; db: SupabaseClient }> {
      const email = `${nombre}-${sufijo}@prueba.local`;
      const { data, error } = await admin.auth.admin.createUser({ email, password: clave, email_confirm: true });
      if (error) throw error;
      userIds.push(data.user.id);
      const db = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error: e2 } = await db.auth.signInWithPassword({ email, password: clave });
      if (e2) throw e2;
      return { email, db };
    },
    async hogar(db: SupabaseClient, nombre: string): Promise<string> {
      const { data, error } = await db.rpc("crear_hogar", { p_nombre: nombre, p_nombre_miembro: "Prueba" });
      if (error) throw error;
      hogares.push(data as string);
      return data as string;
    },
    async limpiar() {
      if (hogares.length) await admin.from("households").delete().in("id", hogares);
      for (const id of userIds) await admin.auth.admin.deleteUser(id);
    },
  };
}
