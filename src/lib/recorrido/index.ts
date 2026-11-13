import type { NombreIcono } from "@/components/marca";

/**
 * Recorrido de configuración inicial: los pasos que dejan el hogar listo para que el tablero tenga sentido.
 * Cálculo puro (sirve en servidor y cliente, sin zod ni supabase). Cada paso se marca hecho mirando los datos
 * del hogar; la persona puede omitirlo («Ahora no») u ocultar el recorrido. Esas preferencias viven en
 * `user_metadata.recorrido[hogarId]` (viajan en el JWT: leerlas no consulta la base).
 */

export type ClavePaso = "cuentas" | "ingresos" | "pagos_fijos" | "presupuesto" | "primer_movimiento" | "personas" | "seguridad";

export type Paso = {
  clave: ClavePaso;
  icono: NombreIcono;
  titulo: string;
  /** Una línea: qué ganas con este paso. */
  porque: string;
  /** Qué hacer al llegar a la pantalla (se muestra en la barra cuando ya estás en ella). */
  como: string;
  href: string;
  /** Rutas donde se completa el paso (para la indicación «estás aquí»). */
  rutas: string[];
  boton: string;
  opcional?: boolean;
};

export const PASOS: readonly Paso[] = [
  {
    clave: "cuentas",
    icono: "cuentas",
    titulo: "Crea tus cuentas",
    porque: "Banco, efectivo, billetera o tarjeta: cada movimiento sale o entra de una cuenta.",
    como: "En «Agregar cuenta o tarjeta» registra al menos tu cuenta principal con su saldo de hoy.",
    href: "/cuentas",
    rutas: ["/cuentas"],
    boton: "Crear una cuenta",
  },
  {
    clave: "ingresos",
    icono: "ingresos",
    titulo: "Agrega tu salario como ingreso fijo",
    porque: "Con lo que entra cada mes, My House proyecta tu ahorro y cuántas veces cubres el número mínimo.",
    como: "En «Nuevo pago fijo» elige «Ingreso», escribe tu salario y la fecha en que te pagan.",
    href: "/recurrentes#nuevo",
    rutas: ["/recurrentes"],
    boton: "Agregar ingreso fijo",
  },
  {
    clave: "pagos_fijos",
    icono: "calendario",
    titulo: "Carga tus pagos fijos",
    porque: "Arriendo, servicios, colegio, créditos: son la base del costo de vida y te avisamos antes de que venzan.",
    como: "En «Agregar pago fijo» registra cada pago que se repite, con su monto y fecha.",
    href: "/presupuesto#pagos-fijos",
    rutas: ["/presupuesto", "/recurrentes"],
    boton: "Cargar pagos fijos",
  },
  {
    clave: "presupuesto",
    icono: "mercado",
    titulo: "Define tu gasto variable",
    porque: "Mercado, transporte, salidas: un tope por categoría para saber si vas bien antes de que acabe el mes.",
    como: "Escribe cuánto piensas gastar al mes en las categorías que cambian y toca «Guardar presupuesto».",
    href: "/presupuesto",
    rutas: ["/presupuesto"],
    boton: "Definir presupuesto",
  },
  {
    clave: "primer_movimiento",
    icono: "egresos",
    titulo: "Registra tu primer gasto",
    porque: "Toma menos de 10 segundos. También puedes importar el extracto del banco o tomarle foto a un recibo.",
    como: "Escribe el monto, elige la categoría y guarda. ¿Tienes el extracto? Usa «Importar».",
    href: "/rapido",
    rutas: ["/rapido", "/importar", "/comprobantes", "/movimientos"],
    boton: "Registrar un gasto",
  },
  {
    clave: "personas",
    icono: "familia",
    titulo: "Invita a tu pareja o agrega a quién tienes a cargo",
    porque: "Registren juntos y vean lo mismo. Las personas a cargo cuentan en el costo por persona y en la renta.",
    como: "Invita a un adulto con su correo o agrega hijos y padres como personas a cargo.",
    href: "/ajustes/miembros",
    rutas: ["/ajustes/miembros"],
    boton: "Ir a miembros",
    opcional: true,
  },
  {
    clave: "seguridad",
    icono: "certificados",
    titulo: "Protege tu cuenta con verificación en dos pasos",
    porque: "Son tus finanzas: con un código del celular nadie entra aunque sepa tu contraseña.",
    como: "Toca «Activar», escanea el código QR con tu app autenticadora y escribe el código de 6 dígitos.",
    href: "/ajustes/seguridad",
    rutas: ["/ajustes/seguridad"],
    boton: "Activar dos pasos",
    opcional: true,
  },
];

