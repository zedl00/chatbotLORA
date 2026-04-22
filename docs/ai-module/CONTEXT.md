# CONTEXT.md — ChatBot IA Empresarial

> **Ruta:** `/CONTEXT.md`

## 📌 Identidad del Proyecto

| Campo | Valor |
|---|---|
| **Nombre** | ChatBot IA Empresarial Omnicanal |
| **Versión actual** | 0.3.0 (Motor IA) |
| **Fase actual** | Fase 0 — Setup + RBAC + IA |
| **Sprint activo** | Sprint 3 — Motor IA completado |
| **Fecha de inicio** | 2026-04-21 |
| **Stack principal** | Vue 3 + Vite + TS + Tailwind + Pinia + Supabase + Claude API + Voyage AI |

## 🎯 Visión

Plataforma omnicanal de atención al cliente con IA. Claude atiende en primera línea sobre múltiples canales (WhatsApp, Instagram, Messenger, Telegram, Widget Web) con control granular de permisos, handoff automático a humanos, y métricas en tiempo real.

## 🧭 Principios arquitectónicos (no negociables)

1. **Repository Pattern obligatorio**
2. **Channel Adapter Pattern**
3. **RLS como primera línea de defensa**
4. **RBAC en backend + frontend**
5. **TypeScript estricto**
6. **Separación cliente/servidor de secretos** — `ANTHROPIC_API_KEY` solo en Edge Functions
7. **Conventional Commits**
8. **Componentes < 300 líneas**
9. **Sin librerías nuevas sin aprobación**

## 🤖 Motor IA (Sprint 3 — v0.3.0)

### Arquitectura

El motor IA vive íntegramente en Edge Functions de Supabase. El frontend nunca habla directamente con la API de Anthropic.

**Flujo:**
```
Canal → conversations → Edge Function (claude-chat) → Claude API
                                 ↓
                          Inserta message → Realtime → Frontend
```

### Componentes

- **`bot_personas`** — múltiples personalidades por org (Soporte, Ventas, General). Cada conversación puede tener asignada una.
- **System prompt compuesto** — identidad + objetivo + tono + restricciones + fallback + handoff + RAG context.
- **RAG con Voyage AI** — embeddings `voyage-3` (1024 dims), búsqueda coseno vía pgvector HNSW.
- **Clasificación automática** — Haiku clasifica cada mensaje del contacto: intent, sentiment, urgency, language, topics, entities.
- **Handoff detection** — si el bot empieza con `[HANDOFF]`, se desactiva IA y se sube prioridad.
- **Rate limiting** — circuit breaker automático tras 5 errores consecutivos (pausa de 10 min).
- **Budget tracking** — `ai_tokens_used` / `ai_tokens_limit` por org; se bloquea al superar el límite.
- **Usage log detallado** — cada llamada registra tokens, costo en microdólares, latencia, modelo.

### Modelos usados

- **Sonnet 4** — respuestas principales (calidad alta)
- **Haiku 4.5** — clasificación, sugerencias, resúmenes (rápido y barato)
- Configurable por persona

### Features de IA

| Operación | Modelo | Cuándo se invoca |
|---|---|---|
| `chat` | Sonnet (configurable) | Al recibir mensaje del contacto con `ai_active=true` |
| `classify` | Haiku | Async tras cada mensaje del contacto |
| `summarize` | Haiku | Bajo demanda (handoff) |
| `suggest` | Haiku | Bajo demanda (agente pide sugerencia) |
| `embed` | Voyage voyage-3 | Al crear/editar doc de knowledge_base |

## 👥 RBAC Enterprise (v0.2.0)

60+ permisos atómicos en 13 categorías. 5 roles del sistema + roles custom. Multiples roles por usuario, delegación temporal, permisos por equipo, auditoría automática. Composable `useCan`, directiva `v-can`, guard `permissionGuard`.

## 🔌 Canales (Sprints futuros)

1. **Widget Web** — próximo (Sprint 4)
2. **WhatsApp Business** — Sprint 5
3. **Instagram DM** — Sprint 6
4. **Messenger** — Sprint 6
5. **Telegram** — Sprint 6

## 📊 Estado Actual

