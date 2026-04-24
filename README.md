# 🦸 Sprint 9 — Supervisor Tools

El cuadrante **C** del Agent Workspace: herramientas para que supervisores y admins tomen control, guíen agentes en vivo, y respondan ante breaches de SLA.

---

## 📦 Archivos incluidos (13)

| Ruta | Tipo | Descripción |
|---|---|---|
| `supabase/migrations/2026_sprint_9.sql` | 🆕 Migración | Tablas + RPCs + permisos + cron |
| `src/types/supervisor.types.ts` | 🆕 Tipos | Escalation, SlaConfig, ESCALATION_TYPE_LABELS |
| `src/repository/supabase/supervisor.repo.ts` | 🆕 Repo | takeover, whisper, reassign, escalations |
| `src/repository/supabase/sla-config.repo.ts` | 🆕 Repo | CRUD de config SLA |
| `src/stores/escalations.store.ts` | 🆕 Store | Lista reactiva + realtime |
| `src/components/SupervisorAlerts.vue` | 🆕 Componente | Badge 🚨 en header |
| `src/modules/inbox/components/TakeoverButton.vue` | 🆕 Componente | 🦸 Tomar control |
| `src/modules/inbox/components/ReassignDropdown.vue` | 🆕 Componente | 🔄 Reasignar |
| `src/modules/inbox/components/EscalationBanner.vue` | 🆕 Componente | Banner en conv escalada |
| `src/modules/inbox/components/ConversationThread.vue` | 🔧 Reemplazar | + whisper mode + system messages |
| `src/modules/settings/views/SlaConfigView.vue` | 🆕 Vista | Config SLA por tenant |
| `src/layouts/AdminLayout.vue` | 🔧 Reemplazar | + SupervisorAlerts + menú SLA |
| `src/router/index.ts` | 🔧 Reemplazar | + ruta sla-config |

---

## 🚀 Aplicación

### Paso 1: SQL (crítico, orden importante)

Supabase → SQL Editor → pega `supabase/migrations/2026_sprint_9.sql` → Run.

**Verifica al final** que veas:

```
sla_configs_created  : 3 (una por cada org que tengas)
escalations_table    : true
rpcs                 : 4 (detect_sla_breaches, supervisor_takeover, send_whisper, reassign_conversation)
permissions          : 6
```

#### ⚠️ Sobre pg_cron

Al final del SQL verás un mensaje: `lora_detect_sla_breaches programado` o `pg_cron NO disponible`.

- Si está disponible: ya corre cada 1 min server-side ✅
- Si no: puedes correr manualmente `SELECT detect_sla_breaches();` cuando quieras probar

---

### Paso 2: Copiar los 12 archivos de frontend

Respeta estructura completa `/src/...`

### Paso 3: Build

```powershell
npm run build
```

**Si hay error**, pégamelo. El punto más probable de fallo: imports de tipos (`AgentLive`, `AgentStatus`).

### Paso 4: Dev

```powershell
npm run dev
```

---

## 🧪 Testing completo (10 tests)

### Test 1 — Badge SupervisorAlerts visible en header

1. Login como super_admin o admin
2. Mira arriba a la derecha

**✅ Esperado:** ves el badge 🚨 con "0" (no hay alertas aún)

**❌ Si no aparece:** verifica permiso `escalations.read`. Corre:
```sql
SELECT * FROM role_permissions rp 
JOIN permissions p ON p.id = rp.permission_id 
WHERE p.key = 'escalations.read';
```
Debería devolver filas.

---

### Test 2 — Config SLA funciona

1. Sidebar → **Configuración → ⏰ Config SLA**
2. URL: `/admin/sla-config`

**✅ Esperado:**
- Carga con valores: `5 minutos`, `Notificar supervisores: ON`, `SLA activo: ON`
- Si cambias a 10 y guardas → toast verde

---

### Test 3 — Whisper mode (la feature más cool 🤫)

1. Inbox → abre una conversación **que estés atendiendo tú**
2. En el editor, abajo a la izquierda ves un toggle:
   `🤫 Whisper`
3. Click → el toggle se pone ámbar, textarea cambia a fondo amarillo, placeholder dice "Mensaje privado al equipo"
4. Escribe: `Dale 20% de descuento pero no ofrezcas más`
5. Click en el botón ámbar `🤫`

