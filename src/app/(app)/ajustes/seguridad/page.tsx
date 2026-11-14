import { Aviso, Boton, Tarjeta, Titulo } from "@/components/ui";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { obtenerContexto } from "@/lib/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { cerrarSesion } from "@/app/(auth)/acciones";
import { cerrarOtrasSesiones } from "../acciones";
import { FormularioCelular } from "./celular";
import { Contrasena, EstadoDosPasos } from "./componentes";
import { PestanasConfiguracion } from "@/app/(app)/ajustes/pestanas";
import { BotonGuia } from "@/components/guia/boton-guia";

export const metadata = { title: "Seguridad" };

export default async function Seguridad({ searchParams }: { searchParams: Promise<{ exigida?: string }> }) {
  const { exigida } = await searchParams;
  const ctx = await obtenerContexto();
  // El último ingreso solo lo sabe Auth (una consulta; el JWT no lo trae).
  const [{ data: auth }, { data: contacto }] = await Promise.all([
    ctx.supabase.auth.getUser(),
    ctx.supabase.from("contactos").select("telefono, whatsapp").eq("user_id", ctx.userId).maybeSingle(),
  ]);
  return (
    <>
      <Titulo subtitulo="El hogar, quién entra, con qué cuentas y con qué valores" accion={<BotonGuia id="dos_pasos">Cómo activar dos pasos</BotonGuia>}>
        Configuración
      </Titulo>
      <PestanasConfiguracion actual="/ajustes/seguridad" />
      {exigida && (
        <div className="mb-4">
          <Aviso tipo="info">
            My House pide la verificación en dos pasos a quien administra un hogar. Actívala para seguir usando la app: protege los datos de toda tu familia.
          </Aviso>
        </div>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Contraseña">
          <Contrasena />
        </Tarjeta>
        <Tarjeta guia="dos-pasos" titulo="Verificación en dos pasos">
          <EstadoDosPasos />
        </Tarjeta>
        <Tarjeta id="contacto" titulo="Tu celular" subtitulo="Para avisarte por WhatsApp; nunca lo compartimos">
          <FormularioCelular telefono={contacto?.telefono ?? null} whatsapp={contacto?.whatsapp ?? false} />
        </Tarjeta>
        <Tarjeta titulo="Sesiones" subtitulo="Dónde está abierta tu cuenta">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-cuerpo">
              Tu cuenta: <b>{auth.user?.email ?? ctx.email}</b>
              {auth.user?.last_sign_in_at && (
                <>
                  <br />
                  Último ingreso: {formatearMomento(auth.user.last_sign_in_at)}
                </>
              )}
            </p>
            <p className="text-[13px] text-tenue">Si entras desde un navegador nuevo te avisamos por correo («¿Fuiste tú?»).</p>
            <FormularioAccion accion={cerrarOtrasSesiones} className="flex flex-col gap-2">
              <BotonEnviar variante="secundario" pendiente="Cerrando…">
                Cerrar sesión en los otros dispositivos
              </BotonEnviar>
            </FormularioAccion>
            <form action={cerrarSesion}>
              <Boton type="submit" variante="fantasma" className="w-full">
                Cerrar sesión aquí
              </Boton>
            </form>
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
