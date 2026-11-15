import "server-only";
import type { Contexto } from "@/lib/sesion";
import type { crearClienteServidor } from "@/lib/supabase/server";
import type { Categoria } from "@/lib/categorias";

export type CuentaOpcion = { id: string; nombre: string; tipo: "banco" | "efectivo" | "tarjeta" | "billetera"; titular_member_id: string | null };
export type Opcion = { id: string; nombre: string };
export type Catalogos = {
  cuentas: CuentaOpcion[];
  categorias: Categoria[];
  miembros: (Opcion & { es_dependiente: boolean })[];
  etiquetas: Opcion[];
  /** Deudas activas: al registrar en Deudas se elige cuál se paga (y se llena su cuota). */
  deudas: (Opcion & { cuota: number | null })[];
};

type Ctx = Contexto & { supabase: Awaited<ReturnType<typeof crearClienteServidor>> };

/** Lo que necesitan los formularios de movimientos, en una sola ida a la BD. */
export async function cargarCatalogos(ctx: Ctx): Promise<Catalogos> {
  const [cuentas, categorias, miembros, etiquetas, deudas] = await Promise.all([
    ctx.supabase.from("accounts").select("id, nombre, tipo, titular_member_id").eq("archivada", false).order("created_at"),
    ctx.supabase.from("categories").select("id, nombre, padre_id, clase, tipo, es_esencial, excluir_de_costo_vida, archivada"),
    ctx.supabase.from("members").select("id, nombre, es_dependiente").order("created_at"),
    ctx.supabase.from("tax_tags").select("id, nombre").eq("pais", ctx.hogar.pais).order("nombre"),
    ctx.supabase.from("debts").select("id, nombre, cuota").eq("archivada", false).order("created_at"),
  ]);
  return {
    cuentas: cuentas.data ?? [],
    categorias: categorias.data ?? [],
    miembros: miembros.data ?? [],
    etiquetas: etiquetas.data ?? [],
    deudas: deudas.data ?? [],
  };
}
