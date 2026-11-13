import { PestanasSeccion } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { hoy } from "@/lib/fechas";

/** Pagos: pagos fijos (con los vencidos), deudas y recordatorios. */
export async function PestanasPagos({ activa }: { activa: "/recurrentes" | "/deudas" | "/recordatorios" }) {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const { count } = await ctx.supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("estado", "programado")
    .eq("tipo", "gasto")
    .lt("fecha", hoy());
  return (
    <PestanasSeccion
      etiqueta="Pagos"
      activa={activa}
      pestanas={[
        { href: "/recurrentes", texto: "Pagos fijos", cuenta: count ?? 0, tonoCuenta: "error" },
        { href: "/deudas", texto: "Deudas" },
        { href: "/recordatorios", texto: "Recordatorios" },
      ]}
    />
  );
}

/** Planea: presupuesto y metas de ahorro. */
export function PestanasPlanea({ activa }: { activa: "/presupuesto" | "/metas" }) {
  return (
    <PestanasSeccion
      etiqueta="Planea"
      activa={activa}
      pestanas={[
        { href: "/presupuesto", texto: "Presupuesto" },
        { href: "/metas", texto: "Metas de ahorro" },
      ]}
    />
  );
}

/** Movimientos: todos, por revisar (comprobantes que esperan un dato) e importar extracto. */
export async function PestanasMovimientos({ activa }: { activa: "/movimientos" | "/movimientos/revisar" | "/importar" }) {
  const ctx = await obtenerContexto();
  const { count } = await ctx.supabase.from("receipts").select("id", { count: "exact", head: true }).eq("estado", "por_revisar");
  return (
    <PestanasSeccion
      etiqueta="Movimientos"
      activa={activa}
      pestanas={[
        { href: "/movimientos", texto: "Todos" },
        { href: "/movimientos/revisar", texto: "Por revisar", cuenta: count ?? 0, tonoCuenta: "error" },
        { href: "/importar", texto: "Importar extracto" },
      ]}
    />
  );
}