**✅ Esperado:**
- Toast "Whisper enviado al equipo"
- Aparece un bubble amarillo con borde punteado arriba, tipo:
  ```
  🤫 WHISPER · VISIBLE SOLO AL EQUIPO
  Dale 20% de descuento pero no ofrezcas más
  ```
- El cliente (en el widget) NO ve este mensaje

**⚠️ Para verificar que el cliente no lo ve:**
- Abre el widget de tu sitio de prueba con esa misma conversación (el contacto)
- Los mensajes whisper NO deberían mostrarse ahí

---

### Test 4 — Takeover funciona

Necesitas 2 usuarios diferentes para este test.

1. **Usuario A** (admin o supervisor): toma una conversación ("🙋 Tomar")
2. **Usuario B** (otro admin/supervisor): entra al mismo Inbox, abre esa conversación
3. Usuario B ve en el header el botón: **🦸 Tomar control** (ámbar)
4. Click en "Tomar control" → confirma

**✅ Esperado:**
- Usuario B: toast "Has tomado el control"
- Aparece mensaje de sistema (pill gris centrado): "Un supervisor tomó el control de esta conversación."
- Usuario A: si tiene la conv abierta, verá que ya no puede enviar mensajes
- Se registra un evento `takeover` en tabla `escalations`

---

### Test 5 — Reasignación manual

1. En una conversación que estés atendiendo tú
2. Click en botón **🔄 Reasignar ▾**

**✅ Esperado:**
- Dropdown con lista de agentes disponibles
- Cada uno con dot de color (online/busy/away/offline)
- Agentes que no eres tú

3. Click en otro agente → confirma

**✅ Esperado:**
- Toast: "Conversación reasignada a X"
- Mensaje sistema: "Conversación reasignada a X"
- La conv ya no aparece como tuya

---

### Test 6 — SLA breach detectado (toma 5+ min)

1. Config SLA = 2 minutos (cambia temporalmente para probar rápido)
2. Deja que un contacto escriba por el widget
3. Toma la conversación como agente A
4. **NO respondas durante 2+ minutos**
5. Corre manualmente: `SELECT detect_sla_breaches();` en SQL Editor  
   *(o espera al cron si pg_cron está activo)*

**✅ Esperado:**
- El badge del header cambia a 🚨 con "1"
- Si entras a la conversación, aparece banner rojo arriba: **"SLA vencido - El agente no respondió..."**
- Se crea fila en tabla `escalations` con `type = 'sla_breach'`

---

### Test 7 — Resolver breach automáticamente

Continuando del Test 6:

1. Respóndele al cliente algo cualquiera
2. Refresca (o espera)

**✅ Esperado:**
- El banner desaparece
- Badge vuelve a 0
- Tabla `escalations`: ese breach tiene `resolved = true`

---

### Test 8 — Dropdown de alertas del header

1. Con al menos 1 escalation activa
2. Click en el badge 🚨

**✅ Esperado:**
- Dropdown con lista
- Cada item: emoji (🚨/🦸/🔄), nombre del contacto, info del evento, tiempo relativo
- Click en un item → lleva al Inbox con esa conv seleccionada

---

### Test 9 — Resolver manualmente desde banner

1. Entra a conversación con banner rojo
2. Click en **"✓ Marcar como visto"** (derecha del banner)

**✅ Esperado:**
- Banner desaparece
- Toast: "Alerta resuelta"

---

### Test 10 — Permisos funcionan

1. Crea un usuario con role `agent` (sin escalations.read)
2. Login como ese agent
3. Verifica:

**✅ Esperado:**
- NO ve el badge 🚨 en header
- NO ve el botón 🦸 Tomar control en conversaciones de otros
- NO ve el botón 🔄 Reasignar
- NO ve el toggle 🤫 Whisper
- NO ve "Config SLA" en el sidebar

---

## 🔐 Matriz de permisos

| Permiso | agent | supervisor | admin | super_admin |
|---|---|---|---|---|
| conversations.takeover | ❌ | ✅ | ✅ | ✅ |
| conversations.whisper  | ❌ | ✅ | ✅ | ✅ |
| conversations.reassign | ❌ | ✅ | ✅ | ✅ |
| sla_config.read        | ❌ | ✅ | ✅ | ✅ |
| sla_config.update      | ❌ | ❌ | ✅ | ✅ |
| escalations.read       | ❌ | ✅ | ✅ | ✅ |

