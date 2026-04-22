# Base de Datos — Schema

> **Ruta:** `/docs/DATABASE.md`

## 📊 Diagrama de Relaciones

```
organizations (1) ─┬─< (N) users
                   ├─< (N) teams
                   ├─< (N) agents
                   ├─< (N) contacts
                   ├─< (N) channels
                   ├─< (N) conversations ─< (N) messages
                   │                       └─< (N) notes
                   ├─< (N) flows
                   ├─< (N) knowledge_base
                   ├─< (N) tags
                   ├─< (N) metrics_daily
                   └─< (N) audit_logs

users (1:1) ────────< agents
teams (1) ─────────< (N) agents
contacts (1) ──────< (N) conversations
channels (1) ──────< (N) conversations
agents (1) ────────< (N) conversations
```

## 📋 Tablas

### `organizations`
Tenant raíz. Cada registro de cualquier otra tabla pertenece a una organización.

### `users`
Usuarios internos del panel. Vinculado 1:1 con `auth.users` de Supabase (mismo UUID).  
**Al registrarse**, la app debe insertar la fila correspondiente con `organization_id` y `role`.

### `agents`
Perfil extendido de un `user` cuando atiende conversaciones: status en vivo, skills, SLA tier, working hours.

### `teams`
Agrupación de agentes bajo un supervisor.

### `contacts`
Clientes finales. Se identifican por `channel_identities` (JSONB) para permitir unificar un mismo cliente que escribe por múltiples canales.

```json
{
  "whatsapp": "+18095551234",
  "instagram": "17841400000000000",
  "web_widget": "visitor_abc123"
}
```

### `channels`
Configuración de cada canal conectado. `credentials` debe cifrarse (ideal: pgsodium o vault externo).  
Únicos: `(organization_id, type, external_id)`.

### `conversations`
Un hilo por `contact × channel × período de actividad`. Al resolverse y reabrirse, se crea una nueva.  
Campos críticos:
- `ai_active` — indica si el bot está respondiendo.
- `handoff_at` — timestamp del traspaso IA → agente.
- `first_response_at` — para cálculo de FRT.
- `sla_due_at` / `sla_breached` — cumplimiento de SLA.

### `messages`
**Append-only.** No se editan ni eliminan. Los triggers actualizan la conversación padre.

### `knowledge_base`
Documentos para RAG. El campo `embedding VECTOR(1536)` soporta búsqueda semántica por coseno vía `pgvector`.  
Función: `match_knowledge_base(org_id, embedding, threshold, count)`.

### `flows`
Flujos conversacionales visuales. `nodes` y `edges` en JSONB representan el grafo del constructor drag-and-drop.

### `metrics_daily`
Métricas **pre-agregadas** por cron/triggers. Evita cálculos pesados en tiempo real para el dashboard.  
Unicidad: un registro por `(org, agent, date)` o `(org, team, date)`.

### `audit_logs`
Registro inmutable de acciones sensibles. Solo admin+ puede consultar.

## 🔐 Políticas RLS Resumidas

| Tabla | Lectura | Escritura |
|---|---|---|
| `organizations` | Solo la propia | Super admin |
| `users` | Misma org | Admin+ (o sí mismo) |
| `teams` | Misma org | Admin+ |
| `agents` | Misma org | Admin+ (status: sí mismo) |
| `contacts` | Misma org | Misma org |
| `channels` | Misma org | Admin+ |
| `conversations` | Admin: todas; Supervisor: su equipo; Agent: suyas + sin asignar | Mismo scope |
| `messages` | Según conversación | Append-only, mismo scope |
| `notes` | Según conversación | Autor o admin+ |
| `flows` / `knowledge_base` | Misma org | Admin+ |
| `metrics_daily` | Según rol | Solo sistema (service role) |
| `audit_logs` | Admin+ | Solo sistema |

## 🔧 Funciones Útiles (RPC)

| Función | Descripción |
|---|---|
| `current_user_org_id()` | UUID de la org del usuario autenticado |
| `current_user_role()` | Rol del usuario autenticado |
| `is_role_at_least(role)` | Boolean de jerarquía de roles |
| `is_my_team_agent(agent_id)` | Para políticas de supervisor |
| `match_knowledge_base(org, embedding, threshold, count)` | Búsqueda RAG |
| `assign_next_agent(org, team)` | Round-robin inteligente |
| `increment_org_tokens(org, tokens)` | Incrementa contador mensual |

## 👁️ Vistas

| Vista | Uso |
|---|---|
| `v_inbox` | Bandeja unificada: `conversations` + `contacts` + `agents` + `users` en una sola consulta |

## 📡 Realtime

Tablas publicadas a Supabase Realtime:
- `conversations`
- `messages`
- `agents`

Las suscripciones filtran por `organization_id` (la app lo hace; RLS también lo refuerza).

## 🧬 Extensiones Requeridas

- `uuid-ossp` — generación UUID v4
- `pgcrypto` — cifrado (para credentials en futuro)
- `vector` — embeddings RAG
- `pg_trgm` — búsqueda por similitud en texto

## ♻️ Migrar a Otro Proveedor

Si se migra de Supabase a otro proveedor (ej. PlanetScale + Prisma + Clerk):

1. Traducir el schema SQL de las 3 migraciones a la sintaxis del destino.
2. RLS no existe en MySQL → reimplementar aislamiento por organización **en cada query del repositorio**.
3. Realtime → alternativa: WebSockets propios con Socket.io o Pusher.
4. pgvector → alternativa: Pinecone / Weaviate / Qdrant.
5. Crear `src/repository/<proveedor>/*.repo.ts` implementando `IRepository`.
6. Cambiar los imports en `src/repository/index.ts`.

El resto del código **no cambia**.
