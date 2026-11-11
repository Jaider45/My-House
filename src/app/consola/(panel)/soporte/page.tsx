import type { Metadata } from "next";
import Link from "next/link";
import { AreaTexto, Aviso, Campo, Chip, Tarjeta, Titulo, cx, type Tono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { FormularioEstado } from "@/components/ui/formulario-estado";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { TarjetaTabla } from "../tarjeta-tabla";
import { guardarRespuestaGuardada } from "./acciones";

export const metadata: Metadata = { title: "Soporte" };

type FilaTicket = {
  id: string;
  numero: number;
  asunto: string;
  categoria: string;
  prioridad: string;
  estado: string;
  escalado: boolean;
  sla_vence: string;
  primera_respuesta: string | null;
  ultimo_mensaje: string;
  creado_nombre: string;
  hogar: string | null;
  plan: string | null;
  asignado: string | null;
};
type Datos = {
  tickets: FilaTicket[];
  conteos: { abiertos: number; urgentes: number; vencidos: number; mios: number; resueltos_7d: number };
  respuestas: { id: string; titulo: string; cuerpo: string }[];
};

const PRIORIDAD: Record<string, Tono> = { urgente: "error", alta: "alerta", normal: "neutro", baja: "neutro" };
const ESTADO: Record<string, { texto: string; tono: Tono }> = {
  abierto: { texto: "Abierto", tono: "alerta" },
  esperando_cliente: { texto: "Esperando al cliente", tono: "info" },
  resuelto: { texto: "Resuelto", tono: "ok" },
};
const FILTROS = [
  { valor: "pendientes", texto: "Pendientes" },
  { valor: "abierto", texto: "Abiertos" },
  { valor: "esperando_cliente", texto: "Esperando al cliente" },
  { valor: "resuelto", texto: "Resueltos" },
];

/** «Vence en 3 h», «Venció hace 2 h» o «Respondido» (plazo de primera respuesta). */
function sla(t: FilaTicket) {
  if (t.primera_respuesta || t.estado === "resuelto") return { texto: "Respondido", tono: "ok" as Tono };
  const horas = Math.round((new Date(t.sla_vence).getTime() - Date.now()) / 3_600_000);
  return horas >= 0 ? { texto: `Vence en ${horas} h`, tono: (horas <= 2 ? "alerta" : "neutro") as Tono } : { texto: `Venció hace ${-horas} h`, tono: "error" as Tono };
}

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: number; detalle: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-elevada p-4 md:p-5">
      <p className="text-[13px] font-semibold text-cuerpo">{etiqueta}</p>
      <p className="mt-1 text-[26px] leading-8 font-bold">{valor.toLocaleString("es-CO")}</p>
      <p className="text-[13px] text-tenue">{detalle}</p>
    </div>
  );
}

