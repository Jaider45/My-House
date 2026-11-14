import Link from "next/link";
import { Chip, EnlaceBoton, Tarjeta, Titulo } from "@/components/ui";
import { Ventana } from "@/components/ui/ventana";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { Palanca } from "@/components/ui/interruptor";
import { obtenerContexto } from "@/lib/sesion";
import { leerConfigHogar } from "@/lib/hogar";
import { formatearFecha } from "@/lib/fechas";
import { fechaVersion, VERSION_LEGAL } from "@/lib/legal/responsable";
import { cambiarNovedades, cambiarResumenSemanal } from "../../recordatorios/acciones";
import { FormularioPrivacidad } from "../configuracion";
import { PestanasConfiguracion } from "../pestanas";

export const metadata = { title: "Privacidad y datos" };

const DOCUMENTO: Record<string, string> = { terminos: "Términos y condiciones", politica_datos: "Política de tratamiento de datos" };

/** Interruptor que se envía solo (preferencias de correo del hogar). */
function Preferencia({ accion, activo, titulo, texto, puede }: { accion: Parameters<typeof FormularioAccion>[0]["accion"]; activo: boolean; titulo: string; texto: string; puede: boolean }) {
  return (
    <FormularioAccion accion={accion} className="flex min-h-14 items-center justify-between gap-3 border-b border-divisor py-2 last:border-0">
      <input type="hidden" name="activo" value={activo ? "0" : "1"} />
      <span className="text-sm">
        <b className="block">{titulo}</b>
        <span className="text-[13px] text-tenue">{texto}</span>
      </span>
      <button type="submit" role="switch" aria-checked={activo} aria-label={titulo} disabled={!puede} className="rounded-full disabled:opacity-50">
        <Palanca activo={activo} />
      </button>
    </FormularioAccion>
  );
}

/** Configuración → Privacidad y datos: lo que aceptó, qué recibe y lo que puede pedir (Ley 1581 de 2012). */
export default async function Privacidad() {
  const ctx = await obtenerContexto();
  const [{ data: hogar }, { data: consentimientos }] = await Promise.all([
    ctx.supabase.from("households").select("config").eq("id", ctx.hogar.id).single(),
    ctx.supabase.from("consentimientos").select("tipo, version, aceptado, created_at").order("created_at", { ascending: false }),
  ]);
  const config = leerConfigHogar(hogar?.config);
  // El documento vigente que aceptó (el más reciente de cada tipo).
  const aceptados = (["terminos", "politica_datos"] as const).map((t) => ({ tipo: t, fila: consentimientos?.find((c) => c.tipo === t && c.aceptado) }));

  return (
    <>
      <Titulo subtitulo="Lo que aceptaste, lo que recibes y lo que puedes pedir sobre tus datos">Configuración</Titulo>
      <PestanasConfiguracion actual="/ajustes/privacidad" />
      <div className="grid items-start gap-4 md:gap-5 lg:grid-cols-2">
        <Tarjeta titulo="Documentos que aceptaste" subtitulo="Si cambian, te pedimos aceptarlos de nuevo al entrar">
          <div className="flex flex-col gap-2.5">
            {aceptados.map(({ tipo, fila }) => (
              <Link key={tipo} href={tipo === "terminos" ? "/terminos" : "/privacidad"} className="flex items-center justify-between gap-3 rounded-xl border border-borde px-3.5 py-3 hover:bg-mosaico">
                <span>
                  <b className="text-sm">{DOCUMENTO[tipo]}</b>
                  <br />
                  <span className="text-[13px] text-tenue">
                    Versión {fechaVersion(fila?.version ?? VERSION_LEGAL)}
                    {fila ? ` · aceptada el ${formatearFecha(fila.created_at.slice(0, 10))}` : " · aceptada al crear tu cuenta"}
                  </span>
                </span>
                <span aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Qué te enviamos" subtitulo="Preferencias de correo del hogar">
          <div className="flex flex-col">
            <div className="flex min-h-14 items-center justify-between gap-3 border-b border-divisor py-2">
              <span className="text-sm">
                <b className="block">Avisos de pagos y seguridad</b>
                <span className="text-[13px] text-tenue">Necesarios para que la app funcione</span>
              </span>
              <Chip plano>Siempre</Chip>
            </div>
            <Preferencia accion={cambiarNovedades} activo={config.correo.novedades} titulo="Consejos, novedades y ofertas" texto="Por correo" puede={ctx.esAdmin} />
            <Preferencia accion={cambiarResumenSemanal} activo={config.correo.resumen_semanal} titulo="Resumen semanal" texto="Lunes, 7:00 a. m." puede={ctx.esAdmin} />
            {!ctx.esAdmin && <p className="pt-2 text-[13px] text-tenue">Estas preferencias las cambia quien administra el hogar.</p>}
            <p className="pt-2 text-[13px] text-tenue">
              Los avisos por WhatsApp se activan con tu celular en{" "}
              <Link href="/ajustes/seguridad#contacto" className="font-semibold text-tinta underline">
                Seguridad
              </Link>
              .
            </p>
          </div>
        </Tarjeta>

        <div className="lg:col-span-2">
          <Tarjeta titulo="Tus derechos sobre tus datos" subtitulo="Ley 1581 de 2012">
            <div className="flex flex-wrap gap-2.5">
              <a href="/api/mis-datos" download className="inline-flex h-11 items-center rounded-[10px] border border-cuerpo px-4 text-[15px] font-semibold hover:bg-mosaico">
                Descargar mis datos
              </a>
              <EnlaceBoton href="/ajustes/privacidad?nuevo=consulta" variante="secundario" scroll={false}>
                Hacer una consulta o reclamo
              </EnlaceBoton>
              <EnlaceBoton href="/ajustes/privacidad?nuevo=revocar" variante="fantasma" scroll={false}>
                Revocar la autorización
              </EnlaceBoton>
              <EnlaceBoton href="/ajustes/privacidad?nuevo=eliminar" variante="fantasma" scroll={false} className="text-error-tinta md:ml-auto">
                Eliminar mi cuenta
              </EnlaceBoton>
            </div>
            <p className="mt-3 text-[13px] text-tenue">
              Respondemos consultas en máximo 10 días hábiles y reclamos en 15. Si revocas la autorización, no podremos seguir guardando los datos del hogar y tu cuenta se cerrará. Sigue tus
              solicitudes en{" "}
              <Link href="/ayuda" className="font-semibold text-tinta underline">
                Ayuda
              </Link>
              .
            </p>
          </Tarjeta>
        </div>
      </div>

      <Ventana titulo="Consulta o reclamo sobre tus datos" subtitulo="Ley 1581 de 2012" valor="consulta">
        <FormularioPrivacidad tipo="consulta" />
      </Ventana>
      <Ventana titulo="Revocar la autorización" subtitulo="Dejar de autorizar el tratamiento de tus datos" valor="revocar">
        <FormularioPrivacidad tipo="revocatoria" />
      </Ventana>
      <Ventana titulo="Eliminar mi cuenta" subtitulo="Esto no se puede deshacer" valor="eliminar">
        <FormularioPrivacidad tipo="supresion" />
      </Ventana>
    </>
  );
}
