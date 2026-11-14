import type { Metadata } from "next";
import { Aviso, Campo, Chip, Tarjeta, Titulo, clasesBoton, cx } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioEstado } from "@/components/ui/formulario-estado";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { TarjetaTabla } from "../tarjeta-tabla";
import { guardarFuncion } from "./acciones";

export const metadata: Metadata = { title: "Sistema" };

type Funcion = { clave: string; descripcion: string | null; activa: boolean; planes: string[]; porcentaje: number; solo_equipo: boolean; updated_at: string; hogares: number };
type Sistema = {
  colas: Record<string, number>;
  correos_24h: { enviados: number; rebotes: number; ultimo: string | null };
  errores_24h: { tipo: string; n: number }[];
  ia_ultima: string | null;
  base: { version: string; migracion: string | null };
};

const COLAS: Record<string, string> = {
  comprobantes_por_revisar: "Comprobantes por revisar (hogares)",
  comprobantes_con_error_24h: "Comprobantes con error · 24 h",
  campanas_pendientes: "Campañas por enviar",
  cobros_pendientes: "Cobros esperando pago",
  tickets_abiertos: "Tickets abiertos",
  solicitudes_1581: "Solicitudes Ley 1581 abiertas",
};

function Fila({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border-b border-divisor text-sm last:border-0">
      <span className="text-cuerpo">{k}</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
}

/** Formulario de una función (o el vacío para crear una). */
function EditorFuncion({ f, planes }: { f?: Funcion; planes: { codigo: string; nombre: string }[] }) {
  return (
    <FormularioEstado accion={guardarFuncion} className="flex flex-col gap-3">
      {f ? <input type="hidden" name="clave" value={f.clave} /> : <Campo etiqueta="Clave" name="clave" required placeholder="pronostico_gastos" maxLength={41} />}
      <Campo etiqueta="Descripción" name="descripcion" defaultValue={f?.descripcion ?? ""} maxLength={200} placeholder="Qué hace y quién la pidió" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="activa" defaultChecked={f?.activa} className="size-4 accent-monte" />
          Encendida
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="solo_equipo" defaultChecked={f?.solo_equipo} className="size-4 accent-monte" />
          Solo el equipo
        </label>
        <label className="inline-flex items-center gap-2">
          Hogares
          <input name="porcentaje" type="number" min={0} max={100} defaultValue={f?.porcentaje ?? 10} className="h-9 w-20 rounded-lg border border-control bg-elevada px-2 text-right" />%
        </label>
      </div>
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <legend className="mb-1 text-[13px] font-semibold text-cuerpo">Planes (ninguno marcado = todos)</legend>
        {planes.map((p) => (
          <label key={p.codigo} className="inline-flex items-center gap-2">
            <input type="checkbox" name="planes" value={p.codigo} defaultChecked={f?.planes.includes(p.codigo)} className="size-4 accent-monte" />
            {p.nombre}
          </label>
        ))}
      </fieldset>
      <BotonEnviar variante="secundario" className="self-start" pendiente="Guardando…">
        {f ? "Guardar" : "Crear función"}
      </BotonEnviar>
    </FormularioEstado>
  );
}

type Salud = {
  componentes: Record<string, { ultimo: { ok: boolean; creado: string } | null; disponibilidad: number | null; latencia: number | null; dias: ("ok" | "w" | "e" | "sin")[] }>;
  errores_1h: number;
};

const SERVICIOS: [string, string][] = [
  ["app", "App web"],
  ["base", "Base de datos"],
  ["auth", "Inicio de sesión"],
  ["archivos", "Archivos y soportes"],
  ["ia", "Lectura con IA"],
  ["correo", "Correo"],
  ["pagos", "Pasarela de pagos"],
];

/** Diseño «Estado de los servicios»: estado actual, disponibilidad y latencia de los chequeos de /api/salud. */
function EstadoServicios({ salud }: { salud: Salud }) {
  const caidos = SERVICIOS.filter(([k]) => salud.componentes[k]?.ultimo && !salud.componentes[k].ultimo!.ok);
  const sinDatos = SERVICIOS.every(([k]) => !salud.componentes[k]);
  return (
    <TarjetaTabla
      titulo="Estado de los servicios"
      subtitulo={
        sinDatos
          ? "Aún sin chequeos: se registran cuando el monitor externo llama a /api/salud/<componente>"
          : caidos.length
            ? `Con problemas: ${caidos.map(([, t]) => t).join(", ")}`
            : "Todos los sistemas operando"
      }
    >
      <table className="tabla">
        <thead>
          <tr>
            <th className="pl-4! md:pl-6!">Servicio</th>
            <th>Estado</th>
            <th className="der">Disponibilidad · 30 d</th>
            <th className="der">Latencia</th>
            <th className="pr-4! md:pr-6!">Últimos 30 días</th>
          </tr>
        </thead>
        <tbody>
          {SERVICIOS.map(([k, t]) => {
            const c = salud.componentes[k];
            return (
              <tr key={k}>
                <td className="pl-4! font-semibold md:pl-6!">{t}</td>
                <td>{!c?.ultimo ? <Chip tono="neutro">Sin datos</Chip> : c.ultimo.ok ? <Chip tono="ok">Operando</Chip> : <Chip tono="error">Falla</Chip>}</td>
                <td className="der">{c?.disponibilidad == null ? "—" : `${Number(c.disponibilidad).toLocaleString("es-CO")} %`}</td>
                <td className="der">{c?.latencia ? (c.latencia >= 1000 ? `${(c.latencia / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} s` : `${c.latencia} ms`) : "—"}</td>
                <td className="pr-4! md:pr-6!">
                  <span aria-hidden className="flex min-w-[240px] gap-[3px]">
                    {(c?.dias ?? Array<"sin">(30).fill("sin")).map((d, i) => (
                      <i key={i} className={cx("h-6 flex-1 rounded-sm", d === "ok" ? "bg-ok" : d === "w" ? "bg-alerta" : d === "e" ? "bg-error" : "bg-mosaico")} />
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-4 pt-2 text-[13px] text-tenue md:px-6">Errores registrados en la última hora: {salud.errores_1h.toLocaleString("es-CO")}.</p>
    </TarjetaTabla>
  );
}

export default async function SistemaConsola() {
  const staff = await obtenerStaff();
  if (!staff.puede("sistema")) {
    return (
      <>
        <Titulo registrar={false}>Sistema</Titulo>
        <Aviso tipo="info">Feature flags y mantenimiento son del superadmin.</Aviso>
      </>
    );
  }
  const [{ data: funciones, error }, { data: sistema }, { data: planes }, { data: integraciones }, { data: salud }] = await Promise.all([
    staff.supabase.rpc("consola_funciones"),
    staff.supabase.rpc("consola_sistema"),
    staff.supabase.from("planes").select("codigo, nombre").order("precio_mensual"),
    staff.supabase.rpc("consola_integraciones"),
    staff.supabase.rpc("consola_salud"),
  ]);
  const sal = (salud ?? { componentes: {}, errores_1h: 0 }) as unknown as Salud;
  const lista = (funciones ?? []) as unknown as Funcion[];
  const s = sistema as unknown as Sistema | null;
  const mantenimiento = process.env.MANTENIMIENTO === "1";
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const enlaces = [
    { texto: "Errores (Sentry)", url: process.env.SENTRY_URL },
    { texto: "Página de estado", url: process.env.ESTADO_URL },
    { texto: "Respaldos (Supabase)", url: process.env.SUPABASE_PANEL_URL },
  ];

  return (
    <>
      <Titulo
        registrar={false}
        subtitulo="Servicios, funciones y operación"
        accion={
          process.env.ESTADO_URL ? (
            <a href={process.env.ESTADO_URL} target="_blank" rel="noreferrer" className={clasesBoton("secundario")}>
              Página de estado pública
            </a>
          ) : undefined
        }
      >
        Estado del sistema
      </Titulo>
      {error && <Aviso>{mensajeError(error)}</Aviso>}
      {mantenimiento && (
        <div className="mb-5">
          <Aviso>Modo mantenimiento ENCENDIDO: los hogares ven la página de mantenimiento (la consola y los pagos siguen).</Aviso>
        </div>
      )}

      <div className="mb-5">
        <EstadoServicios salud={sal} />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <TarjetaTabla titulo="Funciones (feature flags)" subtitulo="El mismo hogar cae siempre en el mismo grupo: subir de 10 % a 20 % suma hogares sin quitar a nadie">
            {lista.length === 0 ? (
              <p className="px-4 pb-3 text-sm text-tenue md:px-6">Aún no hay funciones. Créalas aquí y el código las consulta con funcionActiva(clave).</p>
            ) : (
              <ul className="flex flex-col divide-y divide-divisor">
                {lista.map((f) => (
                  <li key={f.clave} className="px-4 py-3 md:px-6">
                    <details>
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                        <span className="flex min-w-0 flex-col leading-[18px]">
                          <b className="font-mono text-[14px]">{f.clave}</b>
                          <small className="text-xs text-tenue">{f.descripcion ?? "Sin descripción"} · cambiada {formatearMomento(f.updated_at).toLowerCase()}</small>
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          {!f.activa ? (
                            <Chip plano>Apagada</Chip>
                          ) : f.solo_equipo ? (
                            <Chip tono="info">Solo el equipo</Chip>
                          ) : (
                            <Chip tono="ok">
                              {f.porcentaje} % · {f.hogares.toLocaleString("es-CO")} hogares
                            </Chip>
                          )}
                          {f.planes.length > 0 && <Chip plano>{f.planes.join(", ")}</Chip>}
                        </span>
                      </summary>
                      <div className="mt-3 rounded-xl bg-pagina p-3">
                        <EditorFuncion f={f} planes={planes ?? []} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </TarjetaTabla>
          <Tarjeta titulo="Nueva función" subtitulo="Nace apagada si no la enciendes; el equipo la ve encendida en su propio hogar para probarla">
            <EditorFuncion planes={planes ?? []} />
          </Tarjeta>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Tarjeta titulo="Versión y mantenimiento">
            <Fila k="Versión" v={version ? <span className="font-mono">{version}</span> : "local"} />
            <Fila k="Entorno" v={process.env.VERCEL_ENV ?? process.env.NODE_ENV} />
            <Fila k="Región" v={process.env.VERCEL_REGION ?? "—"} />
            <Fila k="Base de datos" v={s ? `Postgres ${s.base.version.split(" ")[0]}` : "—"} />
            <Fila k="Última migración" v={<span className="font-mono">{s?.base.migracion ?? "—"}</span>} />
            <Fila k="Mantenimiento" v={mantenimiento ? <Chip tono="error">Encendido</Chip> : <Chip tono="ok">Apagado</Chip>} />
            <p className="mt-2 text-[13px] text-tenue">
              El modo mantenimiento se enciende con la variable de entorno MANTENIMIENTO=1 en Vercel (y un nuevo despliegue o reinicio): así
              funciona aunque la base no responda.
            </p>
          </Tarjeta>

          <Tarjeta titulo="Colas y actividad">
            {s &&
              Object.entries(COLAS).map(([k, texto]) => (
                <Fila key={k} k={texto} v={(s.colas[k] ?? 0).toLocaleString("es-CO")} />
              ))}
            {s && <Fila k="Correos · 24 h" v={`${s.correos_24h.enviados} enviados · ${s.correos_24h.rebotes} rebotes`} />}
            {s && <Fila k="Último correo" v={formatearMomento(s.correos_24h.ultimo)} />}
            {s && <Fila k="Última lectura con IA" v={formatearMomento(s.ia_ultima)} />}
            {s && s.errores_24h.length > 0 && <Fila k="Errores de hogares · 24 h" v={s.errores_24h.map((e) => `${e.tipo}: ${e.n}`).join(" · ")} />}
          </Tarjeta>

          <Tarjeta titulo="Servicios">
            {(integraciones ?? []).map((i) => {
              const v = i.verificacion as { ok?: boolean } | null;
              return (
                <Fila
                  key={i.proveedor}
                  k={i.proveedor}
                  v={!i.activa ? <Chip plano>No conectado</Chip> : v?.ok === false ? <Chip tono="error">Fallando</Chip> : <Chip tono="ok">Conectado</Chip>}
                />
              );
            })}
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {enlaces.map((e) =>
                e.url ? (
                  <a key={e.texto} href={e.url} target="_blank" rel="noreferrer" className="font-semibold underline">
                    {e.texto}
                  </a>
                ) : (
                  <span key={e.texto} className="text-tenue" title="Configura la variable de entorno para enlazarlo">
                    {e.texto}: sin configurar
                  </span>
                ),
              )}
            </div>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
