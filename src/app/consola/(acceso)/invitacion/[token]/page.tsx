import type { Metadata } from "next";
import { EnlaceBoton } from "@/components/ui";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { crearClienteServidor } from "@/lib/supabase/server";
import { nombreRol } from "@/lib/consola/permisos";
import { aceptarInvitacionConsola } from "./acciones";

export const metadata: Metadata = { title: "Invitación al equipo" };

function Mensaje({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div>
      <h1 className="text-[28px] leading-[34px] font-bold">{titulo}</h1>
      <p className="mt-1.5 text-[15px] leading-[22px] text-cuerpo">{texto}</p>
    </div>
  );
}

export default async function InvitacionConsola({ params }: PageProps<"/consola/invitacion/[token]">) {
  const { token } = await params;
  const supabase = await crearClienteServidor();
  const [{ data: inv }, { data: sesion }] = await Promise.all([
    /^[0-9a-f]{64}$/.test(token) ? supabase.rpc("consola_ver_invitacion", { p_token: token }).maybeSingle() : Promise.resolve({ data: null }),
    supabase.auth.getClaims(),
  ]);

  if (!inv) return <Mensaje titulo="Invitación no disponible" texto="El enlace no existe o ya se usó. Pide a quien te invitó que te envíe uno nuevo." />;
  if (inv.vencida) return <Mensaje titulo="La invitación venció" texto="Pide a quien te invitó que te envíe una nueva." />;

  const aqui = `/consola/invitacion/${token}`;
  const correo = sesion?.claims?.email as string | undefined;
  return (
    <div className="flex flex-col gap-[18px]">
      <Mensaje
        titulo={`Hola, ${inv.nombre}`}
        texto={`Te invitaron al equipo de My House con el rol ${nombreRol(inv.rol)}. La invitación es para ${inv.email}.`}
      />
      {correo ? (
        <FormularioAccion accion={aceptarInvitacionConsola} className="flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-cuerpo">Vas a aceptar con la cuenta {correo}. Luego activarás la verificación en dos pasos.</p>
          <BotonEnviar className="h-12 w-full" pendiente="Aceptando…">
            Aceptar y entrar a la consola
          </BotonEnviar>
        </FormularioAccion>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-cuerpo">Ingresa o crea tu cuenta con ese correo para aceptar.</p>
          <EnlaceBoton href={`/ingresar?siguiente=${encodeURIComponent(aqui)}`} className="h-12 w-full">
            Ingresar
          </EnlaceBoton>
          <EnlaceBoton href={`/registro?siguiente=${encodeURIComponent(aqui)}`} variante="secundario" className="h-12 w-full">
            Crear cuenta
          </EnlaceBoton>
        </div>
      )}
    </div>
  );
}
