import { CuadroIcono, EnlaceBoton, Explicacion, Titulo, Vacio } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha, formatearMes, hoy, mesDe } from "@/lib/fechas";
import { opcionesCategoria, type Categoria } from "@/lib/categorias";
import { iconoCategoria } from "@/lib/categorias/iconos";
import { FormularioResolver } from "../../comprobantes/formularios";
import { PestanasMovimientos } from "../../pestanas-secciones";
import { BotonGuia } from "@/components/guia/boton-guia";

export const metadata = { title: "Por revisar" };

type Datos = { comercio?: string; fecha?: string | null; total?: number | null; tipo?: "gasto" | "ingreso"; categoria?: string | null; cuenta?: string | null };

/**
 * Movimientos → Por revisar: los comprobantes que el asistente leyó pero no pudo registrar solo (le falta la fecha,
 * no está seguro de la categoría…). Se resuelven aquí con un toque; el resto ya está en la tabla de movimientos.
 */
export default async function PorRevisar() {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const fecha = hoy();
  const mes = mesDe(fecha);
  const [{ data: pendientes }, { count: registrados }, { data: categorias }, { data: cuentas }] = await Promise.all([
    ctx.supabase.from("receipts").select("id, nombre_archivo, pregunta, created_at, datos").eq("estado", "por_revisar").order("created_at", { ascending: false }).limit(50),
    ctx.supabase.from("receipts").select("id", { count: "exact", head: true }).eq("estado", "registrado").gte("created_at", `${mes}-01`),
    ctx.supabase.from("categories").select("id, nombre, padre_id, clase, tipo, es_esencial, excluir_de_costo_vida, archivada"),
    ctx.supabase.from("accounts").select("id, nombre").eq("archivada", false).order("created_at"),
  ]);
  const cats = (categorias ?? []) as Categoria[];
  const opcionesCats = [...opcionesCategoria(cats, "gasto"), ...opcionesCategoria(cats, "ingreso")];
  const catPorNombre = new Map(cats.map((c) => [c.nombre.toLowerCase(), c.id]));
  const ctaPorNombre = new Map((cuentas ?? []).map((c) => [c.nombre.toLowerCase(), c.id]));
  const lista = pendientes ?? [];
  const nombreMes = formatearMes(mes).replace(/ de \d{4}$/, "");

  return (
    <>
      <Titulo subtitulo="Todo lo que entra y sale de la casa" registrar={ctx.puedeEditar} accion={<BotonGuia id="revisar" />}>
        {`Movimientos de ${nombreMes}`}
      </Titulo>
      <PestanasMovimientos activa="/movimientos/revisar" />
      <div className="flex flex-col gap-4">
        {lista.length === 0 ? (
          <Vacio icono="documentos" titulo="Nada por revisar" acciones={<EnlaceBoton href="/comprobantes">Subir un comprobante</EnlaceBoton>}>
            Cuando el asistente no esté seguro de algo de un comprobante (la fecha, la categoría), te lo preguntará aquí.
          </Vacio>
        ) : (
          <>
            <Explicacion icono="documentos">
              El asistente registró solo <b>{registrados ?? 0} {registrados === 1 ? "comprobante" : "comprobantes"}</b> este mes.{" "}
              {lista.length === 1 ? "Este necesita" : `Estos ${lista.length} necesitan`} un toque tuyo; el resto ya está en la tabla de
              movimientos.
            </Explicacion>
            {lista.map((r) => {
              const d = (r.datos ?? {}) as Datos;
              return (
                <section key={r.id} data-guia="por-revisar" className="flex flex-col gap-3.5 rounded-2xl border border-borde bg-elevada p-4 md:p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <CuadroIcono nombre={iconoCategoria(d.categoria ?? d.comercio, d.tipo === "ingreso" ? "ingreso" : "gasto")} tamano={44} />
                    <div className="min-w-[180px] flex-1">
                      <b className="text-[17px]">{d.comercio || r.nombre_archivo || "Comprobante"}</b>
                      <span className="block text-[13px] text-tenue">
                        {[d.fecha ? formatearFecha(d.fecha) : "Sin fecha", d.cuenta, r.nombre_archivo].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    {d.total ? (
                      <b className="text-xl">
                        {d.tipo === "ingreso" ? "+" : "−"}
                        {formatearCOP(d.total)}
                      </b>
                    ) : null}
                  </div>
                  {r.pregunta && <b className="text-[15px]">{r.pregunta}</b>}
                  {ctx.puedeEditar && (
                    <FormularioResolver
                      id={r.id}
                      monto={d.total ?? null}
                      fecha={d.fecha ?? null}
                      categoria={d.categoria ? (catPorNombre.get(d.categoria.toLowerCase()) ?? null) : null}
                      cuenta={d.cuenta ? (ctaPorNombre.get(d.cuenta.toLowerCase()) ?? null) : null}
                      categorias={opcionesCats}
                      cuentas={(cuentas ?? []).map((c) => ({ id: c.id, etiqueta: c.nombre }))}
                      hoy={fecha}
                    />
                  )}
                </section>
              );
            })}
            {ctx.puedeEditar && (
              <EnlaceBoton href="/comprobantes" variante="secundario" className="self-start">
                Subir otro comprobante
              </EnlaceBoton>
            )}
          </>
        )}
      </div>
    </>
  );
}