export default async function Soporte({ searchParams }: PageProps<"/consola/soporte">) {
  const staff = await obtenerStaff();
  if (!staff.puede("tickets")) {
    return (
      <>
        <Titulo registrar={false}>Soporte</Titulo>
        <Aviso tipo="info">Tu rol no responde tickets.</Aviso>
      </>
    );
  }
  const sp = await searchParams;
  const estado = typeof sp.estado === "string" && FILTROS.some((f) => f.valor === sp.estado) ? sp.estado : "pendientes";
  const mios = sp.asignado === "mios";
  const { data, error } = await staff.supabase.rpc("consola_tickets", { p_estado: estado, p_asignado: mios ? "mios" : "todos" });
  const d = (data ?? { tickets: [], conteos: { abiertos: 0, urgentes: 0, vencidos: 0, mios: 0, resueltos_7d: 0 }, respuestas: [] }) as unknown as Datos;
  const enlace = (e: string, m: boolean) => `/consola/soporte?${new URLSearchParams({ estado: e, ...(m && { asignado: "mios" }) })}`;

  return (
    <>
      <Titulo registrar={false} subtitulo="Lo que escriben los hogares desde «Ayuda», con su plazo de primera respuesta">
        Soporte
      </Titulo>
      {error && <Aviso>{mensajeError(error)}</Aviso>}
      <section className="mb-5 grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
        <Indicador etiqueta="Pendientes" valor={d.conteos.abiertos} detalle={`${d.conteos.mios} asignados a ti`} />
        <Indicador etiqueta="Urgentes" valor={d.conteos.urgentes} detalle="Primera respuesta en 4 h" />
        <Indicador etiqueta="Fuera de plazo" valor={d.conteos.vencidos} detalle="Sin primera respuesta a tiempo" />
        <Indicador etiqueta="Resueltos" valor={d.conteos.resueltos_7d} detalle="Últimos 7 días" />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
        <TarjetaTabla
          titulo="Tickets"
          accion={
            <nav aria-label="Filtro" className="flex flex-wrap gap-1 text-sm">
              {FILTROS.map((f) => (
                <Link key={f.valor} href={enlace(f.valor, mios)} aria-current={f.valor === estado ? "true" : undefined} className={cx("rounded-full border px-3 py-1", f.valor === estado ? "border-monte bg-seleccion font-semibold" : "border-borde")}>
                  {f.texto}
                </Link>
              ))}
              <Link href={enlace(estado, !mios)} aria-current={mios ? "true" : undefined} className={cx("rounded-full border px-3 py-1", mios ? "border-monte bg-seleccion font-semibold" : "border-borde")}>
                Míos
              </Link>
            </nav>
          }
        >
          {d.tickets.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-tenue md:px-6">No hay tickets con este filtro.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Ticket</th>
                  <th>Hogar</th>
                  <th>Prioridad</th>
                  <th>Plazo</th>
                  <th>Estado</th>
                  <th className="pr-4! md:pr-6!">Asignado</th>
                </tr>
              </thead>
              <tbody>
                {d.tickets.map((t) => {
                  const s = sla(t);
                  return (
                    <tr key={t.id}>
                      <td className="pl-4! md:pl-6!">
                        <Link href={`/consola/soporte/${t.id}`} className="flex flex-col leading-[18px] hover:underline">
                          <b>
                            #{t.numero} {t.asunto}
                          </b>
                          <small className="text-xs text-tenue">
                            {t.creado_nombre} · {formatearMomento(t.ultimo_mensaje)}
                          </small>
                        </Link>
                      </td>
                      <td className="text-cuerpo">
                        {t.hogar ?? "—"} {t.plan && <span className="text-tenue">· {t.plan}</span>}
                      </td>
                      <td>
                        <Chip tono={PRIORIDAD[t.prioridad]}>{t.prioridad}</Chip> {t.escalado && <Chip tono="error">Escalado</Chip>}
                      </td>
                      <td>
                        <Chip tono={s.tono}>{s.texto}</Chip>
                      </td>
                      <td>
                        <Chip tono={ESTADO[t.estado].tono}>{ESTADO[t.estado].texto}</Chip>
                      </td>
                      <td className="pr-4! text-cuerpo md:pr-6!">{t.asignado ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </TarjetaTabla>

        <Tarjeta titulo="Respuestas guardadas" subtitulo="Usa {nombre} para el nombre de quien escribió">
          <ul className="mb-3 flex flex-col">
            {d.respuestas.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 border-b border-divisor py-2 text-sm last:border-0">
                <span className="min-w-0 truncate" title={r.cuerpo}>
                  {r.titulo}
                </span>
                <FormularioAccion accion={guardarRespuestaGuardada} className="inline-flex">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="borrar" value="1" />
                  <BotonEnviar variante="fantasma" className="h-8 px-2 text-sm" pendiente="…">
                    Borrar
                  </BotonEnviar>
                </FormularioAccion>
              </li>
            ))}
          </ul>
          <FormularioEstado accion={guardarRespuestaGuardada} className="flex flex-col gap-2">
            <Campo etiqueta="Título" name="titulo" maxLength={80} placeholder="Extracto en PDF muy largo" />
            <AreaTexto etiqueta="Texto" name="cuerpo" rows={3} maxLength={5000} placeholder="Hola {nombre}, …" />
            <BotonEnviar variante="secundario" pendiente="Guardando…" className="self-start">
              Guardar respuesta
            </BotonEnviar>
          </FormularioEstado>
        </Tarjeta>
      </div>
    </>
  );
}
