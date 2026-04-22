# Arquitectura Técnica

> **Ruta:** `/docs/ARCHITECTURE.md`

## 📐 Diagrama de Capas

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Vue 3 SPA)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Componentes + Composables + Stores (Pinia)              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  REPOSITORY LAYER  ⭐  (src/repository/)                 │   │
│  │  IRepository<T> — Contrato único                         │   │
│  │     └─ SupabaseXxxRepo (impl actual)                     │   │
│  │     └─ FirebaseXxxRepo (futuro, si se decide migrar)     │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                  ┌──────────────┼──────────────────┐
                  ↓              ↓                  ↓
   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐
   │ SUPABASE (BaaS)  │  │  EDGE FUNCTIONS  │  │ REALTIME (WS)  │
   │ PostgreSQL + RLS │  │  Deno / TypeScript│  │ Subscriptions  │
   │ Auth + Storage   │  │  - meta-webhook  │  │ conversations  │
   │ pgvector (RAG)   │  │  - claude-chat   │  │ messages       │
   └──────────────────┘  │  - notion-sync   │  │ agents         │
                         └──────────────────┘  └────────────────┘
                                 │
                  ┌──────────────┼──────────────────┐
                  ↓              ↓                  ↓
        ┌───────────────┐  ┌──────────┐    ┌──────────────┐
        │  CLAUDE API   │  │  META    │    │  TELEGRAM    │
        │  (Anthropic)  │  │  WA/IG/  │    │  /  TWILIO   │
        │  Sonnet 4     │  │  Messen. │    │  /  ...      │
        └───────────────┘  └──────────┘    └──────────────┘
```

## 🧩 Principios Arquitectónicos

### 1. Repository Pattern (desacoplamiento de DB)

Ningún composable, store o componente llama a `@supabase/supabase-js` directamente.  
Todo pasa por `src/repository/`. Esto permite:
- **Migrar de proveedor** sin reescribir la app (solo crear `firebase/`, `prisma/`, etc.).
- **Testear** con un mock del repo.
- **Agregar caching o logging** en un solo punto.

**Regla:** `supabase` se importa únicamente en:
- `src/services/supabase.client.ts` (definición del cliente)
- `src/repository/supabase/*.repo.ts` (implementaciones)
- `src/stores/auth.store.ts` (para `auth.getSession()` — excepción explícita)

### 2. Channel Adapter Pattern

Todos los canales (WhatsApp, Instagram, Telegram, Widget) implementan `ChannelAdapter` (ver `src/types/channel.types.ts`).  
Agregar un canal nuevo = crear un servicio + webhook. Nada del código interno cambia.

### 3. Multi-tenancy + RLS

Cada registro pertenece a una `organization_id`. Las políticas RLS garantizan aislamiento estricto por organización y rol. La defensa real es la DB; los guards de Vue Router son solo UX.

### 4. Separación Cliente/Servidor de Secretos

| Variable | Cliente | Servidor |
|---|:---:|:---:|
| `VITE_SUPABASE_URL` | ✅ | ✅ |
| `VITE_SUPABASE_ANON_KEY` | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | ✅ |
| `ANTHROPIC_API_KEY` | ❌ | ✅ |
| `META_*_ACCESS_TOKEN` | ❌ | ✅ |

Los secretos solo viven en Supabase Edge Functions vía `supabase secrets set`.

## 🔀 Flujo de un Mensaje Entrante

```
1. Usuario escribe por WhatsApp
        ↓
2. Meta envía POST a /functions/v1/meta-webhook
        ↓
3. Edge Function valida firma HMAC-SHA256
        ↓
4. Busca/crea contact por channel_identities
        ↓
5. Busca/crea conversation activa
        ↓
6. INSERT en messages → triggers actualizan:
      - conversations.last_message_at
      - conversations.unread_count
      - conversations.first_response_at (si aplica)
        ↓
7. Si ai_active=true → invoca Edge Function claude-chat
        ↓
8. claude-chat: arma system prompt + RAG + historial
        ↓
9. Llama a Anthropic Claude API (Sonnet 4)
        ↓
10. INSERT del mensaje del bot → sale por Meta Send API
        ↓
11. Supabase Realtime propaga INSERT a todos los paneles abiertos
```

## 🗂️ Convención de Módulos

Un módulo funcional vive en `src/modules/<nombre>/` y contiene:

```
modules/inbox/
├── views/              # Vistas principales (rutas)
├── components/         # Componentes específicos del módulo
├── composables/        # Lógica específica (si aplica)
└── types.ts           # Tipos del módulo (opcional)
```

**Principio:** Un módulo no importa de otro módulo. Si dos módulos necesitan algo, ese algo va en `/src/components/`, `/src/composables/` o `/src/repository/`.

## 📦 Bundles y Build

Vite divide el build en chunks:
- `vue-vendor` — Vue, Router, Pinia
- `supabase-vendor` — Supabase JS
- `chart-vendor` — Chart.js + vue-chartjs
- `index` — código de la app

Así el navegador cachea vendors largos entre deploys.

## 🧪 Estrategia de Testing (futuro)

| Capa | Tipo de test | Herramienta |
|---|---|---|
| Repository | Unit con mock de Supabase | Vitest |
| Composables | Unit con stores mockeados | Vitest |
| Componentes | Component testing | Vitest + Testing Library |
| Edge Functions | Integration | Deno test |
| RLS | Integration contra DB de test | pgTAP / script custom |
| E2E | Flujos completos | Playwright |

A implementar en Sprint 8.
