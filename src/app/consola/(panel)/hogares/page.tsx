import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Chip, EnlaceBoton, Titulo, cx } from "@/components/ui";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearFechaCorta, formatearMomento } from "@/lib/consola/formato";
import { formatearCOP } from "@/lib/dinero";
import { TarjetaTabla } from "../tarjeta-tabla";
import { ChipPlan, type FilaHogar } from "./comun";

export const metadata: Metadata = { title: "Hogares" };

const FILTROS = [
  { valor: "todos", texto: "Todos" },
  { valor: "familia", texto: "Familia" },
  { valor: "contador", texto: "Contador" },
  { valor: "gratis", texto: "Gratis" },
  { valor: "prueba", texto: "En prueba" },
  { valor: "pago_fallido", texto: "Pago pendiente" },
  { valor: "suspendidos", texto: "Suspendidos" },
] as const;

export default async function HogaresConsola({ searchParams }: PageProps<"/consola/hogares">) {
  const staff = await obtenerStaff();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const filtro = FILTROS.find((f) => f.valor === sp.filtro)?.valor ?? "todos";
  const antes = typeof sp.antes === "string" && !Number.isNaN(Date.parse(sp.antes)) ? sp.antes : undefined;

  const [lista, conteos] = await Promise.all([
    staff.supabase.rpc("consola_hogares", { p_buscar: q || undefined, p_filtro: filtro, p_antes: antes, p_limite: 25 }),
    staff.supabase.rpc("consola_hogares_conteos"),
  ]);
  const filas = (lista.data ?? []) as FilaHogar[];
  const n = (conteos.data ?? {}) as Record<string, number>;
  const url = (cambios: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(filtro !== "todos" && { filtro }), ...cambios } as Record<string, string>);
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return `/consola/hogares${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <Titulo
        registrar={false}
        subtitulo="Cada hogar es un cliente del SaaS"
        accion={
          staff.puede("exportar") ? (
            <a href={`/consola/hogares/exportar?${new URLSearchParams({ filtro, ...(q && { q }) })}`} className="inline-flex h-10 items-center rounded-lg border border-cuerpo bg-elevada px-4 text-[15px] font-semibold hover:bg-mosaico">
              Exportar CSV
            </a>
          ) : undefined
        }
      >
        Hogares
      </Titulo>
      {(lista.error || conteos.error) && <Aviso>{mensajeError(lista.error ?? conteos.error)}</Aviso>}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <form action="/consola/hogares" className="flex min-w-[260px] flex-[1_1_300px] md:max-w-[380px]">
          {filtro !== "todos" && <input type="hidden" name="filtro" value={filtro} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por hogar, persona o correo"
            aria-label="Buscar por hogar, persona o correo"
            className="h-10 w-full rounded-lg border border-control bg-elevada px-3 text-[15px]"
          />
        </form>
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={url({ filtro: f.valor === "todos" ? undefined : f.valor, antes: undefined })}
            aria-current={filtro === f.valor ? "page" : undefined}
            className={cx("inline-flex h-9 items-center rounded-full border px-3 text-sm", filtro === f.valor ? "border-monte bg-monte text-arena" : "border-control bg-elevada")}
          >
            {f.texto} · {(n[f.valor] ?? 0).toLocaleString("es-CO")}
          </Link>
        ))}
      </div>

      <TarjetaTabla
        titulo={q ? `Resultados para «${q}»` : FILTROS.find((f) => f.valor === filtro)!.texto}
        subtitulo={`${filas.length} en esta página`}
        pie={
          (antes || filas.length === 25) && (
            <div className="flex justify-between">
              {antes ? (
                <EnlaceBoton href={url({ antes: undefined })} variante="secundario" className="h-9 text-sm">
                  Primera página
                </EnlaceBoton>
              ) : (
                <span />
              )}
              {filas.length === 25 && (
                <EnlaceBoton href={url({ antes: filas[filas.length - 1].created_at })} variante="secundario" className="h-9 text-sm">
                  Siguiente
                </EnlaceBoton>
              )}
            </div>
          )
        }
      >
        {filas.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-tenue md:px-6">No hay hogares con ese filtro.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th className="pl-4! md:pl-6!">Hogar</th>
                <th>Plan</th>
                <th className="der">Personas</th>
                <th className="der">Mov. 30 d</th>
                <th className="der">MRR</th>
                <th>Estado</th>
                <th>Último uso</th>
                <th>Alta</th>
                <th className="pr-4! md:pr-6!">
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((h) => (
                <tr key={h.id}>
                  <td className="pl-4! md:pl-6!">
                    <span className="flex flex-col leading-[18px]">
                      <b>{h.nombre}</b>
                      <small className="text-xs text-tenue">{h.admin_nombre ?? "Sin administrador"}</small>
                    </span>
                  </td>
                  <td>
                    <ChipPlan plan={h.plan} enPrueba={h.en_prueba} />
                  </td>
                  <td className="der">{h.miembros}</td>
                  <td className="der">{h.movimientos_30d.toLocaleString("es-CO")}</td>
                  <td className="der font-bold">{formatearCOP(h.mrr)}</td>
                  <td>{h.estado === "suspendido" ? <Chip tono="error">Suspendido</Chip> : <Chip tono="ok">Activo</Chip>}</td>
                  <td className="text-cuerpo">{formatearMomento(h.ultimo_uso)}</td>
                  <td className="text-cuerpo">{formatearFechaCorta(h.created_at)}</td>
                  <td className="pr-4! md:pr-6!">
                    <Link href={`/consola/hogares/${h.id}`} className="font-semibold underline-offset-4 hover:underline">
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TarjetaTabla>
    </>
  );
}
