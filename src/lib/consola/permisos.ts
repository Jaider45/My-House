import type { Database } from "@/lib/supabase/database.types";

/*
 * Roles y permisos del equipo de My House (consola). Réplica de `private.permisos_de_rol` (migración consola): la
 * base decide, esto solo sirve para mostrar u ocultar opciones. `tests/rls/consola.test.ts` verifica que coincidan.
 * Módulo liviano: lo importan componentes de cliente.
 */

export type RolStaff = Database["public"]["Enums"]["rol_staff"];
export type Permiso = Database["public"]["Enums"]["permiso_staff"];

export const ROLES_STAFF: { valor: RolStaff; nombre: string }[] = [
  { valor: "superadmin", nombre: "Superadmin" },
  { valor: "soporte", nombre: "Soporte" },
  { valor: "finanzas", nombre: "Finanzas" },
  { valor: "contenido", nombre: "Contenido" },
];

export const nombreRol = (r: RolStaff) => ROLES_STAFF.find((x) => x.valor === r)?.nombre ?? r;

/** Filas de la matriz «Roles y permisos», en el orden del diseño. */
export const PERMISOS: { valor: Permiso; texto: string }[] = [
  { valor: "ver_hogares", texto: "Ver lista de hogares y métricas" },
  { valor: "ver_finanzas", texto: "Ver datos financieros de un hogar (con permiso)" },
  { valor: "tickets", texto: "Responder tickets" },
  { valor: "cobros", texto: "Reembolsos y cambios de plan" },
  { valor: "planes", texto: "Editar planes, precios y cupones" },
  { valor: "parametros", texto: "Editar parámetros DIAN y catálogos" },
  { valor: "campanas", texto: "Enviar campañas" },
  { valor: "equipo", texto: "Gestionar equipo y roles" },
  { valor: "exportar", texto: "Exportar datos" },
  { valor: "sistema", texto: "Feature flags y mantenimiento" },
  { valor: "auditoria", texto: "Ver y exportar la auditoría" },
];

export const MATRIZ: Record<RolStaff, Permiso[]> = {
  superadmin: PERMISOS.map((p) => p.valor),
  soporte: ["ver_hogares", "ver_finanzas", "tickets"],
  finanzas: ["ver_hogares", "cobros", "planes", "exportar"],
  contenido: ["ver_hogares", "tickets", "parametros", "campanas"],
};

export const puede = (rol: RolStaff, permiso: Permiso) => MATRIZ[rol].includes(permiso);

/** Lo que el hook pone en el JWT de quien está activo en el equipo. */
export type ClaimStaff = { rol: RolStaff; nombre: string };

/** Minutos sin actividad tras los que la consola cierra la sesión (política «Cerrar sesión por inactividad»). */
export const MINUTOS_INACTIVIDAD = 30;
export const COOKIE_ACTIVIDAD = "mh_consola_actividad";
/** La escribe el proxy en cada pantalla de la consola y el ingreso al terminar (para no heredar una vieja). */
export const opcionesCookieActividad = {
  httpOnly: true,
  sameSite: "lax",
  path: "/consola",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 12,
} as const;
