# CHANGELOG

Todos los cambios notables se documentan aquí. Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) / [SemVer](https://semver.org/lang/es/).

---

## [0.3.0] - 2026-04-23 — Motor IA

### Added

**Base de datos**
- Migración `20260423000001_ai_schema.sql` con 5 tablas nuevas:
  `bot_personas`, `knowledge_chunks`, `message_classifications`, `ai_usage_log`, `ai_rate_limits`.
- Nuevos enums: `ai_operation`, `intent_category`, `sentiment`, `urgency_level`.
- Columna `bot_persona_id` en `conversations` y `default_persona_id` en `channels`.
- Función `match_knowledge_chunks()` para búsqueda semántica con pgvector HNSW.
- Función `get_current_month_tokens()` para el dashboard.
- Función `register_ai_usage()` atómica que incrementa contador de org y actualiza rate-limits.
- Vista `v_ai_usage_monthly` agrupada por org/operación/modelo.
- Seed de persona "Asistente General" por defecto para la org demo.

**Edge Functions**
- `_shared/anthropic.ts` — helper compartido con `callClaude`, `buildSystemPrompt`, `calculateCostMicroUsd`, `MODEL_PRICING`.
- `claude-chat/` — motor principal del bot: resuelve persona, carga historial, busca RAG, detecta handoff, inserta mensaje, dispara clasificación async.
- `claude-classify/` — clasificación async con Haiku en JSON mode: intent, sentiment, urgency, language, topics, entities, confidence.
- `claude-summarize/` — resumen estructurado de conversación para handoff a agente humano.
- `claude-suggest/` — sugerencia de respuesta para agente humano; acepta hint opcional.
- `claude-embed/` — chunking automático + embeddings con Voyage AI (`voyage-3`, 1024 dims).
- `ai-test-message/` — playground injector: crea conversación de prueba y dispara el bot.

**Frontend — Tipos y servicios**
- `src/types/ai.types.ts` — BotPersona, MessageClassification, AiUsageEntry, constantes (CLAUDE_MODELS, TONE_OPTIONS, LANGUAGE_OPTIONS, INTENT_LABELS, SENTIMENT_LABELS, URGENCY_LABELS).
- `src/repository/supabase/ai.repo.ts` — CRUD completo de personas, knowledge, clasificaciones, usage.
- `src/services/claude.service.ts` — wrappers de las 6 Edge Functions (chatRespond, chatDryRun, classifyMessage, summarizeConversation, suggestReply, embedKnowledgeDoc, playgroundSend).

**Frontend — Vistas**
- `/admin/ai-personas` (`AiPersonasView.vue`) — CRUD de personalidades con editor de system prompt compuesto, selección de modelo, temperatura, configuración RAG, features opcionales.
- `/admin/playground` (`PlaygroundView.vue`) — chat UI para probar el bot sin canales reales; muestra metadata por mensaje (latencia, tokens, costo, RAG, handoff).
- `/admin/knowledge` (`KnowledgeView.vue`) — CRUD de documentos con indexación automática vía Voyage; manejo gracioso cuando falta VOYAGE_API_KEY.
- `/admin/dashboard` (`DashboardView.vue`) — KPIs con sección "Consumo de IA" (tokens, costo USD, llamadas, errores, % del límite mensual).

**Seguridad y control de costos**
- Circuit breaker automático: pausa IA por 10 min tras 5 errores consecutivos de Anthropic.
- Budget tracking: bloquea llamadas cuando `ai_tokens_used >= ai_tokens_limit`.
- Rate-limit check previo a cada llamada.
- Costos almacenados en microdólares (BIGINT) para precisión sin floats.
- Priority elevation automática cuando `urgency='urgent'` o `urgency='high'`.

**Documentación**
- `docs/AI_INTEGRATION.md` — guía completa de integración, prerequisitos, testing, troubleshooting.
- `docs/AI_COMMITS.md` — plan de commits atómicos.

### Changed

- `src/repository/index.ts` — expone `ai` en el factory.
- `src/router/index.ts` — nuevas rutas `/admin/ai-personas` y `/admin/playground` con `meta.permission: 'ai.configure'`.
- `src/layouts/AdminLayout.vue` — nueva sección **"IA"** en el menú con Personalidades, Playground y Conocimiento.

### Security

- `ANTHROPIC_API_KEY` y `VOYAGE_API_KEY` solo en Supabase secrets, nunca en el frontend.
- Todas las Edge Functions de IA requieren JWT válido (verify-jwt por defecto).
- `claude-summarize` y `claude-suggest` respetan RLS del usuario (usan cliente autenticado para verificar acceso a conversación).
- RLS activa en las 5 tablas nuevas con policies por `ai.configure` y `ai.view_costs`.

---

## [0.2.0] - 2026-04-22 — RBAC Enterprise

### Added
- Schema RBAC con 7 tablas nuevas (permissions, roles, role_permissions, user_roles, user_permissions, invitations, permission_audit_log).
- 60+ permisos atómicos en 13 categorías. 5 roles del sistema.
- Funciones `has_permission()`, `get_user_permissions()`, `current_user_has()`.
- Migración automática de `users.role` legacy a `user_roles`.
- 3 Edge Functions (user-invite, user-accept-invite, user-create).
- UI: UsersView, RolesView, InvitationsView, AuditLogView, modales, AcceptInviteView, ChangePasswordView.
- Composable `useCan`, directiva `v-can`, store `permissions.store`.
- Guard `permissionGuard` y `mustChangePasswordGuard`.

### Changed
- `src/main.ts` registra `v-can`.
- `src/stores/auth.store.ts` carga permisos tras login, limpia al signout, agrega `updatePassword` y `refreshPermissions`.
- `src/repository/index.ts` expone `rbac` y `users`.
- `src/router/index.ts` usa `meta.permission` en lugar de `meta.roles`.
- `src/layouts/AdminLayout.vue` con menú agrupado y filtrado por permisos.

### Deprecated
- `users.role` (mantiene compatibilidad hacia atrás).
- `roleGuard` (usar `permissionGuard`).

### Security
- Tokens de invitación con 256 bits de entropía (`gen_random_bytes(32)`).
- Auditoría automática vía triggers (imposible saltar desde cliente).

### Fixed
- Columna `grant` (palabra reservada SQL) renombrada a `is_granted` en `user_permissions`.

---

## [0.1.0] - 2026-04-21 — Setup Inicial

### Added
- Estructura base del proyecto (Vue 3 + Vite + TS + Pinia + Tailwind + Supabase).
- 14 tablas base con RLS activo.
- Auth completo (login, logout, forgot password).
- Repository Pattern con implementaciones Supabase.
- Layouts, router con guards, stores base.
- Edge Function esqueleto meta-webhook.
- CI/CD GitHub Actions.
- Docs base (ARCHITECTURE, DATABASE, GIT_WORKFLOW).
