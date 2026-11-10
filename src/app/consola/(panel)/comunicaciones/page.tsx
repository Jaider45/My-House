import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Chip, Tarjeta, Titulo, type Tono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { TarjetaTabla } from "../tarjeta-tabla";
import { cancelarCampana } from "./acciones";
import { FormularioCampana } from "./campana";
import { SEGMENTOS, type Segmentos } from "./segmentos";

export const metadata: Metadata = { title: "Comunicaciones" };

const NOMBRES: Record<string, string> = {
  invitacion: "Invitación al hogar",
  contador: "Acceso de contador",
  equipo: "Invitación al equipo",
  seguridad: "Nuevo inicio de sesión",
  bienvenida: "Bienvenida",
  recordatorio: "Recordatorio de pago",
  vencido: "Pago fijo vencido",
  resumen: "Resumen semanal",
  dian: "Aviso Renta DIAN",
  "pago-recibido": "Pago recibido (plan)",
  "cobro-renovacion": "Renovación del plan",
  "cobro-mora": "Pago del plan pendiente",
  "cobro-gratis": "Pasó al plan Gratis",
  "cobro-cancelada": "Suscripción cancelada",
  "cobro-prueba": "Prueba por terminar",
  campana: "Campañas",
  "campana-prueba": "Pruebas de campaña",
  prueba: "Correo de prueba",
  otro: "Otros",
};

const ESTADO_CAMPANA: Record<string, { texto: string; tono: Tono }> = {
  borrador: { texto: "Borrador", tono: "neutro" },
  programada: { texto: "Programada", tono: "alerta" },
  enviando: { texto: "Enviando…", tono: "info" },
  enviada: { texto: "Enviada", tono: "ok" },
  cancelada: { texto: "Cancelada", tono: "neutro" },
};

const pct = (parte: number, total: number) => (total ? `${Math.round((100 * parte) / total)} %` : "—");

export default async function ComunicacionesConsola({ searchParams }: PageProps<"/consola/comunicaciones">) {
  const staff = await obtenerStaff();
  const puede = staff.puede("campanas");
  const { campana: editar } = await searchParams;
  const [correos, campanas, segmentos] = await Promise.all([
    staff.supabase.rpc("consola_correos_resumen"),
    puede ? staff.supabase.rpc("consola_campanas") : Promise.resolve({ data: [], error: null }),
    puede ? staff.supabase.rpc("consola_segmentos") : Promise.resolve({ data: {}, error: null }),
  ]);
  const lista = campanas.data ?? [];
  const editando = typeof editar === "string" ? lista.find((c) => c.id === editar && ["borrador", "programada", "cancelada"].includes(c.estado)) : undefined;
  const conWebhook = (correos.data ?? []).some((c) => c.entregados > 0 || c.abiertos > 0);

  return (
    <>
      <Titulo registrar={false} subtitulo="Correos automáticos y campañas por segmento">
        Comunicaciones
      </Titulo>
      {(correos.error || campanas.error) && <Aviso>{mensajeError(correos.error ?? campanas.error)}</Aviso>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <TarjetaTabla
            titulo="Correos de los últimos 30 días"
            subtitulo={conWebhook ? "Entregas, aperturas y clics según Resend" : "Aperturas y clics llegan al conectar el webhook de Resend (Integraciones → Correo)"}
          >
            {(correos.data ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-tenue md:px-6">Aún no se han enviado correos.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="pl-4! md:pl-6!">Correo</th>
                    <th className="der">Enviados</th>
                    <th className="der">Entregados</th>
                    <th className="der">Abiertos</th>
                    <th className="der">Clics</th>
                    <th className="der">Rebotes</th>
                    <th className="pr-4! md:pr-6!">Último</th>
                  </tr>
                </thead>
                <tbody>
                  {correos.data!.map((c) => (
                    <tr key={c.etiqueta}>
                      <td className="pl-4! font-bold md:pl-6!">{NOMBRES[c.etiqueta] ?? c.etiqueta}</td>
                      <td className="der">{c.enviados}</td>
                      <td className="der">{pct(c.entregados, c.enviados)}</td>
                      <td className="der">{pct(c.abiertos, c.enviados)}</td>
                      <td className="der">{pct(c.clics, c.enviados)}</td>
                      <td className="der">{c.rebotados || "—"}</td>
                      <td className="pr-4! text-cuerpo md:pr-6!">{formatearMomento(c.ultimo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TarjetaTabla>

          <TarjetaTabla titulo="Campañas" subtitulo="Programadas y enviadas · solo a hogares con «Novedades» activo">
            {lista.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-tenue md:px-6">Aún no hay campañas.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="pl-4! md:pl-6!">Campaña</th>
                    <th>Segmento</th>
                    <th>Envío</th>
                    <th className="der">Alcance</th>
                    <th>Estado</th>
                    <th className="pr-4! md:pr-6!">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={c.id}>
                      <td className="pl-4! md:pl-6!">
                        <span className="flex flex-col leading-[18px]">
                          <b>{c.nombre}</b>
                          <small className="text-xs text-tenue">{c.asunto}</small>
                        </span>
                      </td>
                      <td className="text-cuerpo">{SEGMENTOS.find((s) => s.valor === c.segmento)?.texto ?? c.segmento}</td>
                      <td className="text-cuerpo">{c.estado === "enviada" ? formatearMomento(c.enviada_en) : c.programada_para ? formatearMomento(c.programada_para) : "—"}</td>
                      <td className="der">{c.estado === "enviada" ? `${c.enviados} correos · ${c.alcance} hogares` : "—"}</td>
                      <td>
                        <Chip tono={ESTADO_CAMPANA[c.estado]?.tono}>{ESTADO_CAMPANA[c.estado]?.texto ?? c.estado}</Chip>
                      </td>
                      <td className="pr-4! md:pr-6!">
                        {puede && ["borrador", "programada", "cancelada"].includes(c.estado) && (
                          <span className="inline-flex items-center gap-2">
                            <Link href={`/consola/comunicaciones?campana=${c.id}#campana`} className="text-sm font-semibold underline-offset-4 hover:underline">
                              Editar
                            </Link>
                            {c.estado !== "cancelada" && (
                              <FormularioAccion accion={cancelarCampana} className="inline-flex">
                                <input type="hidden" name="id" value={c.id} />
                                <BotonEnviar variante="fantasma" className="h-8 px-2 text-sm" pendiente="…">
                                  Cancelar
                                </BotonEnviar>
                              </FormularioAccion>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TarjetaTabla>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {puede ? (
            <Tarjeta
              id="campana"
              titulo={editando ? `Editar «${editando.nombre}»` : "Nueva campaña"}
              accion={
                editando ? (
                  <Link href="/consola/comunicaciones#campana" className="text-sm font-semibold">
                    Nueva
                  </Link>
                ) : undefined
              }
            >
              <FormularioCampana campana={editando} segmentos={(segmentos.data ?? {}) as Segmentos} />
            </Tarjeta>
          ) : (
            <Aviso tipo="info">Crear campañas es del rol Contenido o un superadmin.</Aviso>
          )}
          <Tarjeta titulo="WhatsApp">
            <p className="text-sm text-cuerpo">
              Las campañas por WhatsApp llegan cuando Meta apruebe las plantillas (Integraciones → WhatsApp). Por ahora las campañas salen por correo.
            </p>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
