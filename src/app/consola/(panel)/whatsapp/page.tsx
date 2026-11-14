import type { Metadata } from "next";
import Link from "next/link";
import { formatearMomento } from "@/lib/consola/formato";
import { Aviso, Chip, Titulo, clasesBoton, cx, type Tono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { obtenerStaff } from "@/lib/consola/sesion";
import { CATEGORIAS } from "@/lib/whatsapp/plantillas";
import { EditorPlantilla, type PlantillaFila } from "./editor";
import { sincronizar } from "./acciones";

export const metadata: Metadata = { title: "Plantillas de WhatsApp" };

const ESTADO: Record<PlantillaFila["estado"], { texto: string; tono: Tono }> = {
  borrador: { texto: "Borrador", tono: "info" },
  en_revision: { texto: "En revisión", tono: "alerta" },
  aprobada: { texto: "Aprobada", tono: "ok" },
  rechazada: { texto: "Rechazada", tono: "error" },
  pausada: { texto: "Pausada", tono: "neutro" },
};

export default async function PlantillasWhatsapp({ searchParams }: { searchParams: Promise<{ id?: string; q?: string; nueva?: string }> }) {
  const staff = await obtenerStaff();
  const sp = await searchParams;
  const [{ data, error }, { data: integ }, { data: envios }] = await Promise.all([
    staff.supabase.rpc("consola_plantillas_whatsapp"),
    staff.puede("sistema") ? staff.supabase.rpc("consola_integraciones") : Promise.resolve({ data: null }),
    staff.supabase.rpc("consola_mensajes_whatsapp"),
  ]);
  const todas = (data ?? []) as PlantillaFila[];
  const q = (sp.q ?? "").trim().toLowerCase();
  const lista = q ? todas.filter((p) => p.nombre.includes(q)) : todas;
  const actual = sp.nueva ? null : (todas.find((p) => p.id === sp.id) ?? todas[0] ?? null);
  const puede = staff.puede("contenido_app");
  const conectado = integ ? integ.some((i) => i.proveedor === "whatsapp" && i.activa) : null;

  return (
    <>
      <Titulo
        registrar={false}
        subtitulo="Créalas aquí y envíalas a revisión de Meta sin salir de la consola"
        accion={
          puede ? (
            <span className="flex flex-wrap gap-2">
              <FormularioAccion accion={sincronizar} className="inline-flex flex-col">
                <BotonEnviar variante="secundario" pendiente="Sincronizando…">
                  Sincronizar con Meta
                </BotonEnviar>
              </FormularioAccion>
              <Link href="/consola/whatsapp?nueva=1" className={clasesBoton("primario")}>
                Nueva plantilla
              </Link>
            </span>
          ) : undefined
        }
      >
        Plantillas de WhatsApp
      </Titulo>
      {error && <Aviso>No se pudieron cargar: {error.message}</Aviso>}
      {conectado === false && (
        <div className="mb-4">
          <Aviso tipo="info">
            WhatsApp no está conectado: puedes preparar borradores, pero para enviarlas a Meta conecta la cuenta (con el WABA ID) en{" "}
            <Link href="/consola/integraciones" className="font-semibold underline">
              Integraciones
            </Link>
            .
          </Aviso>
        </div>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-2 rounded-2xl border border-borde bg-elevada p-4">
          <form role="search">
            <input name="q" defaultValue={sp.q} type="search" placeholder="Buscar plantilla" aria-label="Buscar plantilla" className="h-9 w-full rounded-lg border border-control bg-elevada px-3 text-sm" />
          </form>
          {lista.length === 0 && <p className="py-2 text-sm text-tenue">Aún no hay plantillas.</p>}
          {lista.map((p) => (
            <Link
              key={p.id}
              href={`/consola/whatsapp?id=${p.id}`}
              aria-current={p.id === actual?.id ? "page" : undefined}
              className={cx("flex items-center gap-2 rounded-xl border p-3", p.id === actual?.id ? "border-monte bg-seleccion" : "border-transparent hover:bg-mosaico")}
            >
              <span className="min-w-0 flex-1">
                <b className="block truncate font-mono text-[13px]">{p.nombre}</b>
                <span className="text-[13px] text-tenue">
                  {CATEGORIAS.find((c) => c.valor === p.categoria)?.texto} · {p.idioma}
                </span>
              </span>
              <Chip tono={ESTADO[p.estado].tono}>{ESTADO[p.estado].texto}</Chip>
            </Link>
          ))}
          <p className="mt-1 text-[13px] text-tenue">Meta revisa cada plantilla antes de que puedas usarla. Suele tardar menos de un día.</p>
        </aside>
        <EditorPlantilla key={actual?.id ?? "nueva"} p={actual} puede={puede} />
      </div>
      <MensajesEnviados datos={envios as Envios | null} />
    </>
  );
}

type Envios = {
  conteos: { total: number; entregados: number; leidos: number; fallidos: number };
  autorizados: number;
  ultimos: { creado: string; tipo: string; plantilla: string; para: string; estado: string; error: string | null }[];
};

const TIPO_ENVIO: Record<string, string> = { aviso_equipo: "Aviso al equipo", campana: "Campaña", cobro: "Cobro", prueba: "Prueba", otro: "Otro" };
const ESTADO_ENVIO: Record<string, { texto: string; tono: "ok" | "error" | "info" | "neutro" }> = {
  enviado: { texto: "Enviado", tono: "neutro" },
  entregado: { texto: "Entregado", tono: "info" },
  leido: { texto: "Leído", tono: "ok" },
  fallido: { texto: "Falló", tono: "error" },
};

/** Lo que salió por WhatsApp en 30 días (avisos, cobros y campañas) y su estado según Meta. */
function MensajesEnviados({ datos }: { datos: Envios | null }) {
  if (!datos) return null;
  const c = datos.conteos;
  return (
    <section className="mt-5 rounded-2xl border border-borde bg-elevada p-4 md:p-6">
      <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">Mensajes enviados</h2>
      <p className="mt-0.5 text-sm text-tenue">
        Últimos 30 días · {datos.autorizados} {datos.autorizados === 1 ? "persona autorizó" : "personas autorizaron"} WhatsApp
      </p>
      <dl className="my-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Enviados", c.total],
          ["Entregados", c.entregados],
          ["Leídos", c.leidos],
          ["Fallidos", c.fallidos],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-mosaico px-3 py-2">
            <dt className="text-[13px] text-cuerpo">{k}</dt>
            <dd className="text-xl font-bold">{Number(v).toLocaleString("es-CO")}</dd>
          </div>
        ))}
      </dl>
      {datos.ultimos.length === 0 ? (
        <p className="text-sm text-tenue">Aún no sale ningún mensaje. Asigna plantillas en Ajustes de la plataforma → Envíos.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Tipo</th>
                <th>Plantilla</th>
                <th>Para</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {datos.ultimos.map((m, i) => (
                <tr key={i}>
                  <td className="text-cuerpo">{formatearMomento(m.creado)}</td>
                  <td>{TIPO_ENVIO[m.tipo] ?? m.tipo}</td>
                  <td className="font-mono text-[13px]">{m.plantilla}</td>
                  <td className="text-cuerpo">{m.para}</td>
                  <td title={m.error ?? undefined}>
                    <Chip tono={ESTADO_ENVIO[m.estado]?.tono ?? "neutro"}>{ESTADO_ENVIO[m.estado]?.texto ?? m.estado}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
