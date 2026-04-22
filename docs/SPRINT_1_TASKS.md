# Tareas — Sprint 1 (Setup + Autenticación)

> **Ruta:** `/docs/SPRINT_1_TASKS.md`
> **Duración:** 2 semanas
> **Objetivo:** Proyecto arranca localmente, login funcional con roles, DB con schema aplicado.
> Copiar cada tarea a Notion → base de datos **Tasks** (formato markdown compatible).

---

## Cómo usar este documento

Cada tarea de abajo es una entrada lista para la base **Tasks** de Notion con:
- **Name** — título de la tarea
- **Status** — `Todo` inicialmente
- **Priority** — `High` / `Medium` / `Low`
- **Estimate** — horas estimadas
- **Labels** — tipo de trabajo
- **Description** — lo que hay debajo del título
- **Subtasks** — pasos concretos

Al iniciar: pasar a `In Progress` + crear rama `feature/<slug>` y pegarla en `Notes`.
Al terminar: pasar a `Done` + pegar link del PR.

---

## T01 — Crear repo en GitHub y hacer commits iniciales

- **Priority:** High
- **Estimate:** 1h
- **Labels:** `setup`, `git`
- **Description:** Seguir la secuencia documentada en `docs/INITIAL_COMMITS.md` hasta el tag `v0.1.0`.
- **Subtasks:**
  - Crear repo privado `chatbot-ia-empresarial` en GitHub
  - Configurar protección de rama `main` (1 aprobación, CI requerido)
  - Configurar protección de rama `develop`
  - Ejecutar los 16 commits según `INITIAL_COMMITS.md`
  - Crear tag `v0.1.0`

## T02 — Crear proyectos Supabase (staging y prod)

- **Priority:** High
- **Estimate:** 1h
- **Labels:** `setup`, `supabase`
- **Description:** Dos proyectos separados; no mezclar datos.
- **Subtasks:**
  - Crear `chatbot-ia-staging` en región más cercana (us-east-1)
  - Crear `chatbot-ia-prod` con plan adecuado
  - Guardar `project-ref`, URL, anon key y service role key en el gestor de secretos del equipo
  - Verificar que las extensiones `vector` y `pg_trgm` están disponibles

## T03 — Aplicar migraciones a Supabase staging

- **Priority:** High
- **Estimate:** 2h
- **Labels:** `db`, `supabase`
- **Description:** Las tres migraciones en orden, verificando que no hay errores y que RLS queda activo.
- **Subtasks:**
  - `supabase login`
  - `supabase link --project-ref <staging-ref>`
  - `supabase db push`
  - Verificar en el dashboard que las 14 tablas existen
  - Verificar que RLS está activado (ícono de escudo verde)
  - Correr `supabase db reset` localmente para probar seed

## T04 — Configurar variables de entorno locales

- **Priority:** High
- **Estimate:** 30min
- **Labels:** `setup`, `config`
- **Description:** Cada desarrollador necesita su propio `.env.local`.
- **Subtasks:**
  - Copiar `.env.example` a `.env.local`
  - Completar todas las variables Supabase (staging)
  - Obtener `ANTHROPIC_API_KEY` desde console.anthropic.com
  - Confirmar que `.env.local` está en `.gitignore`

## T05 — Instalar dependencias y correr el proyecto

- **Priority:** High
- **Estimate:** 1h
- **Labels:** `setup`
- **Description:** Verificar que todo el scaffolding funciona.
- **Subtasks:**
  - `pnpm install`
  - `pnpm typecheck` — debe pasar sin errores
  - `pnpm dev` — servidor en `http://localhost:5173`
  - Navegar a `/auth/login` y ver el layout correctamente
  - Probar redirección a login cuando la ruta requiere auth

## T06 — Crear el primer super_admin

- **Priority:** High
- **Estimate:** 1h
- **Labels:** `auth`, `db`
- **Description:** Manual por ahora; más adelante se automatiza con un flujo de onboarding.
- **Subtasks:**
  - Crear usuario via Supabase Auth UI (Users → Invite)
  - Copiar el UUID del `auth.users`
  - Ejecutar INSERT en tabla `public.users` con `role='super_admin'` y la `organization_id` del seed
  - Verificar login en la app con el email/contraseña creados

## T07 — Probar guards de router con diferentes roles

- **Priority:** Medium
- **Estimate:** 2h
- **Labels:** `auth`, `testing`
- **Description:** Validar que los guards permiten/bloquean correctamente.
- **Subtasks:**
  - Crear usuarios de prueba con cada rol (`super_admin`, `admin`, `supervisor`, `agent`)
  - Para cada rol, verificar qué items del sidebar son visibles
  - Intentar acceder a rutas no permitidas vía URL directa — debe redirigir
  - Documentar hallazgos en comentario de la tarea

