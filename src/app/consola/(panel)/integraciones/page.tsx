import type { Metadata } from "next";
import { Aviso, Titulo } from "@/components/ui";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { INTEGRACIONES } from "@/lib/integraciones/catalogo";
import { desdeEntorno } from "@/lib/integraciones/servidor";
import { sitio } from "@/lib/correo/enviar";
import { TarjetaIntegracion, type Guardada } from "./tarjeta";

export const metadata: Metadata = { title: "Integraciones" };

const CATEGORIAS = ["Correo", "Pagos", "Mensajería", "Inteligencia artificial"] as const;

export default async function IntegracionesConsola() {
  const staff = await obtenerStaff();
  if (!staff.puede("sistema")) {
    return (
      <>
        <Titulo registrar={false}>Integraciones</Titulo>
        <Aviso tipo="info">Solo un superadmin conecta y cambia integraciones.</Aviso>
      </>
    );
  }
  const { data, error } = await staff.supabase.rpc("consola_integraciones");
  const porProveedor = new Map((data ?? []).map((i) => [i.proveedor, i]));

  return (
    <>
      <Titulo registrar={false} subtitulo="Conecta y cambia los servicios sin tocar código. Los secretos se guardan cifrados y nadie puede volver a verlos.">
        Integraciones
      </Titulo>
      {error && <Aviso>{mensajeError(error)}</Aviso>}
      <p className="mb-5 text-sm text-cuerpo">
        Al conectar se prueba la conexión con el proveedor. Un cambio tarda hasta un minuto en llegar a todos los servidores. Cada conexión, cambio o desconexión
        queda en la auditoría (sin los valores).
      </p>
      <div className="flex flex-col gap-6">
        {CATEGORIAS.map((cat) => (
          <section key={cat} aria-label={cat}>
            <h2 className="mb-3 text-[13px] font-bold tracking-[0.06em] text-tenue uppercase">{cat}</h2>
            <div className="grid items-start gap-5 xl:grid-cols-2">
              {INTEGRACIONES.filter((i) => i.categoria === cat).map((def) => {
                const g = porProveedor.get(def.proveedor);
                const guardada: Guardada = g
                  ? {
                      config: (g.config ?? {}) as Record<string, string>,
                      secretos: (g.secretos ?? {}) as Record<string, { ultimos: string }>,
                      verificada_en: g.verificada_en,
                      verificacion: g.verificacion as { ok: boolean; detalle: string } | null,
                      ultimo_evento: g.ultimo_evento,
                      actualizada: g.actualizada_en,
                    }
                  : null;
                return (
                  <TarjetaIntegracion
                    key={def.proveedor}
                    def={def}
                    guardada={guardada}
                    enEntorno={desdeEntorno(def.proveedor) !== null}
                    webhook={def.webhook ? `${sitio()}${def.webhook}` : null}
                    verificada={g?.verificada_en ? formatearMomento(g.verificada_en) : null}
                    evento={g?.ultimo_evento ? formatearMomento(g.ultimo_evento) : null}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
