import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Chip, Titulo, clasesBoton, cx, type Tono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { Icono } from "@/components/marca";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { AUTOMATICOS } from "@/lib/correo/automaticos";
import { TarjetaTabla } from "../tarjeta-tabla";
import { cancelarCampana } from "./acciones";
import { InterruptorAutomatico, VentanasSegmentos, type SegmentoPropio } from "./segmentos-formulario";
import { CONDICIONES_SEGMENTO, SEGMENTOS, type Segmentos } from "./segmentos";

export const metadata: Metadata = { title: "Correos y campañas" };

const ESTADO_CAMPANA: Record<string, { texto: string; tono: Tono }> = {
  borrador: { texto: "Borrador", tono: "info" },
  programada: { texto: "Programada", tono: "alerta" },
  enviando: { texto: "Enviando…", tono: "info" },
  enviada: { texto: "Enviada", tono: "ok" },
  cancelada: { texto: "Cancelada", tono: "neutro" },
};

const PESTANAS = [
  ["campanas", "Campañas"],
  ["automaticos", "Correos automáticos"],
  ["segmentos", "Segmentos"],
] as const;

const pct = (parte: number, total: number) => (total ? `${Math.round((100 * parte) / total)} %` : "—");
type Variante = { n: number; abiertos: number; clics: number };

function Kpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-elevada p-4 md:p-5">
      <p className="text-[13px] font-semibold text-cuerpo">{etiqueta}</p>
      <p className="mt-1 text-[26px] leading-8 font-bold">{valor}</p>
      <p className="text-[13px] text-tenue">{detalle}</p>
    </div>
  );
}

