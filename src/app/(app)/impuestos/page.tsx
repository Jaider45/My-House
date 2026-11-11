import Link from "next/link";
import { Aviso, Chip, Tarjeta, Titulo, Vacio, cx } from "@/components/ui";
import { Icono } from "@/components/marca";
import { obtenerContexto } from "@/lib/sesion";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { formatearCOP } from "@/lib/dinero";
import { formatearFechaLarga, hoy } from "@/lib/fechas";
import { guardarDigitos } from "./acciones";
import { cargarSemaforo, COLOR_SEMAFORO, type SemaforoPersona } from "@/lib/impuestos/servidor";
import type { ResultadoTope } from "@/lib/impuestos/tipos";

export const metadata = { title: "Renta DIAN" };

type Params = Record<string, string | string[] | undefined>;

export default function Impuestos({ searchParams }: PageProps<"/impuestos">) {
  return (
    <Contenido searchParams={searchParams} />
  );
}

const enlace = (anio: number, persona?: string) => `/impuestos?${new URLSearchParams({ anio: String(anio), ...(persona && { persona }) })}`;
const claseSegmento = (activo: boolean) =>
  cx("inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-semibold", activo ? "bg-elevada text-tinta shadow-[0_0_0_1px_var(--color-borde)]" : "text-cuerpo");

