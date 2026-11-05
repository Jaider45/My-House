/**
 * Cola de registros rápidos hechos sin conexión. Vive en localStorage del dispositivo solo hasta que se
 * envían (la PWA no guarda datos financieros en caché; esto es lo que la familia aún no ha podido mandar).
 */

export const CLAVE_COLA = "myhouse:cola-registros";
const MAX = 50;

export type Pendiente = {
  id: string;
  /** Campos del formulario de registro rápido (tipo, fecha, monto, account_id, category_id). */
  campos: Record<string, string>;
  creado: string;
  /** Si el servidor lo rechazó (p. ej. la categoría se archivó), el motivo; queda para que la familia decida. */
  error?: string;
};

type Almacen = Pick<Storage, "getItem" | "setItem">;

export function leerCola(almacen: Almacen): Pendiente[] {
  try {
    const datos = JSON.parse(almacen.getItem(CLAVE_COLA) ?? "[]");
    return Array.isArray(datos) ? datos.filter((p) => p && typeof p.id === "string" && typeof p.campos === "object") : [];
  } catch {
    return [];
  }
}

const escribir = (almacen: Almacen, cola: Pendiente[]) => almacen.setItem(CLAVE_COLA, JSON.stringify(cola));

/** Agrega un registro. Devuelve false si la cola está llena (no se pierde lo que ya había). */
export function encolar(almacen: Almacen, campos: Record<string, string>, ahora = new Date()): boolean {
  const cola = leerCola(almacen);
  if (cola.length >= MAX) return false;
  const id = `${ahora.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  escribir(almacen, [...cola, { id, campos, creado: ahora.toISOString() }]);
  return true;
}

export function quitarDeCola(almacen: Almacen, id: string) {
  escribir(
    almacen,
    leerCola(almacen).filter((p) => p.id !== id),
  );
}

export function marcarError(almacen: Almacen, id: string, error: string) {
  escribir(
    almacen,
    leerCola(almacen).map((p) => (p.id === id ? { ...p, error } : p)),
  );
}

/** Los que se pueden reintentar (los rechazados esperan a que la familia los descarte o corrija). */
export const porEnviar = (cola: Pendiente[]) => cola.filter((p) => !p.error);

/** FormData → campos de texto (los archivos no viajan en la cola). */
export function camposDe(datos: FormData): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const [k, v] of datos.entries()) if (typeof v === "string") campos[k] = v;
  return campos;
}

/** ¿El error es de red (sin conexión, servidor inalcanzable) y no una respuesta del servidor? */
export const esErrorDeRed = (e: unknown) =>
  e instanceof TypeError || (e instanceof Error && /fetch|network|conexi/i.test(e.message));
