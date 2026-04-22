# CHANGELOG v0.4.0 — Widget Web + Inbox Funcional

## [0.4.0] - 2026-04-24

### Added

**Base de datos**
- Migración `20260424000001_widget_inbox.sql` con 2 tablas nuevas (`widget_configs`, `widget_sessions`), columnas adicionales en `conversations` (`unread_count`, `last_message_preview`, `last_message_at`), vista `v_inbox_conversations` que joinea conversation + contact + agent + última clasificación, y funciones `mark_conversation_read`, `assign_conversation`, `toggle_conversation_ai`.
- Trigger `update_conversation_on_message` actualiza preview y unread_count automáticamente al insertar mensajes.
- Realtime publicado para `conversations` y `messages` (si no lo estaba ya).
- Seed de `widget_configs` para canales `web_widget` existentes.

**Edge Functions (públicas, sin JWT)**
- `widget-session` - Inicia/retoma sesión del widget por `visitor_id`, crea contacto si es nuevo, retorna config visual + mensajes existentes. Valida `allowed_origins`.
- `widget-message` - Recibe mensaje del visitante, crea conversación si no existe, invoca `claude-chat` si `ai_active`, retorna ambos mensajes.

**Widget embebible (`widget.js`)**
- Script standalone vanilla JS, 0 dependencias, 38 KB.
- Se configura via data-attributes en el script tag.
- Persistencia de `visitor_id` en localStorage (30 días).
- Realtime via WebSocket con fallback a polling.
- UI completa: launcher flotante, panel expandible, header personalizable, lista de mensajes, typing indicator, input autosized.
- Pre-chat form configurable (nombre, email, teléfono).
- Notificación visual cuando llega mensaje con widget cerrado.
- Carga dinámica de `supabase-js` desde CDN para realtime.

**Frontend - Inbox**
- Vista `/admin/inbox` con layout de 3 paneles estilo WhatsApp.
- `ConversationList.vue` (panel izquierdo) con filtros: mías/sin asignar/todas, unread only, búsqueda por nombre/mensaje, chips de etiquetas.
- `ConversationThread.vue` (panel central) con mensajes en tiempo real, botones contextuales: Tomar, Toggle IA, Resolver, Resumen IA, Sugerencia IA.
- `ContactPanel.vue` (panel derecho) con info del contacto, etiquetas editables, estado de conversación, notas internas.
- Contadores de no leídos, badges de urgencia/sentimiento del último mensaje.
- Integración con `claude-summarize` y `claude-suggest` del Sprint 3.

**Frontend - Channels**
- `/admin/channels` con lista de canales, toggle activo, `WidgetConfigEditor.vue` para personalización visual y `WidgetInstallSnippet.vue` con el código ready-to-copy.

**Composables**
- `useRealtimeInbox` para suscribirse a INSERT/UPDATE de `conversations` y `messages` a nivel organización.
- `useRealtimeConversation` para una sola conversación.

**Docs**
- `docs/WIDGET_INBOX_INTEGRATION.md` - guía completa de integración.
- `docs/WIDGET_INBOX_COMMITS.md` - plan de commits atómicos.
- `widget/public/demo.html` - página demo lista para probar el widget local.

### Changed

- `src/router/index.ts` - `/admin/inbox` y `/admin/channels` ahora apuntan a las vistas funcionales (antes placeholders).
- `conversations` - columnas adicionales (no-breaking: tienen defaults).

### Security

- `widget-session` y `widget-message` son públicas pero validan `allowed_origins` del widget_config (por default `['*']`, configurable).
- RLS aplicado a `widget_configs` y `widget_sessions` (solo lectura para usuarios de la org con permiso).
- Inserción de datos del widget pasa por SERVICE_ROLE desde la Edge Function, nunca desde el cliente.

### Fixed

- N/A (primera implementación del módulo).
