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

/** Usuario autenticado o redirección a /ingresar. Una consulta por request (React cache). */
export const obtenerUsuario = cache(async () => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/ingresar");
  return { supabase, user: data.user };
});

/**
 * Hogar activo del usuario (el primero al que pertenece) o redirección a /onboarding.
 * Decisión Fase 1: un usuario opera un solo hogar; el selector de hogares queda para el SaaS.
 */
export const obtenerContexto = cache(async (): Promise<Contexto & { supabase: Awaited<ReturnType<typeof crearClienteServidor>> }> => {
  const { supabase, user } = await obtenerUsuario();
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
    userId: user.id,
    email: user.email ?? "",
    miembro: { id: data.id, nombre: data.nombre, rol: data.rol },
    hogar: {
      id: h.id,
      nombre: h.nombre,
      pais: h.pais,
      moneda: h.moneda,
      cuotaImprevistosPct: config.cuota_imprevistos_pct ?? 10,
    },
    puedeEditar: data.rol === "admin" || data.rol === "editor",
    esAdmin: data.rol === "admin",
  };
});
