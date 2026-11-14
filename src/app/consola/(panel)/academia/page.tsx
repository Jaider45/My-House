import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Chip, Titulo, clasesBoton, cx } from "@/components/ui";
import { Icono, type NombreIcono } from "@/components/marca";
import { obtenerStaff } from "@/lib/consola/sesion";
import { GUIAS } from "@/lib/guias";
import { hoy } from "@/lib/fechas";
import { TarjetaTabla } from "../tarjeta-tabla";
import { EditorLeccion, ListaLecciones, type LeccionConsola } from "./editor";
import { CONDICIONES, LUGARES } from "./constantes";
import { ActivarRegla, VentanasAcademia, type Recomendacion, type RutaConsola, type TallerConsola } from "./formularios";

export const metadata: Metadata = { title: "Academia" };

type Ruta = RutaConsola & { empezaron: number; lecciones: LeccionConsola[] };
type Datos = {
  kpis: { lecciones: number; rutas: number; aprenden_30d: number; activos_30d: number; calificacion: number | null; opiniones: number; finalizacion: number | null };
  rutas: Ruta[];
  recomendaciones: Recomendacion[];
  talleres: TallerConsola[];
};

const PESTANAS = [
  ["rutas", "Rutas y lecciones"],
  ["recomendaciones", "Recomendaciones"],
  ["talleres", "Talleres en vivo"],
] as const;

function Kpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-elevada p-4 md:p-5">
      <p className="text-[13px] font-semibold text-cuerpo">{etiqueta}</p>
      <p className="mt-1 text-[26px] leading-8 font-bold">{valor}</p>
      <p className="text-[13px] text-tenue">{detalle}</p>
    </div>
  );
}

const fechaTaller = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(new Date(iso));

