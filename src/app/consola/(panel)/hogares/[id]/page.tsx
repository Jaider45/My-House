import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AreaTexto, Aviso, Chip, Tarjeta, Titulo, type Tono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { describirAccion } from "@/lib/consola/auditoria";
import { formatearFechaCorta, formatearMomento } from "@/lib/consola/formato";
import { formatearCOP } from "@/lib/dinero";
import { textoLimite, type Limites } from "@/lib/planes";
import { TarjetaTabla } from "../../tarjeta-tabla";
import { ChipPlan, etiquetaPlan, type FilaHogar } from "../comun";
import { agregarNota, cambiarPlanHogar, registrarReembolso, suspenderHogar } from "../acciones";

export const metadata: Metadata = { title: "Hogar" };

type Detalle = {
  hogar: FilaHogar;
  pais: string;
  suspendido_motivo: string | null;
  prueba_hasta: string | null;
  limites: Limites;
  uso: { personas: number; comprobantes_mes: number; almacenamiento_mb: number };
  miembros: { nombre: string; rol: string | null; dependiente: boolean; email: string | null; dos_pasos: boolean; ultimo_ingreso: string | null }[];
  invitaciones: { email: string; rol: string; expira_en: string }[];
  notas: { autor: string; texto: string; creada: string }[];
  historial: { quien: string; accion: string; objeto_nombre: string | null; detalle: unknown; creada: string }[];
};
type Cobro = { id: string; creado: string; referencia: string; plan: string; periodo: string; motivo: string; monto: number; cupon: string | null; estado: string; metodo: string | null; metodo_detalle: string | null; factura_estado: string };
type Cobros = { suscripcion: { plan: string; periodo: string; estado: string; vence: string; monto_periodo: number; cupon: string | null; cancelar_al_vencer: boolean } | null; mrr: number; total: number; cobros: Cobro[] };

const ROL: Record<string, string> = { admin: "Administrador", editor: "Editor", contador: "Contador · lectura" };
const COBRO: Record<string, { texto: string; tono: Tono }> = {
  pagado: { texto: "Pagado", tono: "ok" },
  pendiente: { texto: "Pendiente", tono: "alerta" },
  fallido: { texto: "Fallido", tono: "error" },
  anulado: { texto: "Anulado", tono: "neutro" },
  reembolsado: { texto: "Reembolsado", tono: "info" },
};
const dia = (f: string | null | undefined) => formatearFechaCorta(f ? `${f}T12:00:00-05:00` : null);

function Fila({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border-b border-divisor text-sm last:border-0">
      <span className="text-cuerpo">{k}</span>
      <b className="text-right">{v}</b>
    </div>
  );
}

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-elevada p-4 md:p-5">
      <p className="text-[13px] font-semibold text-cuerpo">{etiqueta}</p>
      <p className="mt-1 text-[26px] leading-8 font-bold">{valor}</p>
      <p className="text-[13px] text-tenue">{detalle}</p>
    </div>
  );
}

