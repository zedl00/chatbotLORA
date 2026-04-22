<!-- Ruta: /.github/pull_request_template.md -->

## ¿Qué hace este PR?

<!-- Descripción clara y concisa de los cambios -->

## Tipo de cambio

- [ ] `feat` — Nueva funcionalidad
- [ ] `fix` — Corrección de bug
- [ ] `refactor` — Refactoring sin cambio funcional
- [ ] `docs` — Solo documentación
- [ ] `perf` — Mejora de rendimiento
- [ ] `chore` — Mantenimiento / dependencias

## Tarea relacionada

<!-- Link a la tarea de Notion -->
Notion: _pegar link aquí_

## Tests realizados

<!-- Describir pruebas manuales o automatizadas ejecutadas -->
- [ ] Probado en local con `pnpm dev`
- [ ] Probado en mobile (si aplica UI)
- [ ] Probado con datos reales del seed

## Screenshots / Videos

<!-- Si hay cambios visuales, agregar capturas o Loom -->

## Checklist antes de solicitar revisión

- [ ] El código sigue las convenciones del proyecto (ver `CONTEXT.md`)
- [ ] Todos los archivos nuevos tienen `// Ruta: ...` o `<!-- Ruta: ... -->` al inicio
- [ ] No hay `console.log()`, `debugger` ni código comentado olvidado
- [ ] TypeScript compila sin errores (`pnpm typecheck`)
- [ ] Variables de entorno nuevas están en `.env.example`
- [ ] No se commitearon claves, tokens ni secretos
- [ ] `CHANGELOG.md` actualizado bajo `[Unreleased]`
- [ ] Migraciones SQL nuevas (si aplica) tienen RLS y triggers apropiados
- [ ] La tarea de Notion fue actualizada con el link de este PR
