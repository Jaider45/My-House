import Link from "next/link";
import { AreaTexto, Chip, EnlaceBoton, Tarjeta, type Tono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioEstado } from "@/components/ui/formulario-estado";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { pedirAccesoFinanzas } from "../acciones";

type Acceso = { id: string; staff_nombre: string; motivo: string; horas: number; estado: string; pedido_en: string; vence: string | null; mio: boolean };

const ESTADO: Record<string, { texto: string; tono: Tono }> = {
  pedido: { texto: "Esperando al administrador", tono: "alerta" },
  aprobado: { texto: "Vigente", tono: "ok" },
  rechazado: { texto: "Rechazado", tono: "error" },
  revocado: { texto: "Revocado", tono: "neutro" },
  vencido: { texto: "Vencido", tono: "neutro" },
};

/** Datos financieros del hogar: solo con permiso de su administrador (pedir, esperar, ver mientras esté vigente). */
export async function AccesoFinanzas({ hogar, puede }: { hogar: string; puede: boolean }) {
  const staff = await obtenerStaff();
  const { data } = await staff.supabase.rpc("consola_accesos", { p_hogar: hogar });
  const accesos = (data ?? []) as unknown as Acceso[];
  const mio = accesos.find((a) => a.mio && (a.estado === "pedido" || a.estado === "aprobado"));

  return (
    <Tarjeta titulo="Datos financieros" subtitulo="Nadie del equipo los ve sin permiso del administrador del hogar">
      {mio?.estado === "aprobado" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ok-tinta">Tienes acceso hasta: {formatearMomento(mio.vence).toLowerCase()}. Cada vista queda en la auditoría.</p>
          <EnlaceBoton href={`/consola/hogares/${hogar}/finanzas`} className="self-start">
            Ver datos financieros
          </EnlaceBoton>
        </div>
      ) : mio?.estado === "pedido" ? (
        <p className="rounded-xl bg-alerta-fondo p-3 text-sm text-alerta-tinta">Pediste acceso {formatearMomento(mio.pedido_en).toLowerCase()}: el administrador lo verá al abrir la app.</p>
      ) : puede ? (
        <FormularioEstado accion={pedirAccesoFinanzas} className="flex flex-col gap-3">
          <input type="hidden" name="hogar" value={hogar} />
          <AreaTexto etiqueta="Motivo (lo verá el administrador)" name="motivo" rows={2} minLength={10} maxLength={300} required placeholder="Revisar el movimiento duplicado que reportaste en el ticket #128" />
          <label className="flex items-center justify-between gap-3 text-sm">
            Duración
            <select name="horas" defaultValue="24" className="h-9 rounded-lg border border-control bg-elevada px-2 text-sm">
              <option value="2">2 horas</option>
              <option value="24">24 horas</option>
              <option value="72">3 días</option>
            </select>
          </label>
          <BotonEnviar variante="secundario" className="self-start" pendiente="Enviando…">
            Pedir permiso
          </BotonEnviar>
        </FormularioEstado>
      ) : (
        <p className="text-sm text-tenue">Tu rol no puede pedir acceso a datos financieros (solo Soporte y superadmin).</p>
      )}
      {accesos.length > 0 && (
        <ul className="mt-3 flex flex-col border-t border-divisor pt-2">
          {accesos.slice(0, 5).map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-2 py-1.5 text-[13px]">
              <span className="min-w-0">
                <b>{a.staff_nombre}</b> · {formatearMomento(a.pedido_en)} · <span className="text-tenue">{a.motivo}</span>
              </span>
              <Chip tono={ESTADO[a.estado]?.tono ?? "neutro"}>{ESTADO[a.estado]?.texto ?? a.estado}</Chip>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[13px] text-tenue">
        Las vistas quedan en{" "}
        <Link href="/consola/privacidad" className="underline">
          Privacidad y auditoría
        </Link>
        .
      </p>
    </Tarjeta>
  );
}
