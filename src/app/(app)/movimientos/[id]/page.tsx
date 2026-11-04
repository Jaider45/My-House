import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Aviso, Boton, Cargando, Tarjeta, Titulo } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarCatalogos } from "@/lib/catalogos";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha, hoy } from "@/lib/fechas";
import { FormularioMovimiento } from "../formulario";
import { eliminarMovimiento } from "../acciones";

export const metadata = { title: "Movimiento" };

const ORIGEN = {
  manual: "registro manual",
  importacion: "importado de extracto",
  recurrente: "gasto recurrente",
  ocr: "factura escaneada",
  whatsapp: "WhatsApp",
  banco: "conexión bancaria",
} as const;

export default function Detalle({ params }: PageProps<"/movimientos/[id]">) {
  return (
    <>
      <Titulo>Movimiento</Titulo>
      <Suspense fallback={<Cargando />}>
        <Contenido params={params} />
      </Suspense>
    </>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await obtenerContexto();
  const { data: m } = await ctx.supabase
    .from("transactions")
    .select("id, tipo, fecha, monto, account_id, cuenta_destino_id, category_id, member_id, tax_tag_id, comercio, nota, estado, origen, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!m) notFound();

  const info = (
    <p className="mb-3 text-xs text-zinc-500">
      Origen: {ORIGEN[m.origen]} · creado el {formatearFecha(m.created_at.slice(0, 10))}
      {m.estado === "programado" && " · programado (al guardar queda confirmado)"}
    </p>
  );

  if (!ctx.puedeEditar) {
    return (
      <Tarjeta>
        {info}
        <p className="text-2xl font-bold">{formatearCOP(m.monto)}</p>
        <p className="text-sm text-zinc-500">
          {m.tipo} · {formatearFecha(m.fecha)} {m.comercio && `· ${m.comercio}`}
        </p>
        <Aviso tipo="info">Su rol es de solo lectura.</Aviso>
      </Tarjeta>
    );
  }

  const catalogos = await cargarCatalogos(ctx);
  return (
    <div className="space-y-4">
      <Tarjeta>
        {info}
        <FormularioMovimiento catalogos={catalogos} movimiento={m} hoy={hoy()} miembroId={ctx.miembro.id} />
      </Tarjeta>
      <form action={eliminarMovimiento}>
        <input type="hidden" name="id" value={m.id} />
        <Boton type="submit" variante="peligro" className="w-full">
          Eliminar movimiento
        </Boton>
      </form>
    </div>
  );
}
