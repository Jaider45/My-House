import Link from "next/link";
import { AccionPrincipal, Aviso, Chip, Tarjeta, TarjetaAcademia, Titulo, Vacio, clasesBoton, cx } from "@/components/ui";
import { BotonGuia } from "@/components/guia/boton-guia";
import { Icono } from "@/components/marca";
import { obtenerContexto } from "@/lib/sesion";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { formatearCOP } from "@/lib/dinero";
import { formatearFechaLarga, hoy } from "@/lib/fechas";
import { enviarReporte, guardarDigitos, recordarCertificado } from "./acciones";
import { estadoSoportes } from "@/lib/impuestos/reporte";
import { cargarSemaforo, COLOR_SEMAFORO, type SemaforoPersona } from "@/lib/impuestos/servidor";
import type { ResultadoTope } from "@/lib/impuestos/tipos";
import { EnlacesUtiles, OfertaEnLugar, RecomendacionAcademia } from "@/components/ofertas-app";

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
      .select("monto, tipo, fecha, comercio, tax_tags(nombre), attachments(id, archivo_path, tipo)")
      .not("tax_tag_id", "is", null)
      .eq("estado", "confirmado")
      .gte("fecha", `${anio}-01-01`)
      .lte("fecha", `${anio}-12-31`),
    ctx.supabase.from("members").select("id, nombre, a_cargo_de, dependiente_dian").eq("es_dependiente", true).order("created_at"),
    ctx.supabase.from("members").select("id, user_id, nit_digitos").eq("es_dependiente", false),
    ctx.supabase.from("calendario_tributario").select("digitos, fecha").eq("pais", ctx.hogar.pais).eq("anio_gravable", anio),
  ]);
  const [{ count: sinTitular }, { count: contadores }] = await Promise.all([
    ctx.supabase.from("accounts").select("id", { count: "exact", head: true }).eq("archivada", false).is("titular_member_id", null),
    ctx.supabase.from("members").select("id", { count: "exact", head: true }).eq("rol", "contador"),
  ]);

  const porEtiqueta = new Map<string, { total: number; cantidad: number; conSoporte: number }>();
  for (const t of etiquetados ?? []) {
    const nombre = t.tax_tags?.nombre ?? "Otra";
    const previo = porEtiqueta.get(nombre) ?? { total: 0, cantidad: 0, conSoporte: 0 };
    porEtiqueta.set(nombre, { total: previo.total + t.monto, cantidad: previo.cantidad + 1, conSoporte: previo.conSoporte + (t.attachments?.length ? 1 : 0) });
  }
  // Carpeta de soportes: los archivos de los movimientos con etiqueta del año (enlaces firmados por 1 hora).
  const soportes = (etiquetados ?? [])
    .flatMap((t) => (t.attachments ?? []).map((a) => ({ id: a.id, ruta: a.archivo_path, tipo: a.tipo, fecha: t.fecha, concepto: t.comercio ?? t.tax_tags?.nombre ?? "Soporte", etiqueta: t.tax_tags?.nombre ?? null })))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const { data: firmados } = soportes.length ? await ctx.supabase.storage.from("soportes").createSignedUrls(soportes.slice(0, 12).map((x) => x.ruta), 3600) : { data: [] };
  const enlaceSoporte = new Map((firmados ?? []).map((f) => [f.path, f.signedUrl]));
  const conSoporte = [...porEtiqueta.values()].filter((e) => e.conSoporte >= e.cantidad).length;

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

  // «Qué hacer ahora» (diseño): lo que se puede marcar como hecho con datos de My House, del más útil al menos.
  const etiquetados_ = (etiquetados ?? []).length;
  const pasos = [
    {
      titulo: "Etiquetar ingresos y gastos",
      texto: etiquetados_ ? `${etiquetados_} movimientos con etiqueta tributaria en ${anio}` : "Salud, educación, honorarios: en «Más detalles» de cada movimiento",
      hecho: etiquetados_ > 0,
      accion: { href: "/movimientos", texto: "Ir a movimientos" },
    },
    {
      titulo: "Asignar el titular de cada cuenta",
      texto: sinTitular ? `${sinTitular} ${sinTitular === 1 ? "cuenta sin titular" : "cuentas sin titular"}: sus movimientos no suman a nadie` : "Cada cuenta suma a su dueño",
      hecho: !sinTitular,
      accion: { href: "/cuentas", texto: "Revisar cuentas" },
    },
    {
      titulo: "Escribir los dos últimos dígitos de la cédula",
      texto: plazo.digitos ? `Cédula terminada en ${plazo.digitos}` : "Con ellos te decimos la fecha límite y te avisamos antes",
      hecho: !!plazo.digitos,
      accion: null,
    },
    {
      titulo: "Pedir el certificado de ingresos y retenciones",
      texto: "Lo entrega la empresa en marzo. Agenda un recordatorio para no olvidarlo",
      hecho: false,
      accion: null,
      formulario: ctx.puedeEditar ? ("certificado" as const) : null,
    },
    {
      titulo: "Darle acceso al contador",
      texto: contadores ? "Ya hay un contador con acceso de solo lectura" : "Ve movimientos, Renta DIAN y soportes, sin poder cambiar nada",
      hecho: !!contadores,
      accion: ctx.esAdmin ? { href: "/ajustes/miembros?nuevo=1", texto: "Invitar" } : null,
    },
    {
      titulo: "Enviar el reporte al contador",
      texto: contadores ? "Con un toque, cuando todo esté listo" : "Primero dale acceso al contador",
      hecho: false,
      accion: { href: `/reporte-renta?anio=${anio}`, texto: "Ver reporte" },
      formulario: ctx.puedeEditar && contadores ? ("enviar" as const) : null,
    },
  ];
  const siguiente = pasos.findIndex((x) => !x.hecho);

  return (
    <>
      <Titulo
        subtitulo={`Quién debe declarar en ${anio + 1} y qué soportes tener listos`}
        accion={
          <>
          <BotonGuia id="renta" />
          <AccionPrincipal href={`/reporte-renta?anio=${anio}`}>Exportar para el contador</AccionPrincipal>
          {personas.length > 1 && (
            <div role="group" aria-label="Persona" className="inline-flex gap-1 rounded-[10px] bg-mosaico p-1">
              {personas.map((p) => (
                <Link key={p.member_id} href={enlace(anio, p.member_id)} aria-current={p === persona ? "true" : undefined} className={claseSegmento(p === persona)}>
                  {p.nombre}
                </Link>
              ))}
            </div>
          )}
          </>
        }
      >
        {`Renta DIAN · año gravable ${anio}`}
      </Titulo>
      <OfertaEnLugar lugar="renta" />

      <div className="space-y-4 md:space-y-5">
        {!semaforo.ok && <Aviso tipo="info">{semaforo.motivo}</Aviso>}
        {personas.length > 0 && (
          <div
            aria-label="Quién declara"
            className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1.5 md:mx-0 md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 xl:grid-cols-3"
          >
            {personas.map((p) => (
              <TarjetaPersona key={p.member_id} persona={p} anio={anio} activa={p === persona} href={enlace(anio, p.member_id)} plazo={p === persona ? plazo : null} />
            ))}
            <section id="reporte" className="flex shrink-0 basis-[84%] snap-start flex-col gap-2.5 rounded-2xl bg-monte p-4 text-arena md:basis-auto md:p-6">
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-[#1b4a3e]">
                <Icono nombre="documentos" tamano={22} />
              </span>
              <h2 className="text-xl leading-[26px] font-bold">Reporte para el contador</h2>
              <p className="text-sm leading-[21px] text-sobre-monte">
                Topes, totales por etiqueta y {soportes.length} {soportes.length === 1 ? "soporte" : "soportes"} en PDF y Excel.{" "}
                {contadores ? "Tu contador ya tiene acceso de solo lectura." : "Dale acceso de solo lectura a tu contador para que lo vea todo."}
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                <Link href={`/reporte-renta?anio=${anio}`} className={clasesBoton("secundario", "border-arena bg-arena text-monte hover:bg-arena/90")}>
                  Exportar reporte
                </Link>
                <a href={`/api/reporte-renta?anio=${anio}`} className={clasesBoton("fantasma", "!text-arena hover:!bg-[#1b4a3e]")}>
                  Excel
                </a>
                {ctx.esAdmin && !contadores && (
                  <Link href="/ajustes/miembros?nuevo=1" className={clasesBoton("fantasma", "!text-arena underline hover:!bg-[#1b4a3e]")}>
                    Invitar al contador
                  </Link>
                )}
              </div>
            </section>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
          {persona && (
            <Tarjeta guia="que-hacer" className="lg:col-span-2" titulo={`Qué hacer ahora · ${persona.nombre.split(" ")[0]}`} subtitulo={`${pasos.filter((x) => x.hecho).length} de ${pasos.length} listos. Lo demás llega con tiempo.`}>
              <ol className="flex flex-col gap-2">
                {pasos.map((x, i) => (
                  <li
                    key={x.titulo}
                    className={cx(
                      "flex flex-wrap items-center gap-2.5 rounded-[14px] border px-3 py-2.5 md:gap-3.5 md:px-4 md:py-3.5",
                      x.hecho ? "border-borde bg-pagina" : i === siguiente ? "border-monte bg-elevada shadow-[inset_0_0_0_1px_var(--color-monte)]" : "border-borde bg-elevada",
                    )}
                  >
                    <span
                      className={cx(
                        "inline-flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold md:size-8 md:text-sm",
                        x.hecho ? "border-ok bg-ok text-white" : i === siguiente ? "border-monte bg-monte text-arena" : "border-control",
                      )}
                    >
                      {x.hecho ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 12l5 5 9-10" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className={cx("block text-sm md:text-[15px]", x.hecho && "text-cuerpo line-through")}>{x.titulo}</b>
                      <span className="text-xs text-cuerpo md:text-sm">{x.texto}</span>
                    </span>
                    {!x.hecho && x.accion && (
                      <Link href={x.accion.href} className={clasesBoton("secundario", "ml-9 h-8 px-3 text-[13px] md:ml-0 md:h-9 md:text-sm")}>
                        {x.accion.texto}
                      </Link>
                    )}
                    {!x.hecho && "formulario" in x && x.formulario && (
                      <FormularioAccion accion={x.formulario === "certificado" ? recordarCertificado : enviarReporte} className="ml-9 flex flex-col items-start gap-1 md:ml-0">
                        <input type="hidden" name="anio" value={anio} />
                        <BotonEnviar variante="secundario" className="h-8 px-3 text-[13px] md:h-9 md:text-sm" pendiente="…">
                          {x.formulario === "certificado" ? "Recordarme" : "Enviar"}
                        </BotonEnviar>
                      </FormularioAccion>
                    )}
                  </li>
                ))}
              </ol>
            </Tarjeta>
          )}
          <Tarjeta className={cx(!persona && "lg:col-span-3")}>
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
          <section data-guia="etiquetas" className="overflow-hidden rounded-2xl border border-borde bg-elevada lg:col-span-2">
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
                      <th className="der">Total {anio}</th>
                      <th className="pr-4! md:pr-6!">Soportes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...porEtiqueta.entries()]
                      .sort((a, b) => b[1].total - a[1].total)
                      .map(([nombre, { total, cantidad, conSoporte: con }]) => {
                        const e = estadoSoportes({ movimientos: cantidad, conSoporte: con });
                        return (
                          <tr key={nombre}>
                            <td className="pl-4! font-semibold whitespace-normal! md:pl-6!">{nombre}</td>
                            <td className="der hidden text-cuerpo md:table-cell">{cantidad}</td>
                            <td className="der font-semibold">{formatearCOP(total)}</td>
                            <td className="pr-4! md:pr-6!">
                              <Chip tono={e.tono}>{e.texto}</Chip>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 pb-4 md:px-6 md:pb-6">
                <Vacio>Marca movimientos con una etiqueta DIAN (medicina prepagada, intereses de vivienda…) en «Más detalles».</Vacio>
              </div>
            )}
          </section>

          <section aria-label="Carpeta de soportes" className="flex flex-col gap-1 rounded-2xl border border-borde bg-elevada p-4 md:p-6">
            <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">Carpeta de soportes</h2>
            <p className="mb-2 text-sm text-tenue">
              {porEtiqueta.size ? `${conSoporte} de ${porEtiqueta.size} etiquetas con todos sus soportes` : "Aquí quedan los PDF y fotos de tus movimientos con etiqueta"}
            </p>
            {soportes.slice(0, 12).map((x) => (
              <a
                key={x.id}
                href={enlaceSoporte.get(x.ruta) ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-14 items-center gap-3 border-b border-divisor hover:bg-mosaico/60"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-mosaico">
                  <Icono nombre={x.tipo === "certificado" ? "certificados" : "documentos"} tamano={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">{x.concepto}</span>
                  <span className="truncate text-[13px] text-tenue">
                    {x.etiqueta} · {formatearFechaLarga(x.fecha)}
                  </span>
                </span>
                <Chip tono="ok">Listo</Chip>
              </a>
            ))}
            {soportes.length > 12 && <p className="py-2 text-[13px] text-tenue">Y {soportes.length - 12} más en el reporte.</p>}
            {ctx.puedeEditar && (
              <Link href="/comprobantes#subir" className="mt-3 rounded-xl border border-dashed border-control p-4 text-center text-sm text-cuerpo hover:bg-mosaico">
                Sube PDF o fotos al <b className="text-tinta underline">asistente</b>: los adjunta al movimiento que corresponde.
              </Link>
            )}
            <p className="mt-3 text-[13px] text-tenue">
              Cada movimiento cuenta para la persona elegida en él o para el titular de la cuenta (
              <Link href="/cuentas" className="font-semibold text-tinta underline">
                Cuentas
              </Link>
              ). El patrimonio suma los saldos de las cuentas del titular.
            </p>
          </section>

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

        <RecomendacionAcademia lugar="renta" />
        <TarjetaAcademia href="/academia/renta" icono="declaracion-renta" etiqueta="Academia · 3 lecciones" titulo="Renta para personas naturales, sin enredos" />
        <EnlacesUtiles lugar="renta" titulo="Enlaces de la DIAN" />
        <p className="text-[13px] text-tenue">
          Cálculo orientativo con base en lo que registras en My House. La decisión final de declarar es tuya y de tu contador.
        </p>
      </div>
    </>
  );
}

type Plazo = { digitos: string | null; fecha: string | null; puedeEditar: boolean };

/** Tarjeta de una persona (diseño «Quién declara»): si debe declarar, en una frase, y su plazo si es la elegida. */
function TarjetaPersona({ persona, anio, activa, href, plazo }: { persona: SemaforoPersona; anio: number; activa: boolean; href: string; plazo: Plazo | null }) {
  const rebasados = persona.topes.filter((t) => t.semaforo === "rojo");
  const cerca = persona.topes.filter((t) => t.semaforo === "amarillo");
  const mayor = [...persona.topes].sort((a, b) => b.porcentaje - a.porcentaje)[0];
  const lista = (ts: ResultadoTope[]) => ts.map((t) => `${t.nombre.toLowerCase()} (${t.porcentaje} %)`).join(", ");
  const { chip, tono, titulo, texto } = {
    rojo: {
      chip: "Obligado",
      tono: "error" as const,
      titulo: `Sí, debe declarar en ${anio + 1}`,
      texto: `Superó ${rebasados.length === 1 ? "el tope de" : "los topes de"} ${lista(rebasados)}.${cerca.length ? ` También está cerca: ${lista(cerca)}.` : ""}`,
    },
    amarillo: {
      chip: "Cerca",
      tono: "alerta" as const,
      titulo: "Está cerca de un tope",
      texto: `Cerca: ${lista(cerca)}. Si alcanza cualquiera, deberá declarar en ${anio + 1}.`,
    },
    verde: {
      chip: "Bajo el tope",
      tono: "ok" as const,
      titulo: "Por ahora, no",
      texto: `Está bajo los ${persona.topes.length} topes.${mayor ? ` Lo más cerca es ${mayor.nombre.toLowerCase()}, con el ${mayor.porcentaje} %.` : ""} Te avisamos si se acerca.`,
    },
  }[persona.estado];
  const iniciales = persona.nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");
  return (
    <section
      aria-label={`Estado de ${persona.nombre}`}
      className={cx(
        "flex shrink-0 basis-[84%] snap-start flex-col gap-2.5 rounded-2xl border bg-elevada p-4 md:basis-auto md:p-6",
        persona.estado === "rojo" ? "border-[#f2c4b5]" : "border-borde",
        activa && "shadow-[inset_0_0_0_1px_var(--color-monte)]",
      )}
    >
      <Link href={href} className="flex items-center gap-3">
        <span className={cx("inline-flex size-10 shrink-0 items-center justify-center rounded-full font-bold", persona.estado === "rojo" ? "bg-monte text-arena" : "bg-teja text-white")}>
          {iniciales}
        </span>
        <b className="flex-1 text-[17px]">{persona.nombre.split(" ")[0]}</b>
        <Chip tono={tono}>{chip}</Chip>
      </Link>
      <h2 className="text-[22px] leading-7 font-bold">{titulo}</h2>
      <p className="text-sm leading-[21px] text-cuerpo">{texto}</p>
      {plazo && persona.estado !== "verde" && <PlazoDeclarar persona={persona} plazo={plazo} />}
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
