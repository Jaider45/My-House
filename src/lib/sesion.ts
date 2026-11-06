import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type Rol = Database["public"]["Enums"]["rol_miembro"];

export type Contexto = {
  userId: string;
  email: string;
  miembro: { id: string; nombre: string; rol: Rol };
  hogar: { id: string; nombre: string; pais: string; moneda: string; cuotaImprevistosPct: number };
  puedeEditar: boolean;
  esAdmin: boolean;
};

/** Lo que el hook `custom_access_token_hook` pone en el JWT (migración claims_hogar). */
type ClaimHogar = {
  miembro_id: string;
  miembro_nombre: string;
  rol: Rol;
  hogar_id: string;
  hogar_nombre: string;
  pais: string;
  moneda: string;
  cuota_imprevistos_pct: number;
};

/**
 * Usuario autenticado o redirección a /ingresar. `getClaims` verifica la firma del JWT con la llave pública
 * (cacheada en memoria): no hay viaje de red por request. La autorización real sigue siendo RLS.
 */
export const obtenerUsuario = cache(async () => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/ingresar");
  return {
    supabase,
    user: {
      id: claims.sub,
      email: (claims.email as string | undefined) ?? "",
      user_metadata: (claims.user_metadata ?? {}) as Record<string, unknown>,
    },
    hogar: (claims as { hogar?: ClaimHogar }).hogar,
    /** Cómo se abrió la sesión (contraseña, código, recuperación, 2FA) y cuándo. */
    amr: claims.amr,
  };
});

const armar = (userId: string, email: string, h: ClaimHogar): Contexto => ({
  userId,
  email,
  miembro: { id: h.miembro_id, nombre: h.miembro_nombre, rol: h.rol },
  hogar: { id: h.hogar_id, nombre: h.hogar_nombre, pais: h.pais, moneda: h.moneda, cuotaImprevistosPct: h.cuota_imprevistos_pct ?? 10 },
  puedeEditar: h.rol === "admin" || h.rol === "editor",
  esAdmin: h.rol === "admin",
});

/**
 * Hogar activo del usuario (el primero al que pertenece) o redirección a /onboarding.
 * Sale del JWT sin consultar la base; si el token es anterior al hook (o el usuario aún no tenía hogar cuando
 * se emitió), se consulta como antes. Decisión Fase 1: un usuario opera un solo hogar.
 */
export const obtenerContexto = cache(async (): Promise<Contexto & { supabase: Awaited<ReturnType<typeof crearClienteServidor>> }> => {
  const { supabase, user, hogar } = await obtenerUsuario();
  if (hogar?.hogar_id) return { supabase, ...armar(user.id, user.email, hogar) };

  const { data } = await supabase
    .from("members")
    .select("id, nombre, rol, households(id, nombre, pais, moneda, config)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!data?.households || !data.rol) redirect("/onboarding");
  const h = data.households;
  const config = (h.config ?? {}) as { cuota_imprevistos_pct?: number };
  return {
    supabase,
    ...armar(user.id, user.email, {
      miembro_id: data.id,
      miembro_nombre: data.nombre,
      rol: data.rol,
      hogar_id: h.id,
      hogar_nombre: h.nombre,
      pais: h.pais,
      moneda: h.moneda,
      cuota_imprevistos_pct: config.cuota_imprevistos_pct ?? 10,
    }),
  };
});
