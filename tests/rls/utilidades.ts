import { createHmac } from "node:crypto";
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
    /** Hogar nuevo. Por defecto en plan Familia (las pruebas de aislamiento no deben chocar con los límites de Gratis). */
    async hogar(db: SupabaseClient, nombre: string, plan = "familia"): Promise<string> {
      const { data, error } = await db.rpc("crear_hogar", { p_nombre: nombre, p_nombre_miembro: "Prueba" });
      if (error) throw error;
      hogares.push(data as string);
      if (plan !== "gratis") {
        const r = await admin.from("households").update({ plan }).eq("id", data as string);
        if (r.error) throw r.error;
      }
      return data as string;
    },
    async limpiar() {
      if (hogares.length) await admin.from("households").delete().in("id", hogares);
      for (const id of userIds) await admin.auth.admin.deleteUser(id);
    },
  };
}

/** Código TOTP (RFC 6238, SHA-1, 30 s, 6 dígitos) a partir de la clave base32 que entrega Supabase. */
export function totp(secreto: string, ahora = Date.now()): string {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secreto.replace(/=+$/, "").toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, "0");
  const clave = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(ahora / 30_000)));
  const h = createHmac("sha1", clave).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Inscribe un autenticador y sube la sesión a AAL2 (como /consola/dos-pasos). */
export async function conDosPasos(db: SupabaseClient) {
  const { data, error } = await db.auth.mfa.enroll({ factorType: "totp", friendlyName: `prueba-${Math.random()}` });
  if (error) throw error;
  const v = await db.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp(data.totp.secret) });
  if (v.error) throw v.error;
}
