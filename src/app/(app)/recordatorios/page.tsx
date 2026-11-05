import Link from "next/link";
import { Chip, Tarjeta, Titulo, cx } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { formatearCOP } from "@/lib/dinero";
import { formatearMes, hoy, sumarDias } from "@/lib/fechas";
import { ETIQUETA_FRECUENCIA } from "@/lib/recurrentes";
import { proximaFecha, textoAviso } from "@/lib/recordatorios";
import { cambiarRecordatorio } from "./acciones";
import { FormularioRecordatorio } from "./formulario";

export const metadata = { title: "Recordatorios" };

export default function Recordatorios() {
  return (
    <>
      <Link href="/recurrentes" className="mb-1 inline-block text-[13px] font-semibold text-cuerpo hover:underline">
        ← Pagos fijos
      </Link>
      <Titulo subtitulo="Las fechas importantes, para que nada se venza">Recordatorios de pago</Titulo>
      <Contenido />
    </>
  );
}

type Item = { clave: string; id: string; tipo: "recordatorio" | "regla"; fecha: string; nombre: string; detalle: string; cuando: string; por: string; monto: number | null; activo: boolean };

const CANALES: Record<string, string> = { whatsapp: "WhatsApp", correo: "Correo", notificacion: "Notificación" };
const REPETIR: Record<string, string> = { una_vez: "Una vez", mensual: "Cada mes", anual: "Cada año" };
const mesCorto = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" });

async function Contenido() {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const fecha = hoy();
  const [{ data: recordatorios }, { data: reglas }] = await Promise.all([
    ctx.supabase.from("reminders").select("id, nombre, fecha, monto, repetir, avisos, canales, activo"),
    ctx.supabase.from("recurring_rules").select("id, descripcion, monto, frecuencia, proxima_fecha, recordar").eq("activa", true).eq("tipo", "gasto"),
  ]);
  const items: Item[] = [
    ...(recordatorios ?? []).map((r) => ({
      clave: `r-${r.id}`,
      id: r.id,
      tipo: "recordatorio" as const,
      fecha: proximaFecha(r.fecha, r.repetir, fecha),
      nombre: r.nombre,
      detalle: REPETIR[r.repetir],
      cuando: r.avisos.map(textoAviso).join(", "),
      por: r.canales.map((c) => CANALES[c] ?? c).join(" y "),
      monto: r.monto,
      activo: r.activo,
    })),
    ...(reglas ?? []).map((r) => ({
      clave: `g-${r.id}`,
      id: r.id,
      tipo: "regla" as const,
      fecha: r.proxima_fecha,
      nombre: r.descripcion,
      detalle: `${ETIQUETA_FRECUENCIA[r.frecuencia]} · pago fijo`,
      cuando: "1 día antes",
      por: "Notificación",
      monto: r.monto,
      activo: r.recordar,
    })),
  ]
    .filter((i) => i.fecha >= fecha || i.tipo === "regla")
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const grupos = Map.groupBy(items, (i) => (i.fecha.slice(0, 4) === fecha.slice(0, 4) ? i.fecha.slice(0, 7) : i.fecha.slice(0, 4)));
  const pronto = sumarDias(fecha, 7);

  return (
    <div className="grid grid-cols-1 items-start gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <section aria-label="Próximas fechas" className="rounded-2xl border border-borde bg-elevada px-4 pt-2 pb-4 md:px-6">
        {items.length === 0 && <p className="py-6 text-sm text-tenue">Aún no hay fechas. Crea un recordatorio o un pago fijo.</p>}
        {[...grupos.entries()].map(([grupo, lista]) => (
          <div key={grupo}>
            <p className="mt-[18px] mb-1 text-xs leading-4 font-bold tracking-[0.12em] uppercase first-letter:uppercase">
              {grupo.length === 4 ? grupo : formatearMes(grupo).replace(/ de \d{4}$/, "")}
            </p>
            {lista.map((r) => {
              const cerca = r.fecha <= pronto && r.activo;
              return (
                <div key={r.clave} className={cx("flex min-h-[76px] flex-wrap items-center gap-3.5 border-b border-divisor py-2.5 last:border-b-0", !r.activo && "opacity-60")}>
                  <div className={cx("flex size-14 shrink-0 flex-col items-center justify-center rounded-xl", cerca ? "bg-monte text-arena" : "bg-mosaico text-tinta")}>
                    <b className="text-[22px] leading-none">{Number(r.fecha.slice(8))}</b>
                    <span className="text-xs font-semibold">{mesCorto.format(new Date(`${r.fecha}T00:00:00Z`)).replace(".", "")}</span>
                  </div>
                  <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
                    <b className="text-[15px]">{r.nombre}</b>
                    <span className="text-[13px] text-cuerpo">{r.detalle}</span>
                    <span className="flex flex-wrap gap-1.5">
                      <Chip plano>{r.cuando}</Chip>
                      <Chip plano>{r.por}</Chip>
                    </span>
                  </div>
                  <b className="min-w-[110px] text-right text-[15px]">{r.monto ? formatearCOP(r.monto) : "Por definir"}</b>
                  {ctx.puedeEditar && (
                    <form action={cambiarRecordatorio}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="tipo" value={r.tipo} />
                      <input type="hidden" name="activo" value={r.activo ? "0" : "1"} />
                      <button
                        type="submit"
                        role="switch"
                        aria-checked={r.activo}
                        aria-label={`Recordatorio de ${r.nombre}`}
                        className={cx(
                          "relative h-[26px] w-11 shrink-0 rounded-full border transition",
                          r.activo ? "border-monte bg-monte" : "border-control bg-pista",
                        )}
                      >
                        <span className={cx("absolute top-0.5 size-5 rounded-full bg-white transition-all", r.activo ? "left-5" : "left-0.5 shadow-[0_0_0_1px_var(--color-control)]")} />
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <aside className="flex min-w-0 flex-col gap-4">
        {ctx.puedeEditar && (
          <Tarjeta titulo="Nuevo recordatorio">
            <FormularioRecordatorio />
          </Tarjeta>
        )}
        <Tarjeta titulo="Así llega el aviso">
          <div className="rounded-[14px] bg-[#e9f3ee] p-3">
            <div className="rounded-[12px_12px_12px_4px] bg-elevada px-3 py-2.5 text-sm leading-5 shadow-[0_1px_0_#d6e3dd]">
              <b>My House</b>
              <br />
              Hola {ctx.miembro.nombre.split(" ")[0]}. {items[0] ? `El ${Number(items[0].fecha.slice(8))} vence ${items[0].nombre}` : "Mañana vence un pago"}
              {items[0]?.monto ? ` por ${formatearCOP(items[0].monto)}` : ""}. Márcalo como pagado en Pagos fijos cuando lo pagues.
              <div className="text-right text-[13px] text-tenue">7:00 a. m.</div>
            </div>
          </div>
          <p className="mt-3 text-[13px] text-tenue">
            Los avisos por notificación, WhatsApp y correo se activan cuando se conecten esos canales en el despliegue; las
            fechas y preferencias ya quedan guardadas.
          </p>
        </Tarjeta>
      </aside>
    </div>
  );
}