export default async function HogarConsola({ params }: PageProps<"/consola/hogares/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const staff = await obtenerStaff();
  const [det, pagos, planes] = await Promise.all([
    staff.supabase.rpc("consola_hogar", { p_id: id }),
    staff.supabase.rpc("consola_hogar_cobros", { p_id: id }),
    staff.supabase.rpc("consola_planes"),
  ]);
  if (det.error?.message.includes("No encontramos")) notFound();
  if (det.error || !det.data) return <Aviso>{mensajeError(det.error)}</Aviso>;
  const d = det.data as unknown as Detalle;
  const c = (pagos.data ?? { suscripcion: null, mrr: 0, total: 0, cobros: [] }) as unknown as Cobros;
  const h = d.hogar;
  const s = c.suscripcion;
  const admin = d.miembros.find((m) => m.rol === "admin");
  const cobros = staff.puede("cobros");

  return (
    <>
      <Titulo registrar={false} subtitulo={`Administrado por ${admin?.nombre ?? "—"}`}>
        {h.nombre}
      </Titulo>
      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/consola/hogares" className="font-semibold">
          ← Hogares
        </Link>
        <ChipPlan plan={h.plan} enPrueba={h.en_prueba} />
        {h.estado === "suspendido" ? <Chip tono="error">Suspendido</Chip> : <Chip tono="ok">Activo</Chip>}
        {s?.estado === "vencida" && <Chip tono="error">Pago pendiente</Chip>}
        <span className="text-cuerpo">
          ID {h.id.slice(0, 8)} · {d.pais === "CO" ? "Colombia" : d.pais} · alta {formatearFechaCorta(h.created_at)}
        </span>
      </div>
      {h.estado === "suspendido" && d.suspendido_motivo && (
        <div className="mb-5">
          <Aviso>Suspendido: {d.suspendido_motivo}</Aviso>
        </div>
      )}

      <section className="mb-5 grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
        <Indicador etiqueta="Movimientos · 30 d" valor={h.movimientos_30d.toLocaleString("es-CO")} detalle="registrados en el hogar" />
        <Indicador etiqueta="Comprobantes con IA" valor={String(d.uso.comprobantes_mes)} detalle={`este mes · de ${textoLimite("comprobantes_mes", d.limites.comprobantes_mes).toLowerCase()}`} />
        <Indicador etiqueta="Personas con acceso" valor={String(d.uso.personas)} detalle={`de ${textoLimite("personas", d.limites.personas)} en el plan`} />
        <Indicador
          etiqueta="Almacenamiento"
          valor={textoLimite("almacenamiento_mb", Math.round(Number(d.uso.almacenamiento_mb)))}
          detalle={`de ${textoLimite("almacenamiento_mb", d.limites.almacenamiento_mb)}`}
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <TarjetaTabla titulo="Miembros" subtitulo={`${d.uso.personas} de ${textoLimite("personas", d.limites.personas)} permitidas en el plan`}>
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Miembro</th>
                  <th>Rol</th>
                  <th>2FA</th>
                  <th className="pr-4! md:pr-6!">Último ingreso</th>
                </tr>
              </thead>
              <tbody>
                {d.miembros.map((m, i) => (
                  <tr key={i}>
                    <td className="pl-4! md:pl-6!">
                      <span className="flex flex-col leading-[18px]">
                        <b>{m.nombre}</b>
                        <small className="text-xs text-tenue">{m.dependiente ? "Persona a cargo · sin acceso" : m.email}</small>
                      </span>
                    </td>
                    <td>{m.rol ? <Chip plano>{ROL[m.rol] ?? m.rol}</Chip> : "—"}</td>
                    <td>{m.dependiente ? "—" : m.dos_pasos ? <Chip tono="ok">Activa</Chip> : <Chip tono="alerta">Sin activar</Chip>}</td>
                    <td className="pr-4! text-cuerpo md:pr-6!">{formatearMomento(m.ultimo_ingreso)}</td>
                  </tr>
                ))}
                {d.invitaciones.map((i) => (
                  <tr key={i.email}>
                    <td className="pl-4! md:pl-6!">
                      <span className="flex flex-col leading-[18px]">
                        <b>{i.email}</b>
                        <small className="text-xs text-tenue">Invitación pendiente · vence {formatearFechaCorta(i.expira_en)}</small>
                      </span>
                    </td>
                    <td>
                      <Chip plano>{ROL[i.rol] ?? i.rol}</Chip>
                    </td>
                    <td>—</td>
                    <td className="pr-4! md:pr-6!">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TarjetaTabla>

          <TarjetaTabla titulo="Cobros" subtitulo={`Wompi · ${formatearCOP(c.total)} pagados en total`}>
            {c.cobros.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-tenue md:px-6">Este hogar no tiene cobros.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="pl-4! md:pl-6!">Fecha</th>
                    <th>Concepto</th>
                    <th className="der">Monto</th>
                    <th>Estado</th>
                    <th>Factura</th>
                    <th className="pr-4! md:pr-6!">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.cobros.map((x) => (
                    <tr key={x.id}>
                      <td className="pl-4! text-cuerpo md:pl-6!">{formatearMomento(x.creado)}</td>
                      <td>
                        <span className="flex flex-col leading-[18px]">
                          <b>
                            {etiquetaPlan(x.plan)} {x.periodo} · {x.motivo === "renovacion" ? "renovación" : "alta"}
                          </b>
                          <small className="text-xs text-tenue">
                            {x.referencia}
                            {x.metodo ? ` · ${[x.metodo, x.metodo_detalle].filter(Boolean).join(" ")}` : ""}
                            {x.cupon ? ` · ${x.cupon}` : ""}
                          </small>
                        </span>
                      </td>
                      <td className="der font-bold">{formatearCOP(x.monto)}</td>
                      <td>
                        <Chip tono={COBRO[x.estado]?.tono}>{COBRO[x.estado]?.texto ?? x.estado}</Chip>
                      </td>
                      <td className="text-cuerpo">{x.estado === "pagado" ? (x.factura_estado === "emitida" ? "Emitida" : x.factura_estado === "no_aplica" ? "No aplica" : "Pendiente") : "—"}</td>
                      <td className="pr-4! md:pr-6!">
                        {cobros && x.estado === "pagado" && x.monto > 0 && (
                          <details className="text-sm">
                            <summary className="cursor-pointer font-semibold">Reembolsar</summary>
                            <FormularioAccion accion={registrarReembolso} className="mt-2 flex w-64 flex-col gap-2">
                              <input type="hidden" name="hogar" value={h.id} />
                              <input type="hidden" name="cobro" value={x.id} />
                              <input name="motivo" required minLength={3} placeholder="Motivo" aria-label="Motivo del reembolso" className="h-9 rounded-lg border border-control px-2" />
                              <label className="flex items-center gap-2">
                                <input type="checkbox" name="bajar" className="accent-monte" /> Pasar a Gratis
                              </label>
                              <BotonEnviar variante="peligro" className="h-9 text-sm" pendiente="…">
                                Registrar reembolso
                              </BotonEnviar>
                            </FormularioAccion>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TarjetaTabla>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Tarjeta titulo="Suscripción">
            {s ? (
              <div className="flex flex-col">
                <Fila k="Plan" v={`${etiquetaPlan(s.plan)} · ${formatearCOP(s.monto_periodo)} / ${s.periodo === "anual" ? "año" : "mes"}`} />
                <Fila k="Estado" v={s.estado === "activa" ? (s.cancelar_al_vencer ? "Termina al vencer" : "Activa") : s.estado === "vencida" ? "En mora" : "Cancelada"} />
                <Fila k={s.estado === "cancelada" ? "Venció" : "Próximo cobro"} v={dia(s.vence)} />
                <Fila k="MRR" v={formatearCOP(c.mrr)} />
                {s.cupon && <Fila k="Cupón" v={s.cupon} />}
              </div>
            ) : (
              <p className="text-sm text-cuerpo">{h.en_prueba ? `En prueba de Familia hasta el ${formatearFechaCorta(d.prueba_hasta)}.` : "Sin suscripción paga."}</p>
            )}
          </Tarjeta>

          {cobros && (
            <Tarjeta titulo="Plan y estado" subtitulo="Queda en el historial y en la auditoría">
              <FormularioAccion accion={cambiarPlanHogar} className="flex flex-col gap-2.5">
                <input type="hidden" name="id" value={h.id} />
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-cuerpo">
                  Cambiar plan (cortesía o corrección)
                  <select name="plan" defaultValue={h.plan} className="h-10 rounded-lg border border-control bg-elevada px-2 text-[15px] font-normal text-tinta">
                    {(planes.data ?? []).map((p: { codigo: string; nombre: string }) => (
                      <option key={p.codigo} value={p.codigo}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <input name="motivo" required minLength={3} placeholder="Motivo" aria-label="Motivo del cambio de plan" className="h-10 rounded-lg border border-control px-3" />
                <BotonEnviar variante="secundario" pendiente="Cambiando…">
                  Cambiar plan
                </BotonEnviar>
              </FormularioAccion>
              <hr className="my-4 border-divisor" />
              <FormularioAccion accion={suspenderHogar} className="flex flex-col gap-2.5">
                <input type="hidden" name="id" value={h.id} />
                <input type="hidden" name="suspender" value={String(h.estado !== "suspendido")} />
                {h.estado !== "suspendido" && (
                  <input name="motivo" required minLength={3} placeholder="Motivo de la suspensión" aria-label="Motivo de la suspensión" className="h-10 rounded-lg border border-control px-3" />
                )}
                <BotonEnviar variante={h.estado === "suspendido" ? "secundario" : "peligro"} pendiente="…">
                  {h.estado === "suspendido" ? "Reactivar hogar" : "Suspender (solo lectura)"}
                </BotonEnviar>
              </FormularioAccion>
            </Tarjeta>
          )}

          <Tarjeta titulo="Datos del hogar">
            <div className="rounded-xl bg-alerta-fondo p-4 text-sm text-alerta-tinta">
              <b className="block text-[15px]">Acceso de soporte no autorizado</b>
              Para ver los datos financieros del hogar hace falta el permiso de su administrador. Llega en la fase S7.
            </div>
          </Tarjeta>

          <Tarjeta titulo="Historial y notas">
            <ul className="flex flex-col">
              {d.notas.map((n, i) => (
                <li key={`n${i}`} className="border-b border-divisor py-2.5 text-sm last:border-0">
                  <span className="text-xs text-tenue">
                    Nota de {n.autor} · {formatearMomento(n.creada)}
                  </span>
                  <p className="whitespace-pre-line">{n.texto}</p>
                </li>
              ))}
              {d.historial.map((a, i) => (
                <li key={`h${i}`} className="flex gap-3 border-b border-divisor py-2.5 text-sm last:border-0">
                  <span aria-hidden className="mt-[5px] size-2.5 shrink-0 rounded-full bg-teja" />
                  <span>
                    <b>{a.quien}</b> · {describirAccion(a)}
                  </span>
                  <span className="ml-auto pl-2 text-xs whitespace-nowrap text-tenue">{formatearMomento(a.creada)}</span>
                </li>
              ))}
              <li className="flex gap-3 py-2.5 text-sm">
                <span aria-hidden className="mt-[5px] size-2.5 shrink-0 rounded-full bg-ok" />
                <span>Se registró y creó el hogar</span>
                <span className="ml-auto pl-2 text-xs whitespace-nowrap text-tenue">{formatearMomento(h.created_at)}</span>
              </li>
            </ul>
            <FormularioAccion accion={agregarNota} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="id" value={h.id} />
              <AreaTexto etiqueta="Nota interna" name="texto" required maxLength={2000} placeholder="Escribe una nota para el equipo" />
              <BotonEnviar variante="secundario" pendiente="Guardando…">
                Guardar nota
              </BotonEnviar>
            </FormularioAccion>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
