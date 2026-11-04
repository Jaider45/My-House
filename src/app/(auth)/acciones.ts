"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeError, type Estado } from "@/lib/acciones";
import { destinoSeguro } from "@/lib/rutas";

const credenciales = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Escriba un correo válido.")),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export async function ingresar(_: Estado, datos: FormData): Promise<Estado> {
  const r = credenciales.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword(r.data);
  if (error) return { error: mensajeError(error) };
  redirect(destinoSeguro(datos.get("siguiente")?.toString()));
}

export async function registrarse(_: Estado, datos: FormData): Promise<Estado> {
  const r = credenciales
    .extend({ nombre: z.string().trim().min(1, "Escriba su nombre.").max(80) })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };

  const siguiente = destinoSeguro(datos.get("siguiente")?.toString(), "/onboarding");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: r.data.email,
    password: r.data.password,
    options: {
      data: { nombre: r.data.nombre },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirmar?siguiente=${encodeURIComponent(siguiente)}`,
    },
  });
  if (error) return { error: mensajeError(error) };
  if (!data.session) {
    return { ok: "Le enviamos un correo para confirmar su cuenta. Ábralo desde este dispositivo." };
  }
  redirect(siguiente);
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/ingresar");
}