async function Contenido({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const sp = await searchParams;
  const anioActual = Number(hoy().slice(0, 4));
  const anio = typeof sp.anio === "string" && /^\d{4}$/.test(sp.anio) ? Number(sp.anio) : anioActual;

  const [semaforo, { data: anios }, { data: etiquetados }, { data: aCargo }, { data: adultos }, { data: calendario }] = await Promise.all([
    cargarSemaforo(ctx, anio),
    ctx.supabase.from("tax_params").select("anio").eq("pais", ctx.hogar.pais).order("anio", { ascending: false }),
    ctx.supabase
      .from("transactions")
      .select("monto, tipo, tax_tags(nombre)")
      .not("tax_tag_id", "is", null)
      .eq("estado", "confirmado")
      .gte("fecha", `${anio}-01-01`)
      .lte("fecha", `${anio}-12-31`),
    ctx.supabase.from("members").select("id, nombre, a_cargo_de, dependiente_dian").eq("es_dependiente", true).order("created_at"),
    ctx.supabase.from("members").select("id, user_id, nit_digitos").eq("es_dependiente", false),
    ctx.supabase.from("calendario_tributario").select("digitos, fecha").eq("pais", ctx.hogar.pais).eq("anio_gravable", anio),
  ]);

  const porEtiqueta = new Map<string, { total: number; cantidad: number }>();
  for (const t of etiquetados ?? []) {
    const nombre = t.tax_tags?.nombre ?? "Otra";
    const previo = porEtiqueta.get(nombre) ?? { total: 0, cantidad: 0 };
    porEtiqueta.set(nombre, { total: previo.total + t.monto, cantidad: previo.cantidad + 1 });
  }

  const personas = semaforo.ok ? semaforo.personas : [];
  const persona = personas.find((p) => p.member_id === sp.persona) ?? personas.find((p) => p.estado === "rojo") ?? personas[0];
  const unidad = semaforo.ok ? semaforo.jurisdiccion.unidad : "UVT";
  // Topes distintos del año (unidades → pesos), para el panel de parámetros.
  const topes = [...new Map((persona?.topes ?? []).map((t) => [t.topeUnidades, t])).values()].sort((a, b) => a.topeUnidades - b.topeUnidades);
  // Personas a cargo que la persona elegida reporta como dependientes (Configuración → Miembros).
  const susDependientes = (aCargo ?? []).filter((d) => d.dependiente_dian && d.a_cargo_de === persona?.member_id);
  const beneficio =
    semaforo.ok && persona ? semaforo.jurisdiccion.dependientes?.beneficio(semaforo.params.uvt_valor, semaforo.params.deducciones ?? {}, susDependientes.length) : null;
  const sinAsignar = (aCargo ?? []).filter((d) => d.dependiente_dian && !d.a_cargo_de);
  // Plazo para declarar según los dos últimos dígitos de la cédula (calendario de la consola → Parámetros DIAN).
  const adulto = (adultos ?? []).find((a) => a.id === persona?.member_id);
  const plazo = {
    digitos: adulto?.nit_digitos ?? null,
    fecha: adulto?.nit_digitos ? (calendario ?? []).find((c) => c.digitos === Number(adulto.nit_digitos))?.fecha ?? null : null,
    puedeEditar: ctx.esAdmin || (!!adulto && adulto.user_id === ctx.userId),
  };

  return (
    <>
      <Titulo
        subtitulo={`Quién debe declarar en ${anio + 1} y qué soportes tener listos`}
        accion={
          personas.length > 1 && (
            <div role="group" aria-label="Persona" className="inline-flex gap-1 rounded-[10px] bg-mosaico p-1">
              {personas.map((p) => (
                <Link key={p.member_id} href={enlace(anio, p.member_id)} aria-current={p === persona ? "true" : undefined} className={claseSegmento(p === persona)}>
                  {p.nombre}
                </Link>
              ))}
            </div>
          )
        }
      >
        {`Renta DIAN · año gravable ${anio}`}
      </Titulo>

      <div className="space-y-4 md:space-y-5">
        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
          <Tarjeta>
            <p className="mb-2 text-[13px] leading-[18px] font-semibold text-cuerpo">Año gravable</p>
            <nav aria-label="Año gravable" className="mb-4 flex flex-wrap gap-1 rounded-[10px] bg-mosaico p-1">
              {(anios ?? []).map(({ anio: a }) => (
                <Link key={a} href={enlace(a)} aria-current={a === anio ? "true" : undefined} className={cx(claseSegmento(a === anio), "flex-1 justify-center")}>
                  {a}
                </Link>
              ))}
            </nav>
            {semaforo.ok && (
              <dl className="space-y-3 text-[15px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-cuerpo">
                    {unidad} {anio}
                  </dt>
                  <dd className="font-bold">{formatearCOP(semaforo.params.uvt_valor)}</dd>
                </div>
                {topes.map((t) => (
                  <div key={t.topeUnidades} className="flex justify-between gap-3">
                    <dt className="text-cuerpo">
                      Tope · {t.topeUnidades.toLocaleString("es-CO")} {unidad}
                    </dt>
                    <dd className="font-bold">{formatearCOP(t.tope)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Tarjeta>
          <div className="lg:col-span-2">{!semaforo.ok ? <Aviso tipo="info">{semaforo.motivo}</Aviso> : persona ? <AvisoPersona persona={persona} anio={anio} unidad={unidad} plazo={plazo} /> : null}</div>
        </div>

        {semaforo.ok && !persona && <Vacio>No hay personas adultas en el hogar.</Vacio>}
        {persona && (
          <section aria-label="Topes de la DIAN">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">Topes de {persona.nombre}</h2>
                <p className="mt-0.5 text-sm text-tenue">Acumulado del año con los movimientos registrados</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["verde", "amarillo", "rojo"] as const).map((s) => (
                  <Chip key={s} tono={COLOR_SEMAFORO[s].tono}>
                    {COLOR_SEMAFORO[s].etiqueta}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-5">
              {persona.topes.map((t) => (
                <Medidor key={t.clave} tope={t} />
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
          <section className="overflow-hidden rounded-2xl border border-borde bg-elevada lg:col-span-2">
            <div className="px-4 pt-4 md:px-6 md:pt-5">
              <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">Totales por etiqueta tributaria</h2>
              <p className="mt-0.5 text-sm text-tenue">Lo que el contador va a necesitar, ya sumado</p>
            </div>
            {porEtiqueta.size ? (
              <div className="mt-3 overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th className="pl-4! md:pl-6!">Etiqueta</th>
                      <th className="der hidden md:table-cell">Movimientos</th>
                      <th className="der pr-4! md:pr-6!">Total {anio}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...porEtiqueta.entries()]
                      .sort((a, b) => b[1].total - a[1].total)
                      .map(([nombre, { total, cantidad }]) => (
                        <tr key={nombre}>
                          <td className="pl-4! font-semibold whitespace-normal! md:pl-6!">{nombre}</td>
                          <td className="der hidden text-cuerpo md:table-cell">{cantidad}</td>
                          <td className="der pr-4! font-semibold md:pr-6!">{formatearCOP(total)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 pb-4 md:px-6 md:pb-6">
                <Vacio>Marca movimientos con una etiqueta DIAN (medicina prepagada, intereses de vivienda…) en «Más detalles».</Vacio>
              </div>
            )}
          </section>

          <Tarjeta titulo="Cómo se calcula" subtitulo="Para que los topes reflejen a cada persona">
            <ul className="space-y-3 text-[15px] text-cuerpo">
              <li>Cada movimiento cuenta para la persona elegida en él o, si no tiene, para el titular de la cuenta.</li>
              <li>
                Asigna el titular de cada cuenta en{" "}
                <Link href="/cuentas" className="font-semibold text-tinta underline">
                  Cuentas
                </Link>
                .
              </li>
              <li>El patrimonio suma los saldos de las cuentas del titular; inmuebles y vehículos aún no se registran.</li>
            </ul>
          </Tarjeta>

          {persona && beneficio && (
            <Tarjeta
              className="lg:col-span-2"
              titulo={`Dependientes de ${persona.nombre}`}
              subtitulo="Personas a cargo que reporta en su declaración: bajan el impuesto, no cambian los topes para declarar"
              accion={
                <Link href="/ajustes/miembros" className="text-sm font-semibold underline">
                  Editar personas a cargo
                </Link>
              }
            >
              {susDependientes.length ? (
                <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
                  <ul className="flex flex-wrap content-start gap-2">
                    {susDependientes.map((d) => (
                      <li key={d.id}>
                        <Chip tono="info">{d.nombre}</Chip>
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-2 text-[15px] text-cuerpo">
                    <li>
                      Deducción por dependientes: hasta el <b className="text-tinta">{beneficio.porcentaje} %</b> de sus rentas de trabajo, con
                      tope de <b className="text-tinta">{formatearCOP(beneficio.topeAnual)}</b> en {anio}.
                    </li>
                    <li>
                      Adicional de <b className="text-tinta">{formatearCOP(beneficio.adicionalPorDependiente)}</b> por dependiente (máximo{" "}
                      {beneficio.maximoDependientes}): hasta <b className="text-tinta">{formatearCOP(beneficio.adicionalTotal)}</b> con{" "}
                      {Math.min(susDependientes.length, beneficio.maximoDependientes)}.
                    </li>
                    <li className="text-[13px] text-tenue">
                      Un mismo dependiente lo reporta una sola persona. Las condiciones (edad, estudios, ingresos) y cómo se combinan ambas
                      deducciones las confirma tu contador.
                    </li>
                  </ul>
                </div>
              ) : (
                <Vacio>
                  {persona.nombre} no tiene dependientes marcados. En Configuración → Miembros elige «A cargo de» y marca «Lo reporto como
                  dependiente».
                </Vacio>
              )}
              {sinAsignar.length > 0 && (
                <p className="mt-3 text-[13px] text-tenue">
                  Sin asignar a nadie: {sinAsignar.map((d) => d.nombre).join(", ")}.
                </p>
              )}
            </Tarjeta>
          )}
        </div>

        <p className="text-[13px] text-tenue">
          Cálculo orientativo con base en lo que registras en My House. La decisión final de declarar es tuya y de tu contador.
        </p>
      </div>
    </>
  );
}

type Plazo = { digitos: string | null; fecha: string | null; puedeEditar: boolean };

function AvisoPersona({ persona, anio, unidad, plazo }: { persona: SemaforoPersona; anio: number; unidad: string; plazo: Plazo }) {
  const rebasados = persona.topes.filter((t) => t.semaforo === "rojo");
  const cerca = persona.topes.filter((t) => t.semaforo === "amarillo");
  const lista = (ts: ResultadoTope[]) => ts.map((t) => `${t.nombre.toLowerCase()} (${t.porcentaje} %)`).join(", ");
  const { titulo, texto, clases } = {
    rojo: {
      titulo: `${persona.nombre} debe declarar en ${anio + 1}`,
      texto: `Superó ${rebasados.length === 1 ? "el tope de" : "los topes de"} ${lista(rebasados)}.${cerca.length ? ` Además, ${cerca.length === 1 ? "otro tope está cerca" : "otros topes están cerca"}: ${lista(cerca)}.` : ""}`,
      clases: "bg-error-fondo text-error-tinta",
    },
    amarillo: {
      titulo: `${persona.nombre} está cerca de un tope`,
      texto: `Cerca: ${lista(cerca)}. Si alcanza cualquiera, deberá declarar en ${anio + 1}.`,
      clases: "bg-alerta-fondo text-alerta-tinta",
    },
    verde: {
      titulo: `${persona.nombre} sigue bajo los topes de ${anio}`,
      texto: `Ningún acumulado llega al 70 % de su tope en ${unidad}. My House te avisa si eso cambia.`,
      clases: "bg-ok-fondo text-ok-tinta",
    },
  }[persona.estado];
  return (
    <section aria-label={`Estado de ${persona.nombre}`} className={cx("flex h-full items-start gap-4 rounded-2xl px-5 py-4", clases)}>
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white">
        <Icono nombre="declaracion-renta" tamano={22} acento={false} />
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <strong className="text-xl leading-[26px]">{titulo}</strong>
        <span className="text-sm">{texto}</span>
        <PlazoDeclarar persona={persona} plazo={plazo} />
      </div>
    </section>
  );
}

/** Fecha límite según la cédula, o el campo para escribir sus dos últimos dígitos. */
function PlazoDeclarar({ persona, plazo }: { persona: SemaforoPersona; plazo: Plazo }) {
  if (plazo.fecha)
    return (
      <span className="text-sm">
        Plazo para declarar (cédula terminada en {plazo.digitos}): <b>{formatearFechaLarga(plazo.fecha)}</b>. Te avisamos 60, 30 y 7 días antes.
      </span>
    );
  if (plazo.digitos)
    return <span className="text-sm">Cédula terminada en {plazo.digitos}: la fecha aparece cuando la DIAN publique el calendario de este año.</span>;
  if (!plazo.puedeEditar) return <span className="text-sm">El plazo depende de los dos últimos dígitos de la cédula de {persona.nombre}.</span>;
  return (
    <FormularioAccion accion={guardarDigitos} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="persona" value={persona.member_id} />
      <label htmlFor="digitos-cedula">Dos últimos dígitos de la cédula de {persona.nombre}:</label>
      <input
        id="digitos-cedula"
        name="digitos"
        inputMode="numeric"
        pattern="[0-9]{2}"
        maxLength={2}
        required
        className="h-8 w-14 rounded-lg border border-control bg-white px-2 text-center text-tinta"
      />
      <BotonEnviar variante="secundario" className="h-8 px-3 text-sm" pendiente="Guardando…">
        Ver mi fecha
      </BotonEnviar>
    </FormularioAccion>
  );
}

/** Medidor semicircular del porcentaje del tope (en celular, en fila). */
function Medidor({ tope: t }: { tope: ResultadoTope }) {
  const c = COLOR_SEMAFORO[t.semaforo];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-borde bg-elevada px-3.5 py-3 text-left md:flex-col md:gap-1.5 md:p-[18px] md:pb-4 md:text-center">
      <svg viewBox="0 0 128 76" className="h-[52px] w-[84px] shrink-0 md:h-[76px] md:w-32" role="img" aria-label={`${t.nombre}: ${t.porcentaje} por ciento del tope, ${c.etiqueta}`}>
        <path d="M12 68 A52 52 0 0 1 116 68" fill="none" stroke="#ebe6de" strokeWidth="12" strokeLinecap="round" />
        <path d="M12 68 A52 52 0 0 1 116 68" fill="none" stroke={c.color} strokeWidth="12" strokeLinecap="round" pathLength={100} strokeDasharray={`${Math.min(100, t.porcentaje)} 100`} />
        <text x="64" y="64" textAnchor="middle" fontSize="20" fontWeight="700" fill="#143d33">
          {t.porcentaje} %
        </text>
      </svg>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1 md:items-center">
        <span className="flex items-center text-sm leading-[18px] font-bold md:min-h-9">{t.nombre}</span>
        <span className="text-lg leading-6 font-bold">{formatearCOP(t.acumulado)}</span>
        <span className="text-[13px] leading-[18px] text-tenue">de {formatearCOP(t.tope)}</span>
        <Chip tono={c.tono}>{c.etiqueta}</Chip>
      </div>
    </div>
  );
}
