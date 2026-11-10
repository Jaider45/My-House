import type { Metadata } from "next";
import Link from "next/link";
import { Icono, type NombreIcono } from "@/components/marca";
import { Aviso, Tarjeta, Titulo } from "@/components/ui";
import { obtenerStaff } from "@/lib/consola/sesion";
import { describirAccion } from "@/lib/consola/auditoria";
import { formatearMomento } from "@/lib/consola/formato";
import { formatearFechaLarga, hoy } from "@/lib/fechas";

export const metadata: Metadata = { title: "Panel general" };

const FASES: { fase: string; texto: string }[] = [
  { fase: "S2", texto: "Planes y límites, Hogares y Usuarios" },
  { fase: "S3", texto: "Cobro con Wompi, cupones y factura electrónica" },
  { fase: "S4", texto: "MRR, conversión, churn, cohortes y campañas" },
  { fase: "S5", texto: "Contadores, referidos y comisiones" },
  { fase: "S6", texto: "Parámetros DIAN, catálogos e IA" },
  { fase: "S7", texto: "Soporte y solicitudes Ley 1581" },
  { fase: "S8", texto: "Feature flags y mantenimiento" },
];

function Acceso({ href, icono, titulo, texto }: { href: string; icono: NombreIcono; titulo: string; texto: string }) {
  return (
    <Link href={href} className="flex items-start gap-3 rounded-2xl border border-borde bg-elevada p-4 hover:border-cuerpo md:p-5">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-mosaico">
        <Icono nombre={icono} tamano={22} />
      </span>
      <span>
        <b className="block text-[15px]">{titulo}</b>
        <span className="text-sm text-cuerpo">{texto}</span>
      </span>
    </Link>
  );
}

export default async function PanelConsola() {
  const staff = await obtenerStaff();
  const verAuditoria = staff.puede("auditoria");
  const [equipo, actividad] = await Promise.all([
    staff.supabase.rpc("consola_equipo"),
    verAuditoria ? staff.supabase.rpc("consola_auditoria", { p_limite: 8 }) : Promise.resolve({ data: null, error: null }),
  ]);
  const activas = (equipo.data ?? []).filter((p) => p.activo).length;

  return (
    <>
      <Titulo registrar={false} subtitulo={`Cómo va My House hoy, ${formatearFechaLarga(hoy())}`}>
        Panel general
      </Titulo>
      <div className="flex flex-col gap-5">
        <Aviso tipo="info">
          Las métricas del negocio (MRR, hogares activos, conversión y churn) aparecen aquí cuando lleguen los planes y cobros.
        </Aviso>

        <div className="grid gap-4 md:grid-cols-2">
          <Acceso href="/consola/equipo" icono="certificados" titulo="Equipo y permisos" texto={`${activas} ${activas === 1 ? "persona activa" : "personas activas"} en la consola`} />
          <Acceso href="/consola/privacidad" icono="documentos" titulo="Privacidad y auditoría" texto="Registro de todo lo que hace el equipo" />
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          {verAuditoria ? (
            <Tarjeta titulo="Actividad reciente" subtitulo="Acciones del equipo" accion={<Link href="/consola/privacidad" className="text-sm font-semibold">Ver todo</Link>}>
              {(actividad.data ?? []).length === 0 ? (
                <p className="text-sm text-tenue">Aún no hay actividad.</p>
              ) : (
                <ul className="flex flex-col">
                  {actividad.data!.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 border-b border-divisor py-3 text-sm last:border-0">
                      <span aria-hidden className="mt-[5px] size-2.5 shrink-0 rounded-full bg-ok" />
                      <span>
                        <b>{a.quien_nombre}</b> · {describirAccion(a)}
                      </span>
                      <span className="ml-auto pl-3 text-xs whitespace-nowrap text-tenue">{formatearMomento(a.creada)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          ) : (
            <span className="hidden xl:block" />
          )}
          <Tarjeta titulo="Lo que viene" subtitulo="Roadmap SaaS (docs/ROADMAP-SAAS.md)">
            <ul className="flex flex-col">
              {FASES.map((f) => (
                <li key={f.fase} className="flex items-center gap-3 border-b border-divisor py-2.5 text-sm last:border-0">
                  <span className="inline-flex h-6 min-w-9 items-center justify-center rounded-full bg-mosaico px-2 text-xs font-bold">{f.fase}</span>
                  {f.texto}
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