const CLAVES = new Set<string>(PASOS.map((p) => p.clave));

/** Lo que dice la base de datos sobre el hogar (y la sesión) para decidir qué pasos están hechos. */
export type DatosRecorrido = {
  cuentas: number;
  ingresosFijos: number;
  pagosFijos: number;
  presupuestos: number;
  /** Movimientos que registró una persona (no los que genera el cron de pagos fijos). */
  movimientos: number;
  /** Miembros del hogar (adultos y personas a cargo) + invitaciones enviadas. */
  personas: number;
  invitaciones: number;
  dosPasos: boolean;
};

export type PreferenciasRecorrido = { oculto: boolean; omitidos: ClavePaso[] };

export type EstadoPaso = Paso & { hecho: boolean; omitido: boolean };

export type Recorrido = {
  pasos: EstadoPaso[];
  /** Hechos u omitidos. */
  resueltos: number;
  hechos: number;
  total: number;
  porcentaje: number;
  /** Primer paso ni hecho ni omitido (null = terminado). */
  siguiente: EstadoPaso | null;
  completo: boolean;
  oculto: boolean;
};

function hecho(clave: ClavePaso, d: DatosRecorrido): boolean {
  switch (clave) {
    case "cuentas":
      return d.cuentas > 0;
    case "ingresos":
      return d.ingresosFijos > 0;
    case "pagos_fijos":
      return d.pagosFijos > 0;
    case "presupuesto":
      return d.presupuestos > 0;
    case "primer_movimiento":
      return d.movimientos > 0;
    case "personas":
      return d.personas > 1 || d.invitaciones > 0;
    case "seguridad":
      return d.dosPasos;
  }
}

export function evaluarRecorrido(datos: DatosRecorrido, pref: PreferenciasRecorrido): Recorrido {
  const omitidos = new Set(pref.omitidos);
  const pasos = PASOS.map((p) => {
    const h = hecho(p.clave, datos);
    return { ...p, hecho: h, omitido: !h && omitidos.has(p.clave) };
  });
  const hechos = pasos.filter((p) => p.hecho).length;
  const resueltos = pasos.filter((p) => p.hecho || p.omitido).length;
  const siguiente = pasos.find((p) => !p.hecho && !p.omitido) ?? null;
  return {
    pasos,
    resueltos,
    hechos,
    total: pasos.length,
    porcentaje: Math.round((resueltos * 100) / pasos.length),
    siguiente,
    completo: siguiente === null,
    oculto: pref.oculto,
  };
}

/** Preferencias del hogar `hogarId` dentro de `user_metadata` (tolerante a datos viejos o mal formados). */
export function leerPreferencias(userMetadata: unknown, hogarId: string): PreferenciasRecorrido {
  const todo = (userMetadata as { recorrido?: unknown } | null)?.recorrido;
  const p = typeof todo === "object" && todo !== null ? (todo as Record<string, unknown>)[hogarId] : undefined;
  if (typeof p !== "object" || p === null) return { oculto: false, omitidos: [] };
  const { oculto, omitidos } = p as { oculto?: unknown; omitidos?: unknown };
  return {
    oculto: oculto === true,
    omitidos: Array.isArray(omitidos) ? (omitidos.filter((c) => typeof c === "string" && CLAVES.has(c)) as ClavePaso[]) : [],
  };
}

/** `user_metadata.recorrido` con las preferencias de un hogar cambiadas (conserva las de otros hogares). */
export function conPreferencias(userMetadata: unknown, hogarId: string, pref: PreferenciasRecorrido): Record<string, PreferenciasRecorrido> {
  const todo = (userMetadata as { recorrido?: unknown } | null)?.recorrido;
  const base = typeof todo === "object" && todo !== null ? (todo as Record<string, PreferenciasRecorrido>) : {};
  return { ...base, [hogarId]: { oculto: pref.oculto, omitidos: [...new Set(pref.omitidos)] } };
}

export const esClavePaso = (v: unknown): v is ClavePaso => typeof v === "string" && CLAVES.has(v);

/** ¿La ruta actual es donde se completa el paso? */
export const estaEnPaso = (ruta: string | null, paso: Paso) =>
  ruta !== null && paso.rutas.some((r) => ruta === r || ruta.startsWith(`${r}/`));
