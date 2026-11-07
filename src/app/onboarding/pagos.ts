/** Pagos sugeridos del paso 2: nombre → categoría raíz sembrada. */
export const PAGOS_SUGERIDOS = [
  { clave: "arriendo", nombre: "Arriendo", categoria: "Vivienda", dia: 5 },
  { clave: "energia", nombre: "Energía", categoria: "Servicios públicos", dia: 3 },
  { clave: "colegio", nombre: "Jardín o colegio", categoria: "Educación de los hijos", dia: 1 },
  { clave: "mercado", nombre: "Mercado", categoria: "Mercado", dia: 15 },
  { clave: "credito", nombre: "Créditos", categoria: "Deudas", dia: 17 },
] as const;

/** Categorías de gasto sembradas (private.sembrar_categorias) para los pagos que el usuario agrega. */
export const CATEGORIAS_PAGO = [
  "Vivienda",
  "Servicios públicos",
  "Mercado",
  "Transporte",
  "Educación de los hijos",
  "Salud",
  "Seguros",
  "Deudas",
  "Entretenimiento",
  "Mascotas",
  "Imprevistos",
] as const;

/** Máximo de pagos extra en el paso 2 (el resto se agrega después en Presupuesto). */
export const MAX_OTROS = 10;