### ✅ Completado
- [x] v0.1.0 — Setup inicial + RLS + auth
- [x] v0.2.0 — RBAC Enterprise
- [x] v0.3.0 — **Motor IA completo**:
  - [x] Schema: bot_personas, knowledge_chunks, message_classifications, ai_usage_log, ai_rate_limits
  - [x] 6 Edge Functions (chat, classify, summarize, suggest, embed, ai-test-message)
  - [x] Vista de configuración de personalidades
  - [x] Playground funcional
  - [x] Base de conocimiento con RAG
  - [x] Dashboard de tokens/costos del mes
  - [x] Circuit breaker automático
  - [x] Budget tracking por org

### 🚧 En pruebas
- [ ] Validación manual del flujo IA completo
- [ ] Primera conexión con API key real de Anthropic

### ⏭️ Siguiente (Sprint 4)
- [ ] Widget web embebible
- [ ] Inbox funcional con realtime
- [ ] Pipeline completo: visitante → widget → DB → bot → respuesta en widget

## 🗂️ Convenciones de Nombrado

- **Composables:** `useX.ts`
- **Stores Pinia:** `xStore`
- **Tipos:** `x.types.ts`
- **Repositorios:** `x.repo.ts`
- **Servicios externos:** `x.service.ts`
- **Directivas:** archivos sin prefijo → `can.ts`, registrar con `v-` → `v-can`
- **Componentes:** PascalCase
- **Rutas URL:** kebab-case
- **Permisos:** `recurso.accion` en snake_case
- **Edge Functions:** `claude-*` para IA, `user-*` para RBAC

## 📝 Decisiones Técnicas

| Fecha | Decisión | Razón |
|---|---|---|
| 2026-04-21 | Pinia sobre Vuex | Oficial Vue 3 |
| 2026-04-21 | Supabase sobre Firebase | PostgreSQL + RLS + Edge Functions + pgvector |
| 2026-04-21 | Claude Sonnet 4 sobre GPT-4o | Mejor balance costo/calidad para conversacional ES |
| 2026-04-22 | RBAC granular sobre roles fijos | Requisito enterprise; permite roles custom |
| 2026-04-23 | **Voyage AI sobre OpenAI/Cohere para embeddings** | Partner oficial de Anthropic, tier gratuito 50M tokens/mes, mejor multilingual que OpenAI |
| 2026-04-23 | **Costos en microdólares (BIGINT)** | Precisión sin floats; 1 USD = 1M micro |
| 2026-04-23 | **IA en Edge Functions, nunca en frontend** | API key no expuesta; reintento en servidor |
| 2026-04-23 | **Circuit breaker tras 5 errores** | Evita gastar saldo en loops cuando Anthropic tiene problemas |
| 2026-04-23 | **Clasificación async, no bloqueante** | No retrasa la respuesta del bot al usuario |
| 2026-04-23 | **Múltiples bot_personas por org** | Soporte/Ventas/General con prompts distintos |

## 💰 Estimación de costos

| Operación | Tokens típicos | Costo por 1000 operaciones |
|---|---|---|
| Chat (Sonnet) | 2000 in + 400 out | $12 |
| Classify (Haiku) | 300 in + 100 out | $0.80 |
| Summarize (Haiku) | 1500 in + 150 out | $2.25 |
| Suggest (Haiku) | 800 in + 100 out | $1.30 |
| Embed (Voyage) | 500 tokens | Gratis (tier) |

**Volumen típico mensual** (100 conversaciones/día, ~10 msg c/u, 30 días):
- 30k chats, 30k classifies, 500 summarizes, 1k suggestions
- Costo estimado: ~$380 USD/mes

## ⚠️ Riesgos

1. **Aprobación Meta App Review** tarda semanas — mitigación: Widget Web primero (Sprint 4).
2. **Loops de Claude generando costos** — mitigación: circuit breaker + budget limit.
3. **RLS mal configurado** = fuga entre orgs — mitigación: tests automatizados.
4. **Voyage tier gratuito insuficiente** con crecimiento — mitigación: monitorear y upgrear plan ($0.10/1M tokens).
5. **Prompts mal escritos** = bot alucinando — mitigación: sistema de personas + RAG + restricciones explícitas.

## 🔐 Secrets requeridos en Supabase

```bash
# RBAC (opcional - emails)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@dominio.com
APP_URL=https://app.dominio.com

# IA (obligatorio)
ANTHROPIC_API_KEY=sk-ant-...

# RAG (opcional)
VOYAGE_API_KEY=pa-...
```

---

**Mantenedor:** Dueño del proyecto
**Última actualización:** 2026-04-23
