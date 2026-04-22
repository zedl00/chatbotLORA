# Plan de Commits Iniciales

> **Ruta:** `/docs/INITIAL_COMMITS.md`
> Secuencia recomendada para subir el proyecto a Git siguiendo Conventional Commits.

---

## Objetivo

Partir de un repositorio vacío y llegar al estado actual del Sprint 1 con una historia Git limpia y semántica que cualquiera pueda revisar.

## Preparación

```bash
# 1. Crear repo en GitHub (privado): chatbot-ia-empresarial
# 2. Localmente:
cd chatbot-ia-empresarial
git init
git branch -M main
git remote add origin https://github.com/<usuario>/chatbot-ia-empresarial.git
```

## Secuencia de Commits (en `main` para el primero, luego en `develop`)

### 🏁 Commit 1 — Punto de partida en `main`

```bash
# Solo archivos raíz mínimos
git add .gitignore README.md CONTEXT.md CHANGELOG.md LICENSE 2>/dev/null || git add .gitignore README.md CONTEXT.md CHANGELOG.md
git commit -m "chore: commit inicial del proyecto"
git push -u origin main

# Crear develop desde main
git checkout -b develop
git push -u origin develop
```

### 📁 Commit 2 — Estructura y configuración base

```bash
# En develop
git checkout develop

git add package.json tsconfig.json vite.config.ts tailwind.config.ts \
        postcss.config.js index.html .env.example
git commit -m "chore(setup): configurar vite, tailwind, typescript y package.json"
```

### 🧱 Commit 3 — Scaffolding de código Vue

```bash
git add src/main.ts src/App.vue src/env.d.ts src/styles/
git commit -m "feat(app): entrypoint principal con pinia, router y estilos tailwind"
```

### 🧭 Commit 4 — Router y guards

```bash
git add src/router/
git commit -m "feat(router): rutas del panel con guards de autenticación y roles"
```

### 🎨 Commit 5 — Layouts base

```bash
git add src/layouts/
git commit -m "feat(layouts): layouts admin y auth con sidebar dinámico por rol"
```

### 🧰 Commit 6 — Tipos, utilidades y constantes

```bash
git add src/types/ src/utils/
git commit -m "feat(types): tipos de dominio, utilidades de formato y constantes"
```

### 🗄️ Commit 7 — Schema SQL de Supabase

```bash
git add supabase/migrations/ supabase/seed/
git commit -m "feat(db): schema inicial con 14 tablas, RLS y triggers"
```

### 🔌 Commit 8 — Cliente Supabase y servicio Claude

```bash
git add src/services/
git commit -m "feat(services): cliente supabase único y stub de claude service"
```

### 🏗️ Commit 9 — Capa Repository

```bash
git add src/repository/
git commit -m "feat(repository): patrón repository desacoplado con implementación supabase"
```

### 🗃️ Commit 10 — Stores Pinia

```bash
git add src/stores/
git commit -m "feat(stores): stores de autenticación, ui y conversaciones con realtime"
```

### 🧩 Commit 11 — Composables

```bash
git add src/composables/
git commit -m "feat(composables): useConversations y useMessages con suscripciones realtime"
```

### 🪟 Commit 12 — Vistas iniciales (placeholders)

```bash
git add src/modules/
git commit -m "feat(modules): vistas iniciales de login, dashboard y placeholders de módulos"
```

### 🌐 Commit 13 — Edge Function del webhook Meta

```bash
git add supabase/functions/
git commit -m "feat(functions): esqueleto de meta-webhook con validación hmac"
```

### 📚 Commit 14 — Documentación técnica

```bash
git add docs/
git commit -m "docs: agregar guía de arquitectura, base de datos y flujo git"
```

### ⚙️ Commit 15 — CI/CD y templates de GitHub

```bash
git add .github/
git commit -m "ci: agregar workflows de staging/producción y template de pull request"
```

### 🏷️ Commit 16 — Tagging del primer snapshot

```bash
git push -u origin develop

# Merge a main vía PR o merge directo si es el primer snapshot
git checkout main
git merge develop --no-ff -m "chore(release): v0.1.0 — setup inicial del proyecto"
git tag -a v0.1.0 -m "v0.1.0 — Setup inicial (Sprint 1 en marcha)"
git push origin main --tags
```

---

## Reglas Post-Setup

A partir de aquí, **nunca más commits directos a `main` ni a `develop`**. Todo va por `feature/*` → PR → `develop`, y luego `develop` → PR → `main`.

## Después del Setup: Lo Siguiente

1. **Crear el proyecto en Supabase** (nombre: `chatbot-ia-staging` y `chatbot-ia-prod`).
2. **Vincular el repo local:** `supabase link --project-ref <ref>`.
3. **Aplicar migraciones:** `supabase db push`.
4. **Configurar secretos** de Edge Functions:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase secrets set META_WA_VERIFY_TOKEN=...
   supabase secrets set META_APP_SECRET=...
   ```
5. **Configurar GitHub Secrets** para los workflows:
   - `SUPABASE_ACCESS_TOKEN`
   - `STAGING_SUPABASE_PROJECT_REF`, `PROD_SUPABASE_PROJECT_REF`
   - `STAGING_VITE_SUPABASE_URL`, `PROD_VITE_SUPABASE_URL`
   - `STAGING_VITE_SUPABASE_ANON_KEY`, `PROD_VITE_SUPABASE_ANON_KEY`
   - `PROD_SUPABASE_DB_PASSWORD`
   - `STAGING_APP_URL`, `PROD_APP_URL`
6. **Instalar dependencias y probar local:**
   ```bash
   pnpm install
   pnpm dev
   ```
7. **Crear el primer super_admin** (ver instrucciones en `supabase/seed/seed.sql`).
