# CHANGELOG

> **Ruta:** `/CHANGELOG.md`
> Todos los cambios notables de este proyecto se documentan aquí.
> El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
> y este proyecto sigue [Semantic Versioning](https://semver.org/lang/es/).

---

## [Unreleased]

### Added
- Nada pendiente de release.

---

## [0.1.0] - 2026-04-21 — Setup Inicial

### Added
- `CONTEXT.md` con visión y principios arquitectónicos del proyecto.
- `CHANGELOG.md` siguiendo formato Keep a Changelog.
- `README.md` con guía de arranque local.
- Estructura completa de carpetas (`src/`, `supabase/`, `widget/`, `docs/`, `scripts/`).
- `.gitignore` con exclusiones estándar Vue + Supabase + entorno.
- `.env.example` con todas las variables de entorno documentadas (Supabase, Claude, Meta, Telegram, Twilio, Notion).
- `package.json` con dependencias base (Vue 3, Vite, Pinia, Vue Router, Tailwind, Supabase JS, Axios, Day.js, VueUse, Chart.js, vue-chartjs).
- `tsconfig.json` con modo estricto activado.
- `vite.config.ts` con alias `@` → `./src`.
- `tailwind.config.ts` con tokens de diseño iniciales.
- `postcss.config.js`.
- `src/main.ts` como punto de entrada.
- `src/App.vue` raíz.
- `src/router/index.ts` con rutas base.
- `src/router/guards.ts` con guard por rol.
- `src/stores/auth.store.ts` store de autenticación con Pinia.
- `src/repository/base.repository.ts` — interfaz genérica `IRepository<T>`.
- `src/repository/index.ts` — factory del repositorio activo.
- `src/repository/supabase/` — implementaciones iniciales (conversation, message, agent).
- `src/services/supabase.client.ts` — cliente único de Supabase.
- `src/services/claude.service.ts` — cliente Claude API (stub).
- `src/types/` — tipos TypeScript base (conversation, message, agent, user, channel).
- `src/layouts/AdminLayout.vue` y `src/layouts/AuthLayout.vue`.
- `supabase/migrations/20260421000001_init_schema.sql` — schema completo inicial con 14 tablas.
- `supabase/migrations/20260421000002_rls_policies.sql` — políticas RLS para todas las tablas.
- `supabase/migrations/20260421000003_functions_triggers.sql` — funciones y triggers (updated_at, auto-asignación, métricas).
- `supabase/seed/seed.sql` — datos iniciales de prueba.
- `supabase/functions/meta-webhook/index.ts` — esqueleto del webhook de Meta.
- `.github/workflows/deploy-staging.yml` — pipeline de staging.
- `.github/workflows/deploy-prod.yml` — pipeline de producción.
- `.github/pull_request_template.md`.
- `docs/ARCHITECTURE.md` — diagrama y explicación de capas.
- `docs/GIT_WORKFLOW.md` — guía del flujo Git del proyecto.
- `docs/DATABASE.md` — documentación del schema.

### Security
- RLS activado por defecto en todas las tablas del schema inicial.
- Variables sensibles (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, tokens Meta) separadas de variables `VITE_*`.
- `.env*` excluidos de Git vía `.gitignore`.

### Notes
- Este es el commit fundacional. A partir de aquí el trabajo se organiza por ramas `feature/*` desde `develop`.

---

## Formato de Versionado

- **MAJOR** (1.0.0 → 2.0.0): Cambios incompatibles de API.
- **MINOR** (0.1.0 → 0.2.0): Nueva funcionalidad compatible hacia atrás.
- **PATCH** (0.1.0 → 0.1.1): Correcciones compatibles hacia atrás.

## Tipos de Cambios

- `Added` — nuevas funcionalidades.
- `Changed` — cambios en funcionalidades existentes.
- `Deprecated` — funcionalidades que serán removidas.
- `Removed` — funcionalidades removidas.
- `Fixed` — corrección de bugs.
- `Security` — vulnerabilidades y cambios de seguridad.