export default async function ComunicacionesConsola({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const staff = await obtenerStaff();
  const puede = staff.puede("campanas");
  const pedida = (await searchParams).tab;
  const tab = PESTANAS.find(([k]) => k === pedida)?.[0] ?? "campanas";
  const [resumen, correos, campanas, fijos, propios, { data: apagados }] = await Promise.all([
    staff.supabase.rpc("consola_comunicaciones"),
    staff.supabase.rpc("consola_correos_resumen"),
    puede ? staff.supabase.rpc("consola_campanas") : Promise.resolve({ data: [], error: null }),
    puede ? staff.supabase.rpc("consola_segmentos") : Promise.resolve({ data: {}, error: null }),
    puede ? staff.supabase.rpc("consola_segmentos_todos") : Promise.resolve({ data: { propios: [] }, error: null }),
    staff.supabase.from("plataforma_config").select("valor").eq("clave", "correos_apagados").maybeSingle(),
  ]);
  const r = (resumen.data ?? {}) as { kpis?: { enviados: number; entregados: number; abiertos: number; clics: number }; bajas_30d?: number; campanas?: Record<string, { a: Variante; b: Variante }> };
  const k = r.kpis ?? { enviados: 0, entregados: 0, abiertos: 0, clics: 0 };
  const porEtiqueta = new Map((correos.data ?? []).map((c) => [c.etiqueta, c]));
  const apagadosSet = new Set((apagados?.valor as string[] | null) ?? []);
  const conteo = (fijos.data ?? {}) as Segmentos;
  const listaPropios = ((propios.data as { propios?: SegmentoPropio[] } | null)?.propios ?? []) as SegmentoPropio[];
  const nombrePropio = new Map(listaPropios.map((s) => [s.id, s.nombre]));

  return (
    <>
      <Titulo
        registrar={false}
        subtitulo="Lo que My House envía por correo, y a quién"
        accion={
          puede ? (
            <Link href="/consola/comunicaciones/editor" className={clasesBoton("primario")}>
              Nueva campaña
            </Link>
          ) : undefined
        }
      >
        Correos y campañas
      </Titulo>
      {resumen.error && <Aviso>No se pudieron cargar las métricas: {resumen.error.message}</Aviso>}

      <section className="mb-5 grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
        <Kpi etiqueta="Enviados · 30 días" valor={k.enviados.toLocaleString("es-CO")} detalle="automáticos y campañas" />
        <Kpi etiqueta="Apertura promedio" valor={pct(k.abiertos, k.entregados || k.enviados)} detalle="meta 45 % · según Resend" />
        <Kpi etiqueta="Clics promedio" valor={pct(k.clics, k.abiertos)} detalle="de los que abren" />
        <Kpi etiqueta="Bajas" valor={(r.bajas_30d ?? 0).toLocaleString("es-CO")} detalle="personas que retiraron el permiso · 30 días" />
      </section>

      <nav role="tablist" aria-label="Secciones" className="mb-4 flex gap-1 overflow-x-auto border-b border-divisor">
        {PESTANAS.map(([key, t]) => (
          <Link
            key={key}
            role="tab"
            aria-selected={tab === key}
            href={`/consola/comunicaciones?tab=${key}`}
            className={cx("h-10 shrink-0 border-b-2 px-3 pt-2 text-sm font-semibold", tab === key ? "border-monte text-tinta" : "border-transparent text-cuerpo hover:text-tinta")}
          >
            {t}
          </Link>
        ))}
      </nav>

      {tab === "campanas" &&
        (puede ? (
          <TarjetaTabla titulo="Campañas" subtitulo="Se envían una vez a un segmento · solo a quienes aceptaron novedades (los avisos legales van a todos)">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Campaña</th>
                  <th>Estado</th>
                  <th className="der">Audiencia</th>
                  <th className="der">Apertura</th>
                  <th className="der">Clics</th>
                  <th className="pr-4! md:pr-6!">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(campanas.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="pl-4! text-tenue md:pl-6!">
                      Aún no hay campañas.
                    </td>
                  </tr>
                )}
                {(campanas.data ?? []).map((c) => {
                  const e = ESTADO_CAMPANA[c.estado] ?? { texto: c.estado, tono: "neutro" as Tono };
                  const res = r.campanas?.[c.id];
                  const n = (res?.a.n ?? 0) + (res?.b.n ?? 0);
                  const ab = (res?.a.abiertos ?? 0) + (res?.b.abiertos ?? 0);
                  const cl = (res?.a.clics ?? 0) + (res?.b.clics ?? 0);
                  const editable = ["borrador", "programada", "cancelada"].includes(c.estado) && !c.transaccional;
                  const audiencia = c.segmento === "propio" ? (nombrePropio.get(c.segmento_propio ?? "") ?? "Segmento propio") : SEGMENTOS.find((s) => s.valor === c.segmento)?.texto;
                  return (
                    <tr key={c.id}>
                      <td className="pl-4! md:pl-6!">
                        <span className="flex items-center gap-3">
                          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-mosaico">
                            <Icono nombre={c.transaccional ? "certificados" : "servicios"} tamano={18} />
                          </span>
                          <span className="flex flex-col whitespace-normal">
                            <b>{c.nombre}</b>
                            <small className="text-[13px] text-tenue">
                              {audiencia} · {c.programada_para ? formatearMomento(c.programada_para) : "sin fecha"}
                              {c.asunto_b ? ` · A/B ${c.prueba_ab_pct} %` : ""}
                            </small>
                          </span>
                        </span>
                      </td>
                      <td>
                        <Chip tono={e.tono}>{e.texto}</Chip>
                      </td>
                      <td className="der">{c.alcance ? `${c.alcance.toLocaleString("es-CO")} hogares` : "—"}</td>
                      <td className="der" title={res && c.asunto_b ? `A: ${pct(res.a.abiertos, res.a.n)} · B: ${pct(res.b.abiertos, res.b.n)}` : undefined}>
                        {n ? pct(ab, n) : "—"}
                        {res && c.asunto_b && res.b.n > 0 && (
                          <small className="block text-[12px] text-tenue">
                            A {pct(res.a.abiertos, res.a.n)} · B {pct(res.b.abiertos, res.b.n)}
                          </small>
                        )}
                      </td>
                      <td className="der">{n ? pct(cl, ab) : "—"}</td>
                      <td className="pr-4! md:pr-6!">
                        <span className="flex justify-end gap-1">
                          {editable && (
                            <Link href={`/consola/comunicaciones/editor?id=${c.id}`} className={clasesBoton("fantasma", "h-8 px-3 text-sm")}>
                              {c.estado === "borrador" ? "Seguir editando" : "Editar"}
                            </Link>
                          )}
                          {c.estado === "programada" && (
                            <FormularioAccion accion={cancelarCampana} className="inline-flex">
                              <input type="hidden" name="id" value={c.id} />
                              <BotonEnviar variante="fantasma" className="h-8 px-3 text-sm" pendiente="…">
                                Cancelar
                              </BotonEnviar>
                            </FormularioAccion>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TarjetaTabla>
        ) : (
          <Aviso tipo="info">Las campañas son del rol Contenido o un superadmin.</Aviso>
        ))}

      {tab === "automaticos" && (
        <TarjetaTabla titulo="Correos automáticos" subtitulo={`Se envían solos cuando pasa algo en la app · ${AUTOMATICOS.length} plantillas`}>
          <table className="tabla">
            <thead>
              <tr>
                <th className="pl-4! md:pl-6!">Correo automático</th>
                <th>Se envía</th>
                <th className="der">Enviados · 30 d</th>
                <th className="der">Apertura</th>
                <th>Estado</th>
                <th className="pr-4! md:pr-6!">
                  <span className="sr-only">Ver</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {AUTOMATICOS.map((a) => {
                const filas = a.etiquetas.map((e) => porEtiqueta.get(e)).filter((x) => !!x);
                const enviados = filas.reduce((s, f) => s + f!.enviados, 0);
                const abiertos = filas.reduce((s, f) => s + f!.abiertos, 0);
                const entregados = filas.reduce((s, f) => s + f!.entregados, 0);
                const activo = !apagadosSet.has(a.clave);
                return (
                  <tr key={a.clave}>
                    <td className="pl-4! font-semibold md:pl-6!">{a.nombre}</td>
                    <td className="text-cuerpo whitespace-normal!">{a.cuando}</td>
                    <td className="der">{a.envia === "supabase" ? <span className="text-tenue">Supabase</span> : enviados.toLocaleString("es-CO")}</td>
                    <td className="der">{a.envia === "supabase" ? "—" : pct(abiertos, entregados || enviados)}</td>
                    <td>{a.apagable && puede ? <InterruptorAutomatico clave={a.clave} activo={activo} /> : <Chip tono={activo ? "ok" : "neutro"}>{activo ? "Activo" : "Apagado"}</Chip>}</td>
                    <td className="pr-4! md:pr-6!">
                      <Link href={`/consola/comunicaciones/correo/${a.etiquetas[0] ?? a.muestra}`} className={clasesBoton("fantasma", "h-8 px-3 text-sm")}>
                        {a.envia === "app" && a.clave !== "legal" ? "Editar" : "Ver"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TarjetaTabla>
      )}

      {tab === "segmentos" &&
        (puede ? (
          <TarjetaTabla
            titulo="Segmentos"
            subtitulo="Grupos de hogares para tus campañas"
            accion={
              <Link href="?tab=segmentos&nuevo=segmento" scroll={false} className={clasesBoton("secundario", "h-9 px-3 text-sm")}>
                Nuevo segmento
              </Link>
            }
          >
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Segmento</th>
                  <th>Regla</th>
                  <th className="der">Hogares</th>
                  <th className="der">Con permiso</th>
                  <th className="pr-4! md:pr-6!">
                    <span className="sr-only">Editar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {listaPropios.map((s) => (
                  <tr key={s.id}>
                    <td className="pl-4! font-semibold md:pl-6!">{s.nombre}</td>
                    <td className="text-cuerpo whitespace-normal!">
                      {[
                        s.plan === "todos" ? null : `Plan ${s.plan}`,
                        s.actividad === "activos" ? "registró algo en 30 días" : s.actividad === "inactivos" ? "sin movimientos en 30 días" : null,
                        ...s.condiciones.map((c) => CONDICIONES_SEGMENTO.find(([k]) => k === c)?.[1].toLowerCase()),
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Todos los hogares"}
                    </td>
                    <td className="der">{s.hogares.toLocaleString("es-CO")}</td>
                    <td className="der">{s.con_permiso.toLocaleString("es-CO")}</td>
                    <td className="pr-4! md:pr-6!">
                      <Link href={`?tab=segmentos&nuevo=segmento-${s.id}`} scroll={false} className={clasesBoton("fantasma", "h-8 px-3 text-sm")}>
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
                {SEGMENTOS.map((s) => (
                  <tr key={s.valor}>
                    <td className="pl-4! font-semibold md:pl-6!">{s.texto}</td>
                    <td className="text-tenue">Fijo</td>
                    <td className="der">{(conteo[s.valor]?.hogares ?? 0).toLocaleString("es-CO")}</td>
                    <td className="der">{(conteo[s.valor]?.con_permiso ?? 0).toLocaleString("es-CO")}</td>
                    <td className="pr-4! md:pr-6!" />
                  </tr>
                ))}
              </tbody>
            </table>
          </TarjetaTabla>
        ) : (
          <Aviso tipo="info">Los segmentos son del rol Contenido o un superadmin.</Aviso>
        ))}

      {puede && <VentanasSegmentos segmentos={listaPropios} />}
    </>
  );
}
