"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/sesion";
import { mensajeError, type Estado } from "@/lib/acciones";
import { digitosAMonto } from "@/lib/dinero";
import { hoy } from "@/lib/fechas";
import { primeraDesde } from "@/lib/recurrentes";
import { PAGOS_SUGERIDOS } from "./pagos";

const esquema = z.object({
  hogar: z.string().trim().min(1, "Ponle un nombre al hogar.").max(80),
  nombre: z.string().trim().min(1, "Escribe tu nombre.").max(80),
  ciudad: z.string().trim().max(60).optional(),
  ninos: z.coerce.number().int().min(0).max(10).default(0),
});

/** Paso 1: crea el hogar (con su ciudad y los niños como dependientes) y sigue a los pagos fijos. */
export async function crearHogar(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { data: hogar, error } = await supabase.rpc("crear_hogar", { p_nombre: r.data.hogar, p_nombre_miembro: r.data.nombre });
  if (error) return { error: mensajeError(error) };
  if (r.data.ciudad) await supabase.from("households").update({ ciudad: r.data.ciudad }).eq("id", hogar);
  if (r.data.ninos) {
    await supabase
      .from("members")
      .insert(Array.from({ length: r.data.ninos }, (_, i) => ({ household_id: hogar, nombre: r.data.ninos === 1 ? "Hijo" : `Hijo ${i + 1}`, es_dependiente: true })));
  }
  await supabase.auth.refreshSession(); // el JWT nuevo trae el hogar (custom_access_token_hook)
  redirect("/onboarding?paso=2");
}


/**
 * Paso 2: crea un pago fijo mensual por cada fila con monto. Si el hogar aún no tiene cuentas, crea
 * «Cuenta principal» para poder programarlos (se puede renombrar después).
 */
export async function guardarPagosFijos(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) redirect("/onboarding?paso=3");
  const filas = [
    ...PAGOS_SUGERIDOS.map((p) => ({ nombre: p.nombre, categoria: p.categoria, monto: digitosAMonto(String(datos.get(`monto:${p.clave}`) ?? "")), dia: Number(datos.get(`dia:${p.clave}`)) || p.dia })),
    {
      nombre: String(datos.get("otro:nombre") ?? "").trim(),
      categoria: "Imprevistos",
      monto: digitosAMonto(String(datos.get("otro:monto") ?? "")),
      dia: Number(datos.get("otro:dia")) || 1,
    },
  ].filter((f) => f.monto > 0 && f.nombre);
  if (filas.length) {
    const [{ data: categorias }, { data: cuentas }] = await Promise.all([
      ctx.supabase.from("categories").select("id, nombre").is("padre_id", null).eq("clase", "gasto"),
      ctx.supabase.from("accounts").select("id").eq("archivada", false).order("created_at").limit(1),
    ]);
    let cuenta = cuentas?.[0]?.id;
    if (!cuenta) {
      const nueva = await ctx.supabase.from("accounts").insert({ household_id: ctx.hogar.id, nombre: "Cuenta principal", tipo: "banco" }).select("id").single();
      if (nueva.error) return { error: mensajeError(nueva.error) };
      cuenta = nueva.data.id;
    }
    const porNombre = new Map((categorias ?? []).map((c) => [c.nombre, c.id]));
    const fecha = hoy();
    const reglas = filas.map((f) => {
      const dia = Math.min(28, Math.max(1, f.dia));
      const inicio = `${fecha.slice(0, 7)}-${String(dia).padStart(2, "0")}`;
      const { ocurrencias, fecha: proxima } = primeraDesde(inicio, "mensual", fecha);
      return {
        household_id: ctx.hogar.id,
        descripcion: f.nombre,
        monto: f.monto,
        tipo: "gasto" as const,
        account_id: cuenta,
        category_id: porNombre.get(f.categoria) ?? porNombre.get("Imprevistos")!,
        frecuencia: "mensual" as const,
        fecha_inicio: inicio,
        proxima_fecha: proxima,
        ocurrencias,
      };
    });
    const { error } = await ctx.supabase.from("recurring_rules").insert(reglas);
    if (error) return { error: mensajeError(error) };
    await ctx.supabase.rpc("generar_recurrentes_hogar", { p_household: ctx.hogar.id });
  }
  redirect("/onboarding?paso=3");
}
