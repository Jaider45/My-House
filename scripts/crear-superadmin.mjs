// Da acceso de superadmin a la consola (/consola) a una cuenta que ya existe. Es el primer acceso: después, el
// superadmin invita al resto del equipo desde Equipo y permisos.
//
// Uso:  node scripts/crear-superadmin.mjs correo@dominio.com "Nombre visible"
//       (en la nube: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/crear-superadmin.mjs ...)
//
// La persona debe tener cuenta (créala en /registro). Al entrar a /consola activará la verificación en dos pasos.
// Queda en la auditoría como acción del «Sistema (script)».
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

const archivo = existsSync(".env.local")
  ? Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split(/\r?\n/)
        .filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
    )
  : {};
const URL = process.env.SUPABASE_URL ?? archivo.NEXT_PUBLIC_SUPABASE_URL;
const LLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? archivo.SUPABASE_SERVICE_ROLE_KEY;

const [correoArg, ...resto] = process.argv.slice(2);
const correo = correoArg?.trim().toLowerCase();
const nombre = resto.join(" ").trim();
if (!correo || !nombre) {
  console.error('Uso: node scripts/crear-superadmin.mjs correo@dominio.com "Nombre visible"');
  process.exit(1);
}
if (!URL || !LLAVE) {
  console.error("Faltan la URL de Supabase y la llave service_role (.env.local o variables de entorno).");
  process.exit(1);
}

const admin = createClient(URL, LLAVE, { auth: { persistSession: false } });

// Busca la cuenta por correo (paginando: la API de admin no filtra por correo).
let usuario = null;
for (let page = 1; !usuario; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  usuario = data.users.find((u) => u.email?.toLowerCase() === correo) ?? null;
  if (data.users.length < 1000) break;
}
if (!usuario) {
  console.error(`No hay una cuenta con ${correo}. Créala primero en /registro.`);
  process.exit(1);
}

const { error } = await admin
  .from("platform_staff")
  .upsert({ user_id: usuario.id, nombre, rol: "superadmin", activo: true, updated_at: new Date().toISOString() });
if (error) throw error;

const { error: e2 } = await admin.from("auditoria").insert({
  quien: null,
  quien_nombre: "Sistema (script)",
  accion: "superadmin_creado",
  objeto_tipo: "persona",
  objeto_id: usuario.id,
  objeto_nombre: nombre,
});
if (e2) throw e2;

console.log(`${nombre} (${correo}) ya es superadmin. Entra a /consola: te pedirá activar la verificación en dos pasos.`);
console.log("Si tenía la sesión abierta, debe cerrarla y volver a ingresar para que el token traiga el rol.");
