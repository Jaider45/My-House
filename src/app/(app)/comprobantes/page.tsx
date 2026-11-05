import Link from "next/link";
import { Suspense } from "react";
import { Aviso, Cargando, Chip, CuadroIcono, EnlaceBoton, FilaLista, Tarjeta, Titulo, cx, type Tono } from "@/components/ui";
import { Logo } from "@/components/marca";
import { obtenerContexto } from "@/lib/sesion";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha, hoy, mesDe } from "@/lib/fechas";
import { opcionesCategoria, type Categoria } from "@/lib/categorias";
import { iconoCategoria } from "@/lib/categorias/iconos";
import { cambiarRegla, deshacerComprobante } from "./acciones";
import { Compositor } from "./chat";
import { FormularioResolver } from "./formularios";

export const metadata = { title: "Comprobantes" };

export default function Comprobantes() {
  return (
    <>
      <Titulo subtitulo="Sube fotos, PDF o capturas: los leo, los registro en Movimientos y los categorizo">Asistente de comprobantes</Titulo>
      <Suspense fallback={<Cargando texto="Cargando la conversación…" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

type Recibo = {
  id: string;
  estado: "procesando" | "registrado" | "soporte" | "por_revisar" | "descartado" | "error";
  nombre_archivo: string | null;
  pregunta: string | null;
  transaction_id: string | null;
  created_at: string;
  datos: {
    comercio?: string;
    fecha?: string | null;
    total?: number | null;
    tipo?: "gasto" | "ingreso";
    categoria?: string | null;
    confianza?: number;
    cuenta?: string | null;
    etiqueta_dian?: string | null;
    ambito?: string | null;
  };
};

const ESTADO: Record<Recibo["estado"], { texto: string; tono: Tono }> = {
  procesando: { texto: "Leyendo…", tono: "neutro" },
  registrado: { texto: "Registrado", tono: "ok" },
  soporte: { texto: "Soporte adjuntado", tono: "info" },
  por_revisar: { texto: "Falta un dato", tono: "alerta" },
  descartado: { texto: "Descartado", tono: "neutro" },
  error: { texto: "No se pudo leer", tono: "error" },
};

const hora = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const dia = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" });

async function Contenido() {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const fecha = hoy();
  const mes = mesDe(fecha);
  const [{ data: mensajes }, { data: recibos }, { data: reglas }, { data: categorias }, { data: cuentas }, { data: miembros }] = await Promise.all([
    ctx.supabase.from("assistant_messages").select("id, autor, texto, receipt_ids, created_by, created_at").order("created_at", { ascending: false }).limit(40),
    ctx.supabase
      .from("receipts")
      .select("id, estado, nombre_archivo, pregunta, transaction_id, created_at, datos")
      .gte("created_at", `${mes}-01`)
      .order("created_at", { ascending: false })
      .limit(300),
    ctx.supabase.from("merchant_rules").select("id, patron, activa, categories(nombre)").order("created_at"),
    ctx.supabase.from("categories").select("id, nombre, padre_id, clase, tipo, es_esencial, excluir_de_costo_vida, archivada"),
    ctx.supabase.from("accounts").select("id, nombre").eq("archivada", false).order("created_at"),
    ctx.supabase.from("members").select("nombre, user_id"),
  ]);
  const lista = (recibos ?? []) as Recibo[];
  const porId = new Map(lista.map((r) => [r.id, r]));
  // Recibos de mensajes de meses anteriores (la conversación muestra 40 mensajes).
  const faltan = [...new Set((mensajes ?? []).flatMap((m) => m.receipt_ids))].filter((id) => !porId.has(id));
  if (faltan.length) {
    const { data } = await ctx.supabase.from("receipts").select("id, estado, nombre_archivo, pregunta, transaction_id, created_at, datos").in("id", faltan);
    for (const r of (data ?? []) as Recibo[]) porId.set(r.id, r);
  }
  // Cronológico; con la misma hora, el mensaje de la familia antes que la respuesta.
  const conversacion = [...(mensajes ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at) || (a.autor === "usuario" ? -1 : 1));
  const nombreDe = new Map((miembros ?? []).filter((m) => m.user_id).map((m) => [m.user_id!, m.nombre.split(" ")[0]]));
  const cats = (categorias ?? []) as Categoria[];
  const opcionesCats = [...opcionesCategoria(cats, "gasto"), ...opcionesCategoria(cats, "ingreso")];
  const catPorNombre = new Map(cats.map((c) => [c.nombre.toLowerCase(), c.id]));
  const ctaPorNombre = new Map((cuentas ?? []).map((c) => [c.nombre.toLowerCase(), c.id]));
  const opcionesCuentas = (cuentas ?? []).map((c) => ({ id: c.id, etiqueta: c.nombre }));
  const pendientes = lista.filter((r) => r.estado === "por_revisar");
  const iaLista = !!process.env.ANTHROPIC_API_KEY;
  const cuenta = (n: Recibo["estado"][]) => lista.filter((r) => n.includes(r.estado)).length;

  const tarjeta = (r: Recibo) => {
    const d = r.datos ?? {};
    const e = ESTADO[r.estado];
    return (
      <div key={r.id} className={cx("mt-2.5 flex flex-col gap-2.5 rounded-[14px] border bg-elevada p-3.5", r.estado === "por_revisar" ? "border-[#e9cf8a]" : "border-borde")}>
        <div className="flex flex-wrap items-center gap-2.5">
          <CuadroIcono nombre={iconoCategoria(d.categoria ?? d.comercio, d.tipo === "ingreso" ? "ingreso" : "gasto")} />
          <b className="min-w-[140px] flex-1">{d.comercio || r.nombre_archivo || "Comprobante"}</b>
          {d.total ? (
            <b className="text-[17px]">
              {d.tipo === "ingreso" ? "+" : "−"}
              {formatearCOP(d.total)}
            </b>
          ) : null}
          <Chip tono={e.tono}>{e.texto}</Chip>
        </div>
        {(r.estado === "registrado" || r.estado === "por_revisar") && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] leading-[18px] sm:grid-cols-3">
            <div>
              <dt className="text-tenue">Fecha</dt>
              <dd className="text-sm font-bold">{d.fecha ? formatearFecha(d.fecha) : "—"}</dd>
            </div>
            <div>
              <dt className="text-tenue">Categoría</dt>
              <dd className="text-sm font-bold">{d.categoria ? `${d.categoria}${d.confianza ? ` · ${d.confianza} %` : ""}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-tenue">Cuenta</dt>
              <dd className="text-sm font-bold">{d.cuenta ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-tenue">Ámbito</dt>
              <dd className="text-sm font-bold first-letter:uppercase">{d.ambito ?? "personal"}</dd>
            </div>
            <div>
              <dt className="text-tenue">Etiqueta DIAN</dt>
              <dd className="text-sm font-bold">{d.etiqueta_dian ?? "Sin etiqueta"}</dd>
            </div>
          </dl>
        )}
        {r.pregunta && r.estado !== "registrado" && <p className="text-sm text-cuerpo">{r.pregunta}</p>}
        {r.estado === "por_revisar" && ctx.puedeEditar && (
          <FormularioResolver
            id={r.id}
            monto={d.total ?? null}
            fecha={d.fecha ?? null}
            categoria={d.categoria ? (catPorNombre.get(d.categoria.toLowerCase()) ?? null) : null}
            cuenta={d.cuenta ? (ctaPorNombre.get(d.cuenta.toLowerCase()) ?? null) : null}
            categorias={opcionesCats}
            cuentas={opcionesCuentas}
            hoy={fecha}
          />
        )}
        {(r.estado === "registrado" || r.estado === "soporte") && (
          <div className="flex flex-wrap gap-2">
            {r.transaction_id && (
              <EnlaceBoton href={`/movimientos/${r.transaction_id}`} variante="secundario" className="h-9 px-3 text-sm">
                Ver en Movimientos
              </EnlaceBoton>
            )}
            {r.estado === "registrado" && ctx.puedeEditar && (
              <form action={deshacerComprobante}>
                <input type="hidden" name="id" value={r.id} />
                <button type="submit" className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold hover:bg-mosaico">
                  Deshacer
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <section aria-label="Conversación con el asistente" className="flex min-w-0 flex-col rounded-2xl border border-borde bg-elevada">
        <div role="log" aria-live="polite" className="flex flex-col gap-3.5 p-3.5 md:gap-[18px] md:p-6">
          {!iaLista && (
            <Aviso tipo="info">
              El asistente necesita una llave de la API de Anthropic en el servidor (<code>ANTHROPIC_API_KEY</code>). Mientras
              tanto puedes ver la conversación y resolver lo pendiente.
            </Aviso>
          )}
          {conversacion.length === 0 && (
            <div className="flex items-start gap-2.5">
              <Logo forma="isotipo" alto={32} />
              <p className="flex-1 rounded-2xl rounded-tl-[4px] bg-pagina px-3.5 py-3 text-[15px] leading-[22px]">
                Hola {ctx.miembro.nombre.split(" ")[0]}. Mándame fotos de facturas, recibos en PDF o capturas de transferencias y los
                registro en Movimientos con su categoría. Si algo no se lee bien, te pregunto.
              </p>
            </div>
          )}
          {conversacion.map((m, i) => {
            const antes = conversacion[i - 1];
            const nuevoDia = !antes || antes.created_at.slice(0, 10) !== m.created_at.slice(0, 10);
            const cuando = hora.format(new Date(m.created_at));
            const tarjetas = m.receipt_ids.map((id) => porId.get(id)).filter((r): r is Recibo => !!r);
            return (
              <div key={m.id} className="flex flex-col gap-3.5">
                {nuevoDia && <p className="text-center text-[13px] text-tenue first-letter:uppercase">{dia.format(new Date(m.created_at))}</p>}
                {m.autor === "usuario" ? (
                  <div className="flex flex-col items-end">
                    <div className="max-w-[620px] rounded-2xl rounded-br-[4px] bg-monte px-3.5 py-3 text-[15px] leading-[22px] text-arena">
                      {m.texto}
                      {tarjetas.some((t) => t.nombre_archivo) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {tarjetas
                            .filter((t) => t.nombre_archivo)
                            .map((t) => (
                              <span key={t.id} className="inline-flex items-center gap-2 rounded-[10px] bg-[#1b4a3e] py-1.5 pr-2.5 pl-1.5 text-[13px]">
                                <span className="inline-flex h-11 w-9 items-center justify-center rounded-md bg-arena text-[10px] font-bold text-monte">
                                  {(t.nombre_archivo!.split(".").pop() ?? "").toUpperCase()}
                                </span>
                                {t.nombre_archivo}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                    <span className="mt-1 text-xs text-tenue">
                      {(m.created_by && nombreDe.get(m.created_by)) || "Tú"} · {cuando}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0">
                      <Logo forma="isotipo" alto={32} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="rounded-2xl rounded-tl-[4px] bg-pagina px-3.5 py-3 text-[15px] leading-[22px]">
                        <p className="whitespace-pre-line">{m.texto}</p>
                        {tarjetas.map(tarjeta)}
                      </div>
                      <span className="mt-1 block text-xs text-tenue">My House · {cuando}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {ctx.puedeEditar && <Compositor habilitado={iaLista} />}
      </section>

      <aside className="flex min-w-0 flex-col gap-4">
        <Tarjeta>
          <p className="mb-3 text-xs leading-4 font-bold tracking-[0.12em] uppercase first-letter:uppercase">{dia.format(new Date(`${fecha}T12:00:00Z`)).split(" ").at(-1)}</p>
          <div className="grid grid-cols-2 gap-3.5">
            {[
              [lista.length, "comprobantes leídos"],
              [cuenta(["registrado"]), "registrados solos"],
              [pendientes.length, "por revisar"],
              [cuenta(["soporte"]), "duplicados evitados"],
            ].map(([n, t]) => (
              <div key={t}>
                <b className="text-[26px]">{n}</b>
                <div className="text-[13px] text-tenue">{t}</div>
              </div>
            ))}
          </div>
        </Tarjeta>

        {pendientes.length > 0 && (
          <Tarjeta titulo="Por revisar">
            {pendientes.slice(0, 5).map((r) => (
              <FilaLista
                key={r.id}
                icono={iconoCategoria(r.datos.categoria ?? r.datos.comercio)}
                titulo={r.datos.comercio || r.nombre_archivo || "Comprobante"}
                detalle={r.pregunta ?? undefined}
                valor={r.datos.total ? formatearCOP(r.datos.total) : undefined}
              />
            ))}
          </Tarjeta>
        )}

        <Tarjeta titulo="Reglas que aprendí" subtitulo="Así categorizo sin preguntarte">
          {reglas?.length ? (
            reglas.map((r) => (
              <div key={r.id} className="flex min-h-12 items-center gap-2.5 border-b border-divisor last:border-b-0">
                <span className="min-w-0 flex-1 text-sm">
                  <b className="first-letter:uppercase">{r.patron}</b> → {r.categories?.nombre}
                </span>
                {ctx.puedeEditar && (
                  <form action={cambiarRegla}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="activa" value={r.activa ? "0" : "1"} />
                    <button
                      type="submit"
                      role="switch"
                      aria-checked={r.activa}
                      aria-label={`Regla ${r.patron}`}
                      className={cx("relative h-[26px] w-11 rounded-full border transition", r.activa ? "border-monte bg-monte" : "border-control bg-pista")}
                    >
                      <span className={cx("absolute top-0.5 size-5 rounded-full bg-white transition-all", r.activa ? "left-5" : "left-0.5 shadow-[0_0_0_1px_var(--color-control)]")} />
                    </button>
                  </form>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-tenue">
              Cuando me digas en qué categoría va un comercio, lo recuerdo. También aprendo de las{" "}
              <Link href="/movimientos?categoria=sin" className="font-semibold text-tinta underline">
                categorías que asignas
              </Link>
              .
            </p>
          )}
        </Tarjeta>
      </aside>
    </div>
  );
}
