import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { mensajeError, type Estado } from "@/lib/acciones";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { BotonEnviar } from "@/components/ui/boton-enviar";

/** Cambia el hogar activo: la base valida la membresía y el JWT nuevo trae el hogar elegido. */
export async function cambiarHogar(_: Estado, datos: FormData): Promise<Estado> {
  "use server";
  const id = z.uuid().safeParse(datos.get("hogar"));
  if (!id.success) return { error: "Hogar no válido." };
  const ctx = await obtenerContexto();
  if (id.data !== ctx.hogar.id) {
    const { error } = await ctx.supabase.rpc("elegir_hogar", { p_hogar: id.data });
    if (error) return { error: mensajeError(error) };
    await ctx.supabase.auth.refreshSession();
    revalidatePath("/", "layout");
  }
  redirect("/");
}

/**
 * Selector de hogares (SaaS S5): aparece solo para quien pertenece a más de uno (una contadora con clientes, o
 * quien tiene su hogar y una firma). Reemplaza la decisión 14 («un usuario opera un hogar»).
 */
export async function SelectorHogar() {
  const ctx = await obtenerContexto();
  const { data } = await ctx.supabase.rpc("mis_hogares_lista");
  const hogares = data ?? [];
  if (hogares.length <= 1) return null;
  return (
    <FormularioAccion
      accion={cambiarHogar}
      className="mb-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-borde bg-elevada px-3 py-2 text-sm"
    >
      <label className="flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none">
        <span className="shrink-0 font-semibold text-cuerpo">Estás en</span>
        <select name="hogar" defaultValue={ctx.hogar.id} className="h-9 min-w-0 flex-1 rounded-lg border border-control bg-elevada px-2 sm:w-64">
          {hogares.map((h) => (
            <option key={h.id} value={h.id}>
              {h.nombre}
              {h.rol === "contador" ? " · cliente" : h.plan === "contador" ? " · mi firma" : ""}
            </option>
          ))}
        </select>
      </label>
      <BotonEnviar variante="secundario" className="h-9 px-3 text-sm" pendiente="Cambiando…">
        Cambiar
      </BotonEnviar>
    </FormularioAccion>
  );
}