---

## 🎨 UX detalles implementados

- **Badge en header rojo** solo si hay alertas; gris sin ellas
- **Banner de escalation** color-coded por tipo (rojo=sla, ámbar=takeover, azul=reassign)
- **Whisper bubbles** con fondo amarillo + borde punteado para que sean inconfundibles
- **Messages system** como pills centradas en gris (no interrumpen el flujo del chat)
- **Dropdown de reasignación** muestra estado live de cada agente (online primero)
- **Confirmaciones** en acciones irreversibles (takeover, reassign)
- **Realtime automático** en el badge y los banners (no requiere recargar)

---

## 💾 Commit sugerido

```bash
git add -A
git commit -m "feat(sprint-9): Supervisor Tools completo

- SQL: tabla sla_configs, escalations; RPCs takeover/whisper/
  reassign/detect_sla_breaches; triggers de first_response_at y
  sla_due_at; 6 permisos nuevos; cron pg_cron cada 1 min.
- Supervisor tools: takeover de conversaciones, whisper privado
  al equipo, reasignación entre agentes.
- Banner de escalation en conversaciones con SLA breach, takeover
  o reassign.
- Badge de alertas en header con dropdown de escalamientos activos
  (realtime).
- Vista /admin/sla-config con toggle enable, minutos, notif.
- ConversationThread: toggle whisper mode con UI ámbar distintiva,
  bubbles diferenciados para whisper y system messages.
- RBAC: solo supervisor y admin acceden a supervisor tools."
```

---

## 🐛 Troubleshooting

### "ambiguous relationship" en queries de escalations
Es el mismo patrón de PGRST201 que vimos en Sprint 6.8. Si aparece, corre:
```sql
-- Verificar constraints colisionantes
SELECT constraint_name, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'escalations'::regclass;
```

**Si ves múltiples constraints hacia users** (esperado: 4 — `actor_id`, `from_user_id`, `to_user_id`, `resolved_by`), todos deben tener nombres únicos. PostgREST usa esos nombres para el embed explícito.

**Fix si hay conflicto**:
```sql
-- Ejemplo: si el constraint tiene un nombre duplicado
ALTER TABLE escalations 
  DROP CONSTRAINT escalations_actor_id_fkey,
  ADD CONSTRAINT escalations_actor_user_fkey
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
```
Luego ajusta `supervisor.repo.ts` para usar el nuevo nombre en el embed.

### "check constraint violation" al insertar mensaje
El `CHECK constraint` nuevo rechazó un sender_type inválido. Verifica:
```sql
SELECT DISTINCT sender_type FROM messages;
```
Si hay algo que no sea contact/agent/bot/whisper/system, ajustamos el constraint.

### El badge no se actualiza en tiempo real
Verifica que Realtime está habilitado para tabla `escalations`:
Dashboard → Database → Replication → marca `escalations` como enabled.

### "No tengo permiso para whisper/takeover/reassign"
Tu rol no tiene el permiso asignado. Verifica:
```sql
SELECT u.email, r.key AS role, p.key AS permission
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE u.id = 'tu-user-id' AND p.key LIKE 'conversations.%';
```

### No se detectan breaches automáticamente
1. Verifica que `sla_configs.enabled = true` para tu org
2. Verifica `sla_due_at` en conversations: debe estar lleno
3. Corre manualmente: `SELECT detect_sla_breaches();`
4. Si pg_cron no está disponible, puedes programar cron alternativo (Edge Function con Supabase Scheduler)

---

## 🎯 Sprint 9 COMPLETO ✅

Cuadrante C del Agent Workspace terminado. Ahora:

**Sprint 10 — Agent Analytics** (cuadrante D):
- Métricas por agente (FRT, CSAT, resueltas)
- Leaderboard semanal
- Horarios de mayor carga
- Exportar CSV

**O puedes enfocar primero en:**
- Pre-chat widget (Entrega 2.5 pendiente)
- Deploy producción
- Telegram
- Landing page
