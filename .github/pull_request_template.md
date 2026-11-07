## Resumen
<!-- Qué problema resuelve y por qué, en 2–4 líneas. -->

## Cambios
<!-- Lo que cambió, agrupado por pantalla o módulo (Inicio, Presupuesto, Onboarding, src/lib/...). -->
-

## Fórmulas o decisiones
<!-- Si cambia un cálculo (costo de vida, número mínimo, semáforo DIAN…) o una decisión de CLAUDE.md, escríbela aquí. Si no, «No aplica». -->

## Cómo se probó
<!-- Pruebas automáticas y lo revisado a mano (usuario, datos, tamaño de pantalla). -->
- [ ] `npm run check` (lint + tipos + pruebas unitarias)
- [ ] `npm run test:rls` (si toca migraciones, RLS o acciones que escriben)
- [ ] `npm run build`
- [ ] Revisado en el navegador: celular (< 768) y escritorio (≥ 1440)

## Capturas
<!-- Antes / después de las pantallas que cambian. Si no hay cambios visuales, «No aplica». -->

## Checklist
- [ ] Textos en español y con tuteo; montos en COP sin decimales
- [ ] Migraciones nuevas (nunca editar una ya aplicada en la nube)
- [ ] Las acciones que guardan revisan `puedeEditar`/`esAdmin` y llaman `revalidatePath`
- [ ] `CLAUDE.md` actualizado si cambia una decisión, un comando o la estructura
