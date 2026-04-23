# 🚀 LORA - Proyecto ChatBot IA Empresarial

> **Propietario:** Norson Group (República Dominicana)
> **Estado:** ✅ En producción en https://lora.jabenter.com
> **Última actualización:** 22 abril 2026

---

## 🎯 Resumen del producto

LORA es un SaaS de chatbot IA omnicanal empresarial. Permite a empresas embeber un widget de chat en su sitio web donde un bot IA (Claude) responde automáticamente. Los agentes humanos pueden tomar conversaciones cuando sea necesario a través de un inbox tipo WhatsApp/Messenger.

**Modelo de negocio:** SaaS multi-empresa con subdominios dedicados por cliente (ej: `empresa-a.jabenter.com`, `empresa-b.jabenter.com`).

---

## 📊 Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Vue 3 + Vite + TypeScript + Pinia + Tailwind CSS |
| Backend | Supabase (Postgres + Edge Functions Deno + Realtime + Auth) |
| IA | Anthropic Claude (modelo actual: `claude-haiku-4-5`) |
| Hosting | cPanel reseller en Dominet.net |
| Dominio | jabenter.com (GoDaddy) |
| Repositorio | github.com/zedl00/ChatbotLORA (privado) |

---

## ✅ Sprints completados (pasar a ESTADO: DONE en Notion)

### Sprint 1 — Setup base y auth (v0.1.0)
- Estructura Vue 3 + Vite + TS + Pinia + Tailwind
- 14 tablas base con RLS
- Auth completo (login, registro, reset password)
- Repository Pattern
- Layouts, router, guards

### Sprint 2.5 — RBAC Enterprise (v0.2.0)
- 7 tablas adicionales (roles, permisos, invitaciones, auditoría)
- 60+ permisos atómicos
- 5 roles del sistema + custom
- Invitaciones con tokens
- Auditoría automática
- UI: Usuarios, Roles, Invitaciones, Auditoría

### Sprint 3 — Motor IA Claude (v0.3.0)
- 5 tablas AI (bot_personas, knowledge_chunks, classifications, usage_log, rate_limits)
- 6 Edge Functions:
  - `claude-chat` (respuesta del bot)
  - `claude-classify` (intención, sentimiento)
  - `claude-summarize` (resumen de conversación)
  - `claude-suggest` (sugerencias para agentes)
  - `claude-embed` (embeddings RAG)
  - `ai-test-message` (Playground)
- Knowledge Base con RAG
- Dashboard de consumo IA
- Circuit breaker + budget tracking

### Sprint 4 — Widget Web + Inbox Funcional (v0.4.0)
- 2 tablas nuevas (widget_configs, widget_sessions)
- 2 Edge Functions públicas (widget-session, widget-message)
- Widget embebible vanilla JS (~38 KB, sin dependencias)
- Inbox 3 paneles estilo WhatsApp
- Realtime bidireccional (widget ↔ inbox)
- Features: asignación, tags, notas, toggle IA, resumen IA, sugerencias IA
- Snippet de instalación copy-paste

### Sprint 4.5 — Deploy Producción ✨ (recién completado)
- Repo GitHub creado
- Deploy en https://lora.jabenter.com
- HTTPS con AutoSSL
- FTP configurado (cuenta lora@jabenter.com)
- $5 cargados en Anthropic
- Bot respondiendo con `claude-haiku-4-5`
- Widget probado end-to-end desde sitio externo (CodePen)
- Todas las Edge Functions actualizadas con MODEL_PRICING

---

## 🟠 Sprint 5 — Multi-empresa con subdominios (EN PROGRESO)

> **Objetivo:** Cada cliente empresa tendrá su propio subdominio (ej: `empresa-a.jabenter.com`) con branding dedicado y datos aislados, permitiendo onboarding automático de clientes.

### 🎯 Alcance

- Detectar el subdominio desde el hostname del navegador
- Cargar la organización correspondiente automáticamente
- Aislar datos entre clientes (RLS ya lo hace)
- Branding dinámico (logo, colores, nombre) por cliente
- Super admin puede crear nuevas empresas con wizard

