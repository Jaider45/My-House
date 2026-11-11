import type { Metadata } from "next";
import { Aviso, Campo, Chip, Tarjeta, Titulo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { agruparCalendario, calendarioATexto, type FechaCalendario } from "@/lib/consola/calendario";
import { formatearCOP } from "@/lib/dinero";
import { formatearFechaLarga, hoy } from "@/lib/fechas";
import { TarjetaTabla } from "../tarjeta-tabla";
import { FormularioConsola } from "../formulario";
import { EditorCalendario } from "./calendario";
import { guardarEtiqueta, guardarParametros, publicarParametros } from "./acciones";

export const metadata: Metadata = { title: "Parámetros DIAN" };

type Valores = { uvt_valor: number; topes: Record<string, number>; deducciones: Record<string, number>; fuente: string | null };
type Anio = Valores & { anio: number; publicado: boolean; publicado_en: string | null; borrador: Valores | null; updated_at: string };
type Datos = {
  anios: Anio[];
  etiquetas: { codigo: string; nombre: string; renglon: string | null }[];
  calendario: { anio: number; fechas: FechaCalendario[] }[];
  personas_con_digitos: number;
};

/** Topes para declarar (personas naturales, Colombia), en UVT. Mismas claves que `src/lib/impuestos/co`. */
const TOPES = [
  { clave: "ingresos_brutos", nombre: "Ingresos brutos" },
  { clave: "patrimonio_bruto", nombre: "Patrimonio bruto" },
  { clave: "consumos_tarjeta", nombre: "Consumos con tarjeta" },
  { clave: "compras_consumos", nombre: "Compras y consumos" },
  { clave: "consignaciones", nombre: "Consignaciones" },
];
const DEDUCCIONES = [
  { clave: "dependientes_pct", nombre: "Dependientes: % de rentas de trabajo" },
  { clave: "dependientes_tope_anual", nombre: "Dependientes: tope anual (UVT)" },
  { clave: "dependiente_adicional", nombre: "Adicional por dependiente (UVT)" },
  { clave: "dependientes_max", nombre: "Máximo de dependientes" },
];

const campoNumero = "h-9 w-full max-w-28 rounded-lg border border-control bg-elevada px-2 text-right text-[15px]";
const campoFila = "h-9 min-w-0 rounded-lg border border-control bg-elevada px-2 text-sm disabled:border-transparent disabled:bg-transparent";

function EstadoAnio({ a }: { a: Anio }) {
  if (!a.publicado) return <Chip tono="alerta">Borrador</Chip>;
  if (a.borrador) return <Chip tono="info">Publicado · con cambios</Chip>;
  return <Chip tono="ok">Publicado</Chip>;
}

/** Lo que cambia el borrador frente a lo publicado. */
function cambios(a: Anio): string[] {
  if (!a.borrador || !a.publicado) return [];
  const b = a.borrador;
  const out: string[] = [];
  if (b.uvt_valor !== a.uvt_valor) out.push(`UVT ${formatearCOP(a.uvt_valor)} → ${formatearCOP(b.uvt_valor)}`);
  for (const t of TOPES) if (b.topes[t.clave] !== a.topes[t.clave]) out.push(`${t.nombre} ${a.topes[t.clave] ?? "—"} → ${b.topes[t.clave] ?? "—"} UVT`);
  for (const t of DEDUCCIONES)
    if (b.deducciones?.[t.clave] !== a.deducciones?.[t.clave]) out.push(`${t.nombre}: ${a.deducciones?.[t.clave] ?? "—"} → ${b.deducciones?.[t.clave] ?? "—"}`);
  if ((b.fuente ?? "") !== (a.fuente ?? "")) out.push("fuente");
  return out;
}

export default async function Parametros() {
  const staff = await obtenerStaff();
  const { data, error } = await staff.supabase.rpc("consola_parametros", { p_pais: "CO" });
  const d = (data ?? { anios: [], etiquetas: [], calendario: [], personas_con_digitos: 0 }) as unknown as Datos;
  const puede = staff.puede("parametros");
  const anioActual = Number(hoy().slice(0, 4));
  const ultimo = d.anios.find((a) => a.publicado);
  const base = d.anios[0]?.borrador ?? d.anios[0];
  const siguiente = d.anios.some((a) => a.anio === anioActual + 1) ? anioActual : anioActual + 1;
  const textos = Object.fromEntries(d.calendario.map((c) => [c.anio, calendarioATexto(c.fechas)]));
  const vigente = d.calendario.find((c) => c.anio === anioActual - 1);
  const grupos = vigente ? agruparCalendario(vigente.fechas) : [];

  return (
    <>
      <Titulo registrar={false} subtitulo="UVT, topes, calendario de vencimientos y etiquetas: lo que usa el semáforo de renta de cada hogar">
        Parámetros DIAN
      </Titulo>
      {error && <Aviso>{mensajeError(error)}</Aviso>}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Chip tono="info">Colombia</Chip>
        <Chip plano>IRS (Estados Unidos): sin módulo todavía</Chip>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <TarjetaTabla titulo="UVT por año" subtitulo="Un cambio queda en borrador y rige en los hogares solo al publicarlo">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Año</th>
                  <th className="der">UVT</th>
                  <th>Fuente</th>
                  <th>Estado</th>
                  <th className="pr-4! md:pr-6!">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.anios.map((a) => (
                  <tr key={a.anio}>
                    <td className="pl-4! font-bold md:pl-6!">{a.anio}</td>
                    <td className="der">{formatearCOP(a.publicado ? a.uvt_valor : (a.borrador?.uvt_valor ?? a.uvt_valor))}</td>
                    <td className="whitespace-normal! text-cuerpo">
                      <span className="flex flex-col leading-[18px]">
                        {(a.publicado ? a.fuente : a.borrador?.fuente) ?? "—"}
                        {a.publicado_en && <small className="text-xs text-tenue">Publicado {formatearMomento(a.publicado_en)}</small>}
                        {cambios(a).length > 0 && <small className="text-xs text-alerta-tinta">Por publicar: {cambios(a).join(" · ")}</small>}
                      </span>
                    </td>
                    <td>
                      <EstadoAnio a={a} />
                    </td>
                    <td className="pr-4! md:pr-6!">
                      {puede && a.borrador && (
                        <span className="inline-flex gap-1">
                          <FormularioAccion accion={publicarParametros} className="inline-flex">
                            <input type="hidden" name="anio" value={a.anio} />
                            <BotonEnviar className="h-8 px-3 text-sm" pendiente="Publicando…">
                              Publicar
                            </BotonEnviar>
                          </FormularioAccion>
                          <FormularioAccion accion={publicarParametros} className="inline-flex">
                            <input type="hidden" name="anio" value={a.anio} />
                            <input type="hidden" name="accion" value="descartar" />
                            <BotonEnviar variante="fantasma" className="h-8 px-2 text-sm" pendiente="…">
                              Descartar
                            </BotonEnviar>
                          </FormularioAccion>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TarjetaTabla>

          {ultimo && (
            <TarjetaTabla titulo={`Topes ${ultimo.anio} en pesos`} subtitulo="Se guardan en UVT; los pesos salen de multiplicar por la UVT del año">
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="pl-4! md:pl-6!">Tope</th>
                    <th className="der">UVT</th>
                    <th className="der pr-4! md:pr-6!">Pesos</th>
                  </tr>
                </thead>
                <tbody>
                  {TOPES.map((t) => (
                    <tr key={t.clave}>
                      <td className="pl-4! md:pl-6!">{t.nombre}</td>
                      <td className="der">{(ultimo.topes[t.clave] ?? 0).toLocaleString("es-CO")}</td>
                      <td className="der pr-4! font-semibold md:pr-6!">{formatearCOP(Math.round((ultimo.topes[t.clave] ?? 0) * ultimo.uvt_valor))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TarjetaTabla>
          )}

          <TarjetaTabla titulo="Etiquetas DIAN" subtitulo="Las que el hogar pone a sus movimientos; el renglón se llena al validarlo contra el formulario 210">
            <ul className="flex flex-col px-4 md:px-6">
              {[...d.etiquetas, ...(puede ? [{ codigo: "", nombre: "", renglon: null }] : [])].map((e) => (
                <li key={e.codigo || "nueva"} className="border-b border-divisor py-2 last:border-0">
                  <FormularioAccion accion={guardarEtiqueta} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_72px_auto] items-center gap-2">
                    <input
                      name="codigo"
                      defaultValue={e.codigo}
                      readOnly={!!e.codigo}
                      placeholder="codigo_nuevo"
                      aria-label="Código"
                      className="h-9 min-w-0 rounded-lg border border-control bg-elevada px-2 font-mono text-[13px] read-only:border-transparent read-only:bg-transparent"
                    />
                    <input name="nombre" defaultValue={e.nombre} disabled={!puede} placeholder="Nombre de la etiqueta" aria-label="Nombre" className={campoFila} />
                    <input name="renglon" defaultValue={e.renglon ?? ""} disabled={!puede} placeholder="—" aria-label="Renglón del formulario" className={campoFila} />
                    {puede ? (
                      <BotonEnviar variante={e.codigo ? "fantasma" : "secundario"} className="h-9 px-3 text-sm" pendiente="…">
                        {e.codigo ? "Guardar" : "Agregar"}
                      </BotonEnviar>
                    ) : (
                      <span />
                    )}
                  </FormularioAccion>
                </li>
              ))}
            </ul>
          </TarjetaTabla>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {puede && base && (
            <Tarjeta titulo="Cargar o editar un año" subtitulo="La DIAN publica la UVT del año siguiente en noviembre o diciembre">
              <FormularioConsola accion={guardarParametros} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta="Año" name="anio" type="number" min={2020} max={2100} defaultValue={siguiente} required />
                  <Campo etiqueta="UVT ($)" name="uvt" inputMode="numeric" placeholder={String(base.uvt_valor)} required />
                </div>
                <Campo etiqueta="Fuente" name="fuente" placeholder="Resolución DIAN 000xxx de 2026" maxLength={200} />
                <fieldset className="flex flex-col">
                  <legend className="mb-1 text-[13px] font-semibold text-cuerpo">Topes para declarar (UVT)</legend>
                  {TOPES.map((t) => (
                    <label key={t.clave} className="flex min-h-10 items-center justify-between gap-3 border-b border-divisor text-sm last:border-0">
                      <span className="text-cuerpo">{t.nombre}</span>
                      <input name={`tope_${t.clave}`} inputMode="decimal" defaultValue={base.topes[t.clave] ?? ""} className={campoNumero} />
                    </label>
                  ))}
                </fieldset>
                <fieldset className="flex flex-col">
                  <legend className="mb-1 text-[13px] font-semibold text-cuerpo">Deducciones</legend>
                  {DEDUCCIONES.map((t) => (
                    <label key={t.clave} className="flex min-h-10 items-center justify-between gap-3 border-b border-divisor text-sm last:border-0">
                      <span className="text-cuerpo">{t.nombre}</span>
                      <input name={`ded_${t.clave}`} inputMode="decimal" defaultValue={base.deducciones?.[t.clave] ?? ""} className={campoNumero} />
                    </label>
                  ))}
                </fieldset>
                <BotonEnviar pendiente="Guardando…" className="self-start">
                  Guardar borrador
                </BotonEnviar>
              </FormularioConsola>
            </Tarjeta>
          )}

          <Tarjeta
            titulo="Calendario de vencimientos"
            subtitulo={`${d.personas_con_digitos} ${d.personas_con_digitos === 1 ? "persona registró" : "personas registraron"} los dígitos de su cédula: reciben aviso 60, 30 y 7 días antes`}
          >
            {grupos.length ? (
              <p className="mb-3 text-sm text-cuerpo">
                Año gravable {vigente!.anio}: del {formatearFechaLarga(grupos[0].fecha)} al {formatearFechaLarga(grupos[grupos.length - 1].fecha)}.
              </p>
            ) : (
              <div className="mb-3">
                <Aviso tipo="info">Falta el calendario del año gravable {anioActual - 1}: sin él, los hogares no ven su fecha ni reciben avisos.</Aviso>
              </div>
            )}
            <EditorCalendario anios={[anioActual - 1, anioActual]} textos={textos} puede={puede} />
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
