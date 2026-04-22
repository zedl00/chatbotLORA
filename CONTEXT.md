# CONTEXT.md — ChatBot IA Empresarial

> **Ruta:** `/CONTEXT.md`
> **Propósito:** Fuente de verdad sobre la visión, estado actual y decisiones del proyecto.
> **Mantener:** Actualizar al cierre de cada sprint y al tomar decisiones técnicas importantes.

---

## 📌 Identidad del Proyecto

| Campo | Valor |
|---|---|
| **Nombre** | ChatBot IA Empresarial Omnicanal |
| **Versión actual** | 0.1.0 (Setup inicial) |
| **Fase actual** | Fase 0 — Setup |
| **Sprint activo** | Sprint 1 — Setup del proyecto y autenticación |
| **Fecha de inicio** | 2026-04-21 |
| **Stack principal** | Vue 3 + Vite + TS + Tailwind + Pinia + Supabase + Claude API |

---

## 🎯 Visión

Desarrollar un ChatBot empresarial omnicanal de clase mundial, con inteligencia artificial (Claude de Anthropic) como primera línea de atención, capaz de operar sobre múltiples canales (WhatsApp, Instagram, Messenger, Telegram, Widget Web), con panel administrativo en tiempo real, handoff a agentes humanos, métricas de rendimiento, y arquitectura intercambiable de base de datos.

## 🧭 Principios Arquitectónicos (No Negociables)

1. **Repository Pattern obligatorio** — Ningún componente o store llama a Supabase directamente. Todo pasa por `src/repository/`.
2. **Channel Adapter Pattern** — Todos los canales implementan la misma interfaz `ChannelAdapter`.
3. **RLS como primera línea de defensa** — Supabase Row Level Security en TODAS las tablas.
4. **TypeScript estricto** — `strict: true` en `tsconfig.json`.
5. **Separación Cliente/Servidor de secretos** — Variables `VITE_*` solo para claves públicas. Secretos del servidor van en Edge Functions.
6. **Conventional Commits** sin excepción.
7. **Componentes < 300 líneas**. Si crecen, se dividen.
8. **No instalar librerías nuevas sin aprobación del dueño del proyecto**.

## 👥 Roles del Sistema

| Rol | Acceso |
|---|---|
| Super Admin | Todo el panel |
| Administrador | Todo menos facturación |
| Supervisor | Reportes y conversaciones de su equipo |
| Gestor / Agente | Sus conversaciones asignadas |
| Bot (IA) | Agente virtual, primera línea |

## 🔌 Canales a Integrar (por orden de prioridad)

1. **Widget Web** (en paralelo desde el inicio)
2. **WhatsApp Business** (Fase 1 - Core MVP)
3. **Instagram DM** (Fase 2)
4. **Messenger** (Fase 2)
5. **Telegram** (Fase 2)
6. **SMS / Twilio** (Fase 3)
7. **Email** (Fase 3)

## 🧠 Motor IA

- **Modelo principal:** `claude-sonnet-4-20250514`
- **Modelo de respaldo:** `claude-haiku-4-5-20251001`
- **Max tokens por respuesta:** 1000 (configurable por organización)
- **Funcionalidades:** clasificación de intención, resumen automático, sugerencia de respuesta, extracción de datos, CSAT predictivo, traducción, RAG sobre base de conocimiento.

## 📊 Estado Actual del Desarrollo

### ✅ Completado
- [x] Definición de arquitectura
- [x] Prompt maestro aprobado
- [x] CONTEXT.md y CHANGELOG.md inicializados
- [x] Estructura de carpetas creada

### 🚧 En Progreso (Sprint 1)
- [ ] Inicialización del repositorio Git
- [ ] Setup de Vite + Vue 3 + TypeScript
- [ ] Configuración de Tailwind CSS
- [ ] Proyecto Supabase creado
- [ ] Schema inicial de base de datos aplicado
- [ ] Sistema de autenticación con roles
- [ ] Layouts base (Auth + Admin)
- [ ] CI/CD básico con GitHub Actions

### ⏭️ Siguiente (Sprint 2)
- [ ] Webhook de WhatsApp en Edge Functions
- [ ] Widget web embebible básico
- [ ] Persistencia de mensajes en DB

## 🗂️ Convenciones de Nombrado

- **Composables:** prefijo `use` → `useConversations.ts`
- **Stores Pinia:** sufijo `Store` → `conversationsStore`
- **Tipos:** sufijo `.types.ts` → `conversation.types.ts`
- **Repositorios:** sufijo `.repo.ts` → `conversation.repo.ts`
- **Servicios externos:** sufijo `.service.ts` → `claude.service.ts`
- **Componentes:** PascalCase → `AgentCard.vue`
- **Archivos de rutas:** kebab-case en URLs → `/admin/my-inbox`

## 📝 Decisiones Técnicas Registradas

| Fecha | Decisión | Razón |
|---|---|---|
| 2026-04-21 | Pinia sobre Vuex | Estándar oficial Vue 3, mejor soporte TS |
| 2026-04-21 | Supabase sobre Firebase | PostgreSQL + RLS + Edge Functions + Realtime nativo |
| 2026-04-21 | Claude Sonnet 4 sobre GPT-4o | Mejor balance costo/calidad para conversacional en español |
| 2026-04-21 | Vue Router + Guards por rol | Control de UX; RLS sigue siendo la defensa real |
| 2026-04-21 | Day.js sobre date-fns | Bundle size más liviano |

## 🔗 Enlaces Importantes

- **Repositorio GitHub:** _(pendiente de crear)_
- **Notion del Proyecto:** _(pendiente de compartir)_
- **Supabase Project:** _(pendiente de crear)_
- **Staging URL:** _(pendiente)_
- **Producción URL:** _(pendiente)_

## ⚠️ Riesgos Conocidos

1. **Aprobación de Meta App Review** puede tardar semanas. Mitigación: Widget Web + Telegram en paralelo.
2. **Costos de Claude API** pueden escalar con volumen. Mitigación: límites por organización + modelo Haiku para clasificación.
3. **RLS mal configurado** = fuga de datos entre organizaciones. Mitigación: tests automatizados de RLS antes de producción.

---

**Mantenedor:** Dueño del proyecto
**Última actualización:** 2026-04-21