## T08 — Verificar RLS con usuarios de prueba

- **Priority:** High
- **Estimate:** 3h
- **Labels:** `security`, `db`
- **Description:** **Crítico.** Un RLS mal escrito = fuga de datos entre organizaciones.
- **Subtasks:**
  - Crear una segunda organización en la DB
  - Crear un usuario en esa otra organización
  - Loguearse con ese usuario
  - Intentar hacer `SELECT` desde el cliente a `conversations`, `contacts`, etc.
  - Confirmar que **NO ve** datos de la primera org
  - Probar también para un agente (solo ve sus conversaciones)
  - Documentar casos probados

## T09 — Agregar logout y refresh de sesión

- **Priority:** Medium
- **Estimate:** 2h
- **Labels:** `auth`, `feature`
- **Description:** El botón de salir ya existe pero hay que probar casos borde.
- **Subtasks:**
  - Verificar que al cerrar sesión se limpia el store
  - Verificar que al expirar el JWT se refresca automáticamente
  - Probar qué pasa si el usuario queda desactivado (`active=false`) mientras está logueado

## T10 — Configurar CI (typecheck + lint + build)

- **Priority:** High
- **Estimate:** 2h
- **Labels:** `ci`, `setup`
- **Description:** Que los PRs fallen si el tipado o el build rompen.
- **Subtasks:**
  - Configurar los GitHub Secrets necesarios
  - Probar el workflow de staging en una rama dummy
  - Confirmar que falla adecuadamente si hay un error de TS
  - Agregar el check como requerido en protección de ramas

## T11 — Desplegar Edge Function meta-webhook a staging

- **Priority:** Medium
- **Estimate:** 2h
- **Labels:** `functions`, `supabase`
- **Description:** Aún sin credenciales de Meta reales; solo verificar que el código despliega.
- **Subtasks:**
  - `supabase functions deploy meta-webhook --project-ref <staging-ref>`
  - Configurar secretos: `META_WA_VERIFY_TOKEN`, `META_APP_SECRET`
  - Hacer una petición GET de prueba con `curl` simulando la verificación
  - Confirmar respuesta 200 con el `hub.challenge`

## T12 — Crear wiki/página en Notion con accesos y secretos

- **Priority:** Medium
- **Estimate:** 1h
- **Labels:** `docs`, `onboarding`
- **Description:** Punto único donde el equipo encuentra credenciales seguras.
- **Subtasks:**
  - Crear página Notion "🔑 Accesos del proyecto"
  - Listar enlaces: repo, Supabase staging/prod, Notion DBs, Anthropic Console
  - Documentar a quién pedir qué credencial (nunca compartir en Notion directamente)
  - Vincular esta página desde el proyecto principal

## T13 — Agregar favicon y meta tags

- **Priority:** Low
- **Estimate:** 1h
- **Labels:** `ui`, `polish`
- **Description:** Detalles de branding.
- **Subtasks:**
  - Crear `favicon.svg` en `/public/`
  - Agregar open graph meta tags en `index.html`
  - Agregar `apple-touch-icon`

## T14 — Demo de cierre de Sprint 1

- **Priority:** Medium
- **Estimate:** 1h
- **Labels:** `demo`, `sprint`
- **Description:** Mostrar al dueño del proyecto que el Sprint 1 está completo.
- **Subtasks:**
  - Preparar mini-guion: login → dashboard → navegación → logout
  - Grabar un Loom o hacer demo en vivo
  - Actualizar `CONTEXT.md` con el estado final
  - Mover al Sprint 2 las tareas que quedaron pendientes

---

## Criterio de Aceptación del Sprint 1

Al finalizar, **todo esto** debe funcionar:

- [ ] `pnpm dev` levanta la app sin errores
- [ ] `pnpm typecheck` pasa
- [ ] `pnpm build` genera dist exitosamente
- [ ] Login funciona con al menos un super_admin creado
- [ ] El sidebar muestra items según el rol
- [ ] RLS bloquea acceso entre organizaciones
- [ ] CI corre en cada PR
- [ ] Edge Function meta-webhook despliega a staging
- [ ] Git: ramas `main` y `develop` protegidas
- [ ] Notion: tablero actualizado con cada tarea cerrada y link a PR
- [ ] `CHANGELOG.md` actualizado

---

## Sprint 2 — Preview (solo para contexto)

Sin entrar en detalle, estos serán los focos:

1. Webhook de WhatsApp recibiendo mensajes reales (sandbox de Meta).
2. Widget web embebible básico (HTML + JS + call al endpoint).
3. Pipeline de ingesta: mensaje → DB → realtime → inbox.
4. Primer bot básico respondiendo con Claude API (sin RAG aún).
