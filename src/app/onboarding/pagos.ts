/** Pagos sugeridos del paso 2: nombre → categoría raíz sembrada. */
export const PAGOS_SUGERIDOS = [
  { clave: "arriendo", nombre: "Arriendo", categoria: "Vivienda", dia: 5 },
  { clave: "energia", nombre: "Energía", categoria: "Servicios públicos", dia: 3 },
  { clave: "colegio", nombre: "Jardín o colegio", categoria: "Educación de los hijos", dia: 1 },
  { clave: "mercado", nombre: "Mercado", categoria: "Mercado", dia: 15 },
  { clave: "credito", nombre: "Créditos", categoria: "Deudas", dia: 17 },
] as const;
