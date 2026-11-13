/** Opciones de Ofertas y enlaces (consola y app). Módulo liviano: lo importan componentes de cliente. */

export const LUGARES_OFERTA = [
  ["inicio", "Inicio"],
  ["academia", "Academia"],
  ["ajustes", "Configuración"],
  ["metas", "Metas de ahorro"],
  ["presupuesto", "Presupuesto"],
  ["renta", "Renta DIAN"],
  ["pagos", "Pagos fijos"],
] as const;

export const AUDIENCIAS = [
  ["todos", "Todos los hogares"],
  ["gratis", "Plan Gratis"],
  ["pago", "Planes pagos"],
  ["prueba", "Probando Familia"],
  ["un_miembro", "Hogares de 1 persona"],
  ["sin_metas", "Hogares sin metas de ahorro"],
] as const;

export const ETIQUETAS_OFERTA = ["Oferta", "Aviso", "Novedad", "Evento"] as const;

export const LUGARES_ENLACE = [
  ["renta", "Renta DIAN"],
  ["importar", "Importar extracto"],
  ["metas", "Metas de ahorro"],
  ["presupuesto", "Presupuesto"],
  ["ayuda", "Ayuda"],
  ["inicio", "Inicio"],
] as const;

export const CATEGORIAS_ENLACE = [
  ["dian", "DIAN"],
  ["bancos", "Bancos"],
  ["simuladores", "Simuladores"],
  ["academia", "Academia"],
  ["otros", "Otros"],
] as const;

export const TIPOS_ALIADO = [
  ["contadores", "Contadores"],
  ["ahorro", "Ahorro"],
  ["comunidad", "Comunidad"],
  ["seguros", "Seguros"],
  ["otro", "Otro"],
] as const;

export const ESTADOS_ALIADO = [
  ["negociacion", "En negociación"],
  ["activo", "Activo"],
  ["pausado", "Pausado"],
] as const;

export const nombreDe = (lista: readonly (readonly [string, string])[], v: string) => lista.find(([k]) => k === v)?.[1] ?? v;
