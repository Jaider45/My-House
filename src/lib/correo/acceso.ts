import "server-only";
import { cookies, headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nombreDe } from "@/lib/usuario";
import { correoSeguridad } from "./correos";
import { describirDispositivo, formatearMomento, lugarAproximado } from "./dispositivo";
import { enviarCorreo, sitio } from "./enviar";

const COOKIE = "mh_dispositivo";
const UN_ANIO = 60 * 60 * 24 * 400;

/**
 * Aviso «¿Fuiste tú?» al entrar desde un navegador que nunca había entrado a la cuenta. Cada navegador recibe una
 * cookie propia; la lista de los conocidos de cada persona viaja en esa cookie (no en la base), por eso borrar las
 * cookies hace que el siguiente ingreso avise otra vez: es lo prudente. No avisa en el primer ingreso de una cuenta
 * recién creada. Llamar justo después de abrir sesión con éxito.
 */
export async function avisarSiDispositivoNuevo(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getUser();
  const usuario = data.user;
  if (!usuario?.email) return;
  const almacen = await cookies();
  const conocidos = (almacen.get(COOKIE)?.value ?? "").split(".").filter(Boolean);
  // Huella corta del usuario: la cookie no revela el id completo.
  const huella = usuario.id.replaceAll("-", "").slice(0, 12);
  if (conocidos.includes(huella)) return;
  almacen.set(COOKIE, [...conocidos, huella].slice(-5).join("."), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: UN_ANIO,
    path: "/",
  });
  const nueva = Date.now() - new Date(usuario.created_at).getTime() < 15 * 60 * 1000;
  if (nueva) return;
  const h = await headers();
  await enviarCorreo({
    para: usuario.email,
    etiqueta: "seguridad",
    contenido: correoSeguridad({
      nombre: nombreDe(usuario.user_metadata) || "",
      dispositivo: describirDispositivo(h.get("user-agent")),
      lugar: lugarAproximado(h),
      fecha: formatearMomento(new Date()),
      urlProteger: `${sitio()}/recuperar?email=${encodeURIComponent(usuario.email)}`,
      urlSitio: `${sitio()}/`,
    }),
  });
}