### 📝 Tareas

#### 1. Infraestructura DNS + SSL
- [ ] Crear subdominio wildcard `*.jabenter.com` en cPanel
- [ ] Verificar propagación DNS (esperar hasta 1h)
- [ ] Activar SSL wildcard (Let's Encrypt o AutoSSL)
- [ ] Probar que `demo.jabenter.com` y `test.jabenter.com` apuntan a la misma app

#### 2. Base de datos
- [ ] Migración SQL: añadir columna `subdomain VARCHAR(63) UNIQUE NOT NULL` a tabla `organizations`
- [ ] Índice único en `subdomain`
- [ ] Seed inicial: asignar subdominio `admin` a Norson Group
- [ ] Actualizar RLS para que queries filtren por subdomain cuando aplique

#### 3. Frontend — Detección de contexto
- [ ] Composable `useOrganizationContext()` que:
  - Lee el hostname actual (ej: `demo.jabenter.com`)
  - Extrae el subdomain (`demo`)
  - Busca la organización en Supabase
  - Guarda el contexto en un store (`organization.store.ts`)
- [ ] Interceptor en router que redirige si el subdomain no existe

#### 4. Frontend — Login contextualizado
- [ ] Validar que al hacer login, el usuario pertenezca a la organización del subdomain actual
- [ ] Si no pertenece → mostrar error "Este usuario no tiene acceso a esta empresa"
- [ ] Si accede sin subdomain (solo `jabenter.com`) → redirigir a `admin.jabenter.com` o mostrar selector

#### 5. Branding dinámico
- [ ] Añadir columnas `logo_url`, `primary_color`, `brand_name` a tabla `organizations`
- [ ] Componente `<AppBranding />` que consume el contexto y aplica los estilos
- [ ] Actualizar AdminLayout.vue para mostrar el logo/nombre de la org actual

#### 6. Super admin — Gestión de organizaciones
- [ ] Vista `OrganizationsView.vue` (solo para rol `super_admin`)
- [ ] CRUD completo de organizaciones (crear, editar, desactivar)
- [ ] Wizard "crear nueva empresa":
  - Datos básicos (nombre, subdomain, logo, color)
  - Crear organización
  - Crear canal web_widget por defecto
  - Crear bot_persona default
  - Crear rol "admin" y usuario admin inicial
  - Generar link de invitación para el admin de la empresa cliente

#### 7. Testing end-to-end
- [ ] Crear organización demo en `demo.jabenter.com`
- [ ] Verificar que RLS aísla datos entre orgs
- [ ] Probar widget con `channel_id` de la org demo
- [ ] Confirmar que agentes de Norson NO ven conversaciones de demo

**Duración estimada:** 3-4 horas

---

## 📋 Backlog (ordenado por prioridad del usuario)

### Sprint 6 — Arreglar bug de notas internas
> **Pendiente:** Las notas internas en ContactPanel.vue del Inbox no se guardan al hacer submit.
- [ ] Investigar ContactPanel.vue — verificar que el repositorio esté guardando
- [ ] Revisar la tabla `conversation_notes` y RLS
- [ ] Agregar feedback visual al guardar
- [ ] Añadir tests manuales del flujo

**Duración estimada:** 1 hora

### Sprint 7 — Renombrar UI "ChatBot IA" → "LORA"
- [ ] AdminLayout.vue (header, sidebar)
- [ ] Title del documento HTML
- [ ] package.json (name)
- [ ] Manifest / meta tags
- [ ] README
- [ ] Mensajes de bienvenida / toasts

**Duración estimada:** 30 minutos

### Sprint 8 — Telegram como 2do canal
- [ ] Crear bot en Telegram via @BotFather
- [ ] Tabla `telegram_integrations` con token del bot por org
- [ ] Edge Function `telegram-webhook` para recibir mensajes
- [ ] Mapeo Telegram message → formato interno de LORA
- [ ] Responder por Telegram desde el bot IA
- [ ] UI de configuración en `/admin/channels`

**Duración estimada:** 2-3 horas

### Sprint 9 — Personalización avanzada del widget
- [ ] Editor visual de branding avanzado
- [ ] Subir logo propio (Supabase Storage)
- [ ] Ajustar textos de bienvenida / placeholders
- [ ] Posición configurable (derecha/izquierda, offset)
- [ ] Auto-open con delay configurable
- [ ] Pre-chat form opcional (nombre, email)
- [ ] Modo oscuro/claro

**Duración estimada:** 2 horas

---

## 🗓️ Backlog futuro (sin fecha, planear después)

| Sprint | Tema | Estimado |
|---|---|---|
| 10 | Landing comercial + Marketing | 4h |
| 11 | Facturación con Stripe | 6h |
| 12 | WhatsApp Business API | 4h + espera Meta |
| 13 | Constructor visual de flujos | 8h |
| 14 | Instagram + Messenger | 4h |
| 15 | Reportes avanzados + CSAT | 4h |
| 16 | Constructor de bot sin código | 6h |
| 17 | API pública + webhooks | 8h |

---

## 🔑 Credenciales y URLs (referencia rápida)

### URLs de producción
- **Admin app:** https://lora.jabenter.com
- **Widget JS:** https://lora.jabenter.com/widget.js
- **Supabase:** https://supabase.com/dashboard/project/imvahmyywbtcfsduwbdq
- **GitHub:** https://github.com/zedl00/ChatbotLORA

### IDs del sistema
- **Supabase Project:** `imvahmyywbtcfsduwbdq`
- **Organization ID (Norson):** `a31f7ca6-5361-4d93-a8a2-938b7bdfde43`
- **Channel ID (web_widget Norson):** `033fd98f-be93-4bf5-b090-94e26f091d94`
- **User ID principal:** `f8c1ecb6-2230-448b-9508-140e97d5ba5e`

### FTP
- **Host:** ftp.jabenter.com
- **Usuario:** lora@jabenter.com
- **Ruta:** /public_html/lora/

### Flujo de deploy
```bash
npm run build
# Luego en CoreFTP: borrar /public_html/lora/* y subir contenido de dist/
```

---

## 💰 Economía del proyecto

### Costos actuales
- Hosting (cPanel): $0 (ya pagado)
- Supabase: $0 (plan Free)
- Anthropic: pay-per-use ($5 cargados)
- Dominio: ~$12/año

### Proyecciones
- **Costo por mensaje:** ~$0.0005-0.001 con claude-haiku-4-5
- **$5 alcanzan para:** ~5,000-10,000 mensajes
- **Con 10 clientes activos:** ~$75/mes costos
- **Ingresos a $49/mes por cliente (10 clientes):** $490/mes
- **Margen estimado:** ~$415/mes con 10 clientes

---

## 🐛 Bugs conocidos

### BUG-001: Notas internas no se guardan
- **Ubicación:** ContactPanel.vue del Inbox
- **Prioridad:** Media
- **Estado:** Sprint 6

### BUG-002 (a verificar): Posible error al recargar Inbox con conversación abierta
- **Estado:** A investigar cuando aparezca

---

## 📝 Historial de sesiones importantes

### 22 abril 2026 — Deploy a producción
- Deploy de Sprint 4 a producción
- HTTPS funcionando
- Bot IA operativo con Claude Haiku 4.5
- Widget validado end-to-end
- FTP configurado
- 8 Edge Functions redesplegadas (bug MODEL_PRICING resuelto)
- Playground con adapter de respuesta

**Problemas resueltos:**
- sender_id vs sender_agent_id en DB
- RLS realtime del widget
- API key expuesta en git (rotada + reset historial)
- 21 errores TS en build (cleanup _modified/)
- Modelo claude-sonnet-4-20250514 obsoleto → haiku-4-5
- MODEL_PRICING undefined en edges
- Playground "(sin respuesta)"
- FTP config inicial incorrecta

---

## 🎯 Próximo paso inmediato

**Abrir nueva conversación con Claude** y arrancar Sprint 5 (Multi-empresa con subdominios) usando el prompt exhaustivo preparado.