export default async function AcademiaConsola({ searchParams }: { searchParams: Promise<{ tab?: string; ruta?: string; leccion?: string }> }) {
  const staff = await obtenerStaff();
  const sp = await searchParams;
  const tab = PESTANAS.find(([k]) => k === sp.tab)?.[0] ?? "rutas";
  const { data, error } = await staff.supabase.rpc("consola_academia");
  const d = (data ?? { kpis: {}, rutas: [], recomendaciones: [], talleres: [] }) as Datos;
  const puede = staff.puede("contenido_app");
  const ruta = d.rutas.find((r) => r.slug === sp.ruta) ?? d.rutas[0];
  const leccion = sp.leccion === "nueva" ? null : (ruta?.lecciones.find((l) => l.id === sp.leccion) ?? ruta?.lecciones[0] ?? null);
  const nombreRuta = new Map(d.rutas.map((r) => [r.slug, r.titulo]));
  const nombreLeccion = new Map(d.rutas.flatMap((r) => r.lecciones.map((l) => [`${r.slug}/${l.slug}`, l.titulo] as const)));
  const destinos: [string, string][] = d.rutas.flatMap((r) => [[r.slug, `Ruta: ${r.titulo}`] as [string, string], ...r.lecciones.filter((l) => l.publicada).map((l) => [`${r.slug}/${l.slug}`, `${r.titulo} · ${l.titulo}`] as [string, string])]);
  const k = d.kpis;
  const hoyBogota = hoy();
  const pctAprenden = k.activos_30d ? Math.round((100 * k.aprenden_30d) / k.activos_30d) : null;

  return (
    <>
      <Titulo
        registrar={false}
        subtitulo="Rutas, lecciones, talleres y cuándo recomendar cada cosa"
        accion={
          <span className="flex flex-wrap gap-2">
            <Link href="/academia" target="_blank" className={clasesBoton("secundario")}>
              Ver la Academia
            </Link>
            {puede && tab === "rutas" && ruta && (
              <Link href={`/consola/academia?ruta=${ruta.slug}&leccion=nueva`} className={clasesBoton("primario")}>
                Nueva lección
              </Link>
            )}
          </span>
        }
      >
        Academia
      </Titulo>
      {error && <Aviso>No se pudo cargar la Academia: {error.message}</Aviso>}

      <section className="mb-5 grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
        <Kpi etiqueta="Lecciones publicadas" valor={String(k.lecciones ?? 0)} detalle={`en ${k.rutas ?? 0} rutas`} />
        <Kpi etiqueta="Personas que aprenden · 30 d" valor={(k.aprenden_30d ?? 0).toLocaleString("es-CO")} detalle={pctAprenden === null ? "—" : `${pctAprenden} % de los activos`} />
        <Kpi etiqueta="Finalización promedio" valor={k.finalizacion == null ? "—" : `${k.finalizacion} %`} detalle="de quienes empiezan una ruta" />
        <Kpi etiqueta="Calificación" valor={k.calificacion == null ? "—" : `${Number(k.calificacion).toLocaleString("es-CO")} / 5`} detalle={`${(k.opiniones ?? 0).toLocaleString("es-CO")} opiniones`} />
      </section>

      <nav role="tablist" aria-label="Secciones" className="mb-4 flex gap-1 overflow-x-auto border-b border-divisor">
        {PESTANAS.map(([key, t]) => (
          <Link
            key={key}
            role="tab"
            aria-selected={tab === key}
            href={`/consola/academia?tab=${key}`}
            className={cx("h-10 shrink-0 border-b-2 px-3 pt-2 text-sm font-semibold", tab === key ? "border-monte text-tinta" : "border-transparent text-cuerpo hover:text-tinta")}
          >
            {t}
          </Link>
        ))}
      </nav>

      {tab === "rutas" && (
        <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-2 rounded-2xl border border-borde bg-elevada p-4">
            <div className="flex items-center justify-between">
              <b>Rutas</b>
              {puede && (
                <Link href="?tab=rutas&nuevo=ruta" scroll={false} className="text-sm font-semibold underline-offset-4 hover:underline">
                  + Ruta
                </Link>
              )}
            </div>
            {d.rutas.map((r) => {
              const pub = r.lecciones.filter((l) => l.publicada);
              const terminan = r.empezaron && pub.length ? Math.round((100 * Math.min(...pub.map((l) => l.vistas))) / r.empezaron) : null;
              const cambios = r.lecciones.some((l) => l.borrador || !l.publicada);
              return (
                <div key={r.slug} className={cx("flex items-center gap-3 rounded-xl border p-3", r.slug === ruta?.slug ? "border-monte bg-seleccion" : "border-transparent hover:bg-mosaico")}>
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-mosaico">
                    <Icono nombre={r.icono as NombreIcono} tamano={20} />
                  </span>
                  <Link href={`/consola/academia?ruta=${r.slug}`} className="min-w-0 flex-1">
                    <b className="block text-sm leading-5">{r.titulo}</b>
                    <span className="text-[13px] text-tenue">
                      {r.lecciones.length} lecciones{terminan !== null ? ` · ${terminan} % terminan` : ""}
                    </span>
                  </Link>
                  {!r.publicada ? <Chip tono="info">Borrador</Chip> : cambios ? <Chip tono="alerta">Cambios sin publicar</Chip> : <Chip tono="ok">Publicada</Chip>}
                  {puede && (
                    <Link href={`?tab=rutas&ruta=${r.slug}&nuevo=ruta-${r.slug}`} scroll={false} aria-label={`Editar ${r.titulo}`} className="text-sm text-cuerpo hover:text-tinta">
                      ✎
                    </Link>
                  )}
                </div>
              );
            })}
          </aside>
          {ruta ? (
            <div className="flex min-w-0 flex-col gap-4">
              <ListaLecciones key={ruta.slug + ruta.lecciones.map((l) => l.id).join()} ruta={ruta.slug} lecciones={ruta.lecciones} actual={leccion?.id ?? null} empezaron={ruta.empezaron} puede={puede} />
              <EditorLeccion
                key={leccion?.id ?? `nueva-${ruta.slug}`}
                ruta={ruta.slug}
                rutaTitulo={ruta.titulo}
                indice={leccion ? ruta.lecciones.findIndex((l) => l.id === leccion.id) : ruta.lecciones.length}
                l={leccion}
                guias={GUIAS.map((g) => ({ id: g.id, titulo: g.titulo }))}
                puede={puede}
              />
            </div>
          ) : (
            <p className="text-sm text-tenue">Crea la primera ruta.</p>
          )}
        </div>
      )}

      {tab === "recomendaciones" && (
        <TarjetaTabla
          titulo="Recomendaciones automáticas"
          subtitulo="Así la Academia aparece justo cuando sirve (no se repite lo que la persona ya vio)"
          accion={
            puede ? (
              <Link href="?tab=recomendaciones&nuevo=regla" scroll={false} className={clasesBoton("secundario", "h-9 px-3 text-sm")}>
                Nueva regla
              </Link>
            ) : undefined
          }
        >
          <table className="tabla">
            <thead>
              <tr>
                <th className="pl-4! md:pl-6!">Si pasa esto en el hogar</th>
                <th>Recomendar</th>
                <th>Dónde aparece</th>
                <th className="der">Clics</th>
                <th>Activa</th>
                <th className="pr-4! md:pr-6!">
                  <span className="sr-only">Editar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {d.recomendaciones.map((r) => (
                <tr key={r.id}>
                  <td className="pl-4! font-semibold whitespace-normal! md:pl-6!">{CONDICIONES.find(([c]) => c === r.condicion)?.[1] ?? r.condicion}</td>
                  <td className="text-cuerpo whitespace-normal!">{r.leccion ? (nombreLeccion.get(`${r.ruta}/${r.leccion}`) ?? r.leccion) : `Ruta: ${nombreRuta.get(r.ruta) ?? r.ruta}`}</td>
                  <td className="text-cuerpo">{r.lugares.map((l) => LUGARES.find(([k]) => k === l)?.[1] ?? l).join(", ")}</td>
                  <td className="der">{r.clics.toLocaleString("es-CO")}</td>
                  <td>{puede ? <ActivarRegla r={r} /> : <Chip tono={r.activa ? "ok" : "neutro"}>{r.activa ? "Sí" : "No"}</Chip>}</td>
                  <td className="pr-4! md:pr-6!">
                    {puede && (
                      <Link href={`?tab=recomendaciones&nuevo=regla-${r.id}`} scroll={false} className={clasesBoton("fantasma", "h-8 px-3 text-sm")}>
                        Editar
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TarjetaTabla>
      )}

      {tab === "talleres" && (
        <TarjetaTabla
          titulo="Talleres en vivo"
          subtitulo="Se anuncian en la Academia; quien se inscribe ve el enlace de la sesión"
          accion={
            puede ? (
              <Link href="?tab=talleres&nuevo=taller" scroll={false} className={clasesBoton("secundario", "h-9 px-3 text-sm")}>
                Nuevo taller
              </Link>
            ) : undefined
          }
        >
          <table className="tabla">
            <thead>
              <tr>
                <th className="pl-4! md:pl-6!">Taller</th>
                <th>Fecha</th>
                <th className="der">Cupos</th>
                <th>Estado</th>
                <th className="pr-4! md:pr-6!">
                  <span className="sr-only">Editar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {d.talleres.length === 0 && (
                <tr>
                  <td colSpan={5} className="pl-4! text-tenue md:pl-6!">
                    Aún no hay talleres.
                  </td>
                </tr>
              )}
              {d.talleres.map((t) => {
                const paso = t.fecha.slice(0, 10) < hoyBogota;
                return (
                  <tr key={t.id}>
                    <td className="pl-4! font-semibold whitespace-normal! md:pl-6!">{t.titulo}</td>
                    <td className="text-cuerpo">{fechaTaller(t.fecha)}</td>
                    <td className="der">
                      {t.inscritos.toLocaleString("es-CO")} / {t.cupos.toLocaleString("es-CO")}
                    </td>
                    <td>
                      <Chip tono={paso ? "neutro" : t.publicado ? "ok" : "info"}>{paso ? "Terminó" : t.publicado ? "Inscripciones abiertas" : "Borrador"}</Chip>
                    </td>
                    <td className="pr-4! md:pr-6!">
                      {puede && (
                        <Link href={`?tab=talleres&nuevo=taller-${t.id}`} scroll={false} className={clasesBoton("fantasma", "h-8 px-3 text-sm")}>
                          Editar
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TarjetaTabla>
      )}

      {puede && <VentanasAcademia rutas={d.rutas} recomendaciones={d.recomendaciones} talleres={d.talleres} destinos={destinos} />}
    </>
  );
}
