# ChatBot IA Empresarial Omnicanal

> **Ruta:** `/README.md`

Panel omnicanal de atención al cliente con IA (Claude de Anthropic), integrado a WhatsApp Business, Instagram DM, Messenger, Telegram y Widget Web.

**Stack:** Vue 3 · Vite · TypeScript · Tailwind CSS · Pinia · Supabase · Claude API

---

## 📚 Documentación Clave

| Documento | Qué contiene |
|---|---|
| [`CONTEXT.md`](./CONTEXT.md) | Visión, principios, estado actual, decisiones técnicas |
| [`CHANGELOG.md`](./CHANGELOG.md) | Historial de versiones |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Arquitectura técnica en detalle |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | Schema de base de datos |
| [`docs/GIT_WORKFLOW.md`](./docs/GIT_WORKFLOW.md) | Flujo Git y convenciones de commits |

---

## 🚀 Arranque Local — Paso a Paso

### 1. Requisitos

- **Node.js 20+** ([descargar](https://nodejs.org))
- **pnpm** o **npm** (se recomienda `pnpm`)
- **Git**
- **Supabase CLI** ([guía](https://supabase.com/docs/guides/cli))
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Anthropic Console](https://console.anthropic.com) para obtener `ANTHROPIC_API_KEY`

### 2. Clonar e Instalar

```bash
git clone https://github.com/[usuario]/chatbot-ia-empresarial.git
cd chatbot-ia-empresarial
pnpm install     # o: npm install
```

### 3. Configurar Variables de Entorno

```bash
cp .env.example .env.local
# Editar .env.local con tus credenciales reales
```

**NUNCA commitear `.env.local`.** Ver `.gitignore`.

### 4. Crear Proyecto en Supabase

1. Entrar a [app.supabase.com](https://app.supabase.com) → New Project.
2. Copiar `Project URL` y `anon key` a `.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Copiar `service_role key` (solo para Edge Functions) → `SUPABASE_SERVICE_ROLE_KEY`.

### 5. Aplicar Migraciones de Base de Datos

```bash
# Login en Supabase CLI
supabase login

# Vincular al proyecto remoto
supabase link --project-ref <project-ref>

# Aplicar migraciones (crea todas las tablas, RLS, triggers)
supabase db push

# (Opcional) Cargar datos de prueba
supabase db reset   # ejecuta migraciones + seed
```

### 6. Desplegar Edge Functions

```bash
# Configurar secretos de las funciones
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set META_WA_ACCESS_TOKEN=...
supabase secrets set META_APP_SECRET=...

# Desplegar webhook de Meta
supabase functions deploy meta-webhook
```

### 7. Correr en Desarrollo

```bash
pnpm dev    # http://localhost:5173
```

### 8. Build de Producción

```bash
pnpm build
pnpm preview
```

---

## 🧭 Estructura del Proyecto

```
chatbot-ia-empresarial/
├── .github/workflows/     # CI/CD
├── docs/                  # Documentación técnica
├── public/                # Assets estáticos
├── scripts/               # Scripts utilitarios (notion-sync, etc.)
├── src/
│   ├── assets/            # Imágenes, fuentes
│   ├── components/        # UI components (ui/, chat/, admin/, flow/)
│   ├── composables/       # Lógica reutilizable (useConversations, useAI, ...)
│   ├── layouts/           # AdminLayout, AuthLayout, WidgetLayout
│   ├── modules/           # Módulos funcionales (auth, inbox, contacts, ...)
│   ├── repository/        # ⚡ Capa de abstracción de datos
│   ├── router/            # Vue Router + guards
│   ├── services/          # Clientes externos (claude, meta, telegram, ...)
│   ├── stores/            # Pinia stores
│   ├── types/             # TypeScript types
│   └── utils/             # Helpers
├── supabase/
│   ├── functions/         # Edge Functions (Deno)
│   ├── migrations/        # Migraciones SQL versionadas
│   └── seed/              # Datos iniciales
├── widget/                # Widget web embebible (build separado)
├── CONTEXT.md             # 📌 Visión del proyecto
├── CHANGELOG.md           # 📌 Historial de versiones
└── README.md
```

> **🔑 Clave:** El directorio `src/repository/` es la capa de abstracción. Ningún componente llama a Supabase directamente — todo pasa por el repositorio. Esto permite migrar de Supabase a otra base de datos sin tocar la lógica de la app.

---

## 🧪 Scripts Disponibles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo con HMR |
| `pnpm build` | Build de producción |
| `pnpm preview` | Preview del build |
| `pnpm typecheck` | Revisión de tipos TS |
| `pnpm lint` | Lint del código |
| `pnpm format` | Formatear con Prettier |

---

## 🌿 Flujo Git Resumido

Ver [`docs/GIT_WORKFLOW.md`](./docs/GIT_WORKFLOW.md) para el detalle completo.

- `main` → producción (solo merge vía PR aprobado)
- `develop` → staging (integración)
- `feature/<nombre>` → nueva funcionalidad
- `fix/<nombre>` → corrección
- `hotfix/<nombre>` → urgencia en producción

**Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, ...).

---

## 🧩 Agregar un Nuevo Canal

1. Crear `src/services/<canal>.service.ts` implementando la interfaz `ChannelAdapter`.
2. Crear Edge Function del webhook en `supabase/functions/<canal>-webhook/`.
3. Insertar registro en tabla `channels`.
4. Agregar variables de entorno al `.env.example`.

---

## 🔐 Seguridad — No Negociable

- Nunca commitear `.env*` con valores reales.
- Claves de servidor (`ANTHROPIC_API_KEY`, tokens Meta) **nunca** con prefijo `VITE_*`.
- RLS activado en todas las tablas.
- Rotar tokens inmediatamente si se exponen.

---

## 🆘 Soporte / Contacto

Ante cualquier duda técnica, documentarla en la tarea de Notion correspondiente y consultarla en el check-in semanal.

---

**Versión:** 0.1.0 · **Licencia:** Propietaria · **Confidencial**
