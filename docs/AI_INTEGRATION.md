# 🤖 AI Module Integration Guide

> **Ruta:** `/docs/AI_INTEGRATION.md`
> Cómo integrar el Sprint 3 (Motor IA) al proyecto.

---

## 📦 Contenido del módulo

```
ai-module/
├── supabase/
│   ├── migrations/
│   │   └── 20260423000001_ai_schema.sql             ← NUEVO
│   └── functions/
│       ├── _shared/anthropic.ts                     ← NUEVO (helper compartido)
│       ├── claude-chat/                             ← NUEVO (motor principal)
│       ├── claude-classify/                         ← NUEVO (intención, sentimiento)
│       ├── claude-summarize/                        ← NUEVO (resumen para handoff)
│       ├── claude-suggest/                          ← NUEVO (sugerencia para agentes)
│       ├── claude-embed/                            ← NUEVO (embeddings RAG)
│       └── ai-test-message/                         ← NUEVO (inyector playground)
└── src/
    ├── types/
    │   └── ai.types.ts                              ← NUEVO
    ├── repository/supabase/
    │   └── ai.repo.ts                               ← NUEVO
    ├── services/
    │   └── claude.service.ts                        ← NUEVO (reemplaza el stub actual)
    ├── modules/
    │   ├── ai/views/AiPersonasView.vue              ← NUEVO
    │   ├── playground/views/PlaygroundView.vue      ← NUEVO
    │   ├── knowledge/views/KnowledgeView.vue        ← NUEVO (reemplaza placeholder)
    │   └── reports/views/DashboardView.vue          ← NUEVO (reemplaza placeholder)
    └── _modified/
        ├── repository-index.ts    ← reemplaza /src/repository/index.ts
        ├── router-index.ts        ← reemplaza /src/router/index.ts
        └── AdminLayout.vue        ← reemplaza /src/layouts/AdminLayout.vue
```

---

## 🚀 Prerequisitos

### 1. Cuenta y API key de Anthropic (obligatorio)

1. Entra a [console.anthropic.com](https://console.anthropic.com) y crea cuenta.
2. **Settings → API Keys → Create Key** → cópiala (empieza con `sk-ant-...`).
3. **Settings → Billing** → carga **$5 o $10 USD** para empezar a probar.
   - Con $10 tienes para ~500 conversaciones típicas con Sonnet.
4. **Importante:** Guarda la key en un gestor de contraseñas. No la subas a Git.

### 2. API key de Voyage AI (opcional, solo si quieres RAG)

Sin esto, todo funciona excepto la búsqueda semántica en la base de conocimiento.

1. [voyageai.com](https://www.voyageai.com) → Sign up.
2. Dashboard → **API Keys** → Create → cópiala (empieza con `pa-...`).
3. **Tier gratuito:** 50M tokens/mes. Suficiente para empezar.

Si no configuras Voyage, la vista de Conocimiento funcionará pero mostrará una advertencia al intentar indexar.

---

## 📥 Paso 1 — Copiar archivos al proyecto

```bash
# Descomprimir
unzip ai-module.zip -d /tmp/ai

cd /ruta/a/tu/proyecto

# ── Migración SQL ──
cp /tmp/ai/ai-module/supabase/migrations/20260423000001_ai_schema.sql supabase/migrations/

# ── Edge Functions ──
cp -r /tmp/ai/ai-module/supabase/functions/_shared          supabase/functions/
cp -r /tmp/ai/ai-module/supabase/functions/claude-chat      supabase/functions/
cp -r /tmp/ai/ai-module/supabase/functions/claude-classify  supabase/functions/
cp -r /tmp/ai/ai-module/supabase/functions/claude-summarize supabase/functions/
cp -r /tmp/ai/ai-module/supabase/functions/claude-suggest   supabase/functions/
cp -r /tmp/ai/ai-module/supabase/functions/claude-embed     supabase/functions/
cp -r /tmp/ai/ai-module/supabase/functions/ai-test-message  supabase/functions/

# ── Archivos nuevos de src/ ──
cp /tmp/ai/ai-module/src/types/ai.types.ts                     src/types/
cp /tmp/ai/ai-module/src/repository/supabase/ai.repo.ts        src/repository/supabase/
cp /tmp/ai/ai-module/src/services/claude.service.ts            src/services/
mkdir -p src/modules/ai/views src/modules/playground/views
cp /tmp/ai/ai-module/src/modules/ai/views/AiPersonasView.vue   src/modules/ai/views/
cp /tmp/ai/ai-module/src/modules/playground/views/PlaygroundView.vue src/modules/playground/views/
cp /tmp/ai/ai-module/src/modules/knowledge/views/KnowledgeView.vue   src/modules/knowledge/views/
cp /tmp/ai/ai-module/src/modules/reports/views/DashboardView.vue     src/modules/reports/views/

# ── Reemplazos (archivos modificados) ──
cp /tmp/ai/ai-module/src/_modified/repository-index.ts  src/repository/index.ts
cp /tmp/ai/ai-module/src/_modified/router-index.ts      src/router/index.ts
cp /tmp/ai/ai-module/src/_modified/AdminLayout.vue      src/layouts/AdminLayout.vue
```

### Windows (PowerShell)

```powershell
$AI = "C:\ruta\donde\descomprimiste\ai-module"
$P  = "C:\ruta\a\tu\proyecto"

Copy-Item "$AI\supabase\migrations\20260423000001_ai_schema.sql" "$P\supabase\migrations\"
Copy-Item "$AI\supabase\functions\_shared"          "$P\supabase\functions\" -Recurse -Force
Copy-Item "$AI\supabase\functions\claude-chat"      "$P\supabase\functions\" -Recurse -Force
Copy-Item "$AI\supabase\functions\claude-classify"  "$P\supabase\functions\" -Recurse -Force
Copy-Item "$AI\supabase\functions\claude-summarize" "$P\supabase\functions\" -Recurse -Force
Copy-Item "$AI\supabase\functions\claude-suggest"   "$P\supabase\functions\" -Recurse -Force
Copy-Item "$AI\supabase\functions\claude-embed"     "$P\supabase\functions\" -Recurse -Force
Copy-Item "$AI\supabase\functions\ai-test-message"  "$P\supabase\functions\" -Recurse -Force

Copy-Item "$AI\src\types\ai.types.ts"                  "$P\src\types\"
Copy-Item "$AI\src\repository\supabase\ai.repo.ts"     "$P\src\repository\supabase\"
Copy-Item "$AI\src\services\claude.service.ts"         "$P\src\services\" -Force

New-Item -ItemType Directory -Force "$P\src\modules\ai\views"
New-Item -ItemType Directory -Force "$P\src\modules\playground\views"
Copy-Item "$AI\src\modules\ai\views\AiPersonasView.vue"               "$P\src\modules\ai\views\"
Copy-Item "$AI\src\modules\playground\views\PlaygroundView.vue"       "$P\src\modules\playground\views\"
Copy-Item "$AI\src\modules\knowledge\views\KnowledgeView.vue"         "$P\src\modules\knowledge\views\" -Force
Copy-Item "$AI\src\modules\reports\views\DashboardView.vue"           "$P\src\modules\reports\views\" -Force

Copy-Item "$AI\src\_modified\repository-index.ts" "$P\src\repository\index.ts" -Force
Copy-Item "$AI\src\_modified\router-index.ts"     "$P\src\router\index.ts" -Force
Copy-Item "$AI\src\_modified\AdminLayout.vue"     "$P\src\layouts\AdminLayout.vue" -Force
```

---

## 🗄️ Paso 2 — Aplicar migración SQL

```bash
supabase db push
```

### ✅ Verificar en SQL Editor

```sql
-- Tablas creadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('bot_personas','knowledge_chunks','message_classifications','ai_usage_log','ai_rate_limits');
-- Debe devolver 5 filas

-- Persona default creada
SELECT name, slug, is_default FROM bot_personas;
-- Debe mostrar "Asistente General"

-- Función principal
SELECT public.get_current_month_tokens(
  (SELECT id FROM organizations LIMIT 1)
);
-- Debe devolver ceros (sin uso aún)
```

### Si hay usuarios en orgs distintas a la demo

El seed solo crea la persona para `organization_id = '00000000-0000-0000-0000-000000000001'`. Si tu org es otra:

```sql
-- Sustituye por tu org_id
INSERT INTO bot_personas (organization_id, name, slug, identity, objective, is_default, active)
VALUES (
  'TU_ORG_ID_AQUI'::uuid,
  'Asistente General',
  'general',
  'Eres un asistente virtual amigable y profesional.',
  'Ayudar a los clientes con sus consultas.',
  true,
  true
) ON CONFLICT (organization_id, slug) DO NOTHING;
```

---

## ☁️ Paso 3 — Configurar secrets y desplegar Edge Functions

### Secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxx
supabase secrets set VOYAGE_API_KEY=pa-xxxx          # opcional (para RAG)
```

Para verificar que quedaron bien:

```bash
supabase secrets list
```

### Deploy

```bash
supabase functions deploy claude-chat
supabase functions deploy claude-classify
supabase functions deploy claude-summarize
supabase functions deploy claude-suggest
supabase functions deploy claude-embed
supabase functions deploy ai-test-message
```

> Todas llevan verify-jwt activo por defecto (requieren que el usuario esté autenticado). No uses `--no-verify-jwt` con estas.

---

## 🧪 Paso 4 — Probar el sistema

### Prueba rápida desde la UI

1. `pnpm typecheck` → debe pasar sin errores.
2. `pnpm dev` → arranca local.
3. Inicia sesión como super_admin.
4. En el menú lateral verás una nueva sección **"IA"** con:
   - 🤖 **Personalidades IA**
   - 🎮 **Playground**
   - 📚 **Conocimiento** (movido a esta sección)
5. Ve a **Playground**.
6. Selecciona la personalidad "Asistente General".
7. Escribe "Hola, ¿cómo estás?" y envía.
8. El bot debe responder en 1-3 segundos.
9. Debajo del mensaje del bot verás metadatos: latencia, tokens, costo.

### Si ves error "No hay canal web_widget"

El seed del Sprint 1 crea un canal de tipo `web_widget` para la org demo. Si tu org es otra, créalo manualmente:

```sql
INSERT INTO channels (organization_id, type, name, active, config)
VALUES (
  'TU_ORG_ID'::uuid,
  'web_widget',
  'Widget Web (test)',
  true,
  '{}'::jsonb
) ON CONFLICT DO NOTHING;
```

### Pruebas avanzadas

**Ver la clasificación automática:**

```sql
-- Después de enviar algún mensaje en playground
SELECT m.content, mc.intent, mc.sentiment, mc.urgency, mc.confidence
FROM messages m
JOIN message_classifications mc ON mc.message_id = m.id
WHERE m.conversation_id = (
  SELECT id FROM conversations WHERE tags @> ARRAY['playground']
  ORDER BY created_at DESC LIMIT 1
)
ORDER BY m.created_at;
```

**Probar detección de handoff:**

En playground, escribe: _"Necesito hablar con un humano urgente, tengo un problema grave"_.
La respuesta del bot debe comenzar con `[HANDOFF]` (que se oculta en la UI) y la conversación queda marcada como `ai_active = false`.

**Probar RAG (solo si tienes Voyage):**

1. Ve a **Conocimiento** → crear doc "Política de devoluciones".
2. Pega algún texto de política (tu FAQ, manual, etc.).
3. Guardar → debe indexar automáticamente.
4. En Playground, pregunta algo cubierto por ese doc.
5. Ve el badge "📚 RAG" en la respuesta del bot.

**Probar uso desde el Dashboard:**

1. Envía 3-4 mensajes en Playground.
2. Ve a **Dashboard**.
3. En "Consumo de IA (mes actual)" deben aparecer los tokens y costo acumulado.

---

## 💻 Paso 5 — Uso programático en tu código

### Hacer que el bot responda en una conversación real

```ts
import { chatRespond } from '@/services/claude.service'

// En el handler cuando llega un mensaje desde un canal:
const result = await chatRespond(conversationId)
console.log('Bot respondió:', result.response)
console.log('Detectó handoff?', result.handoffDetected)
console.log('Tokens:', result.tokensUsed, 'Costo:', result.costUsd)
```

### Sugerir respuesta a un agente humano

```ts
import { suggestReply } from '@/services/claude.service'

// En la vista del inbox, cuando el agente pide sugerencia:
const suggestion = await suggestReply(conversationId, 'Dale una opción de reembolso parcial')
// Mostrar `suggestion` en un tooltip o pre-cargarla en el input
```

### Resumir conversación para handoff

```ts
import { summarizeConversation } from '@/services/claude.service'

// Cuando un supervisor recibe una conversación con mucho historial:
const summary = await summarizeConversation(conversationId)
// summary contiene texto con formato: Situación, Qué pide, Intentos previos, etc.
```

---

## 🛡️ Paso 6 — Seguridad y control de costos

### Rate limiting automático

El sistema tiene un **circuit breaker**: si Claude falla 5 veces seguidas, pausa la IA por 10 minutos automáticamente.

Para ver/resetear pausas:

```sql
-- Ver estado
SELECT * FROM ai_rate_limits WHERE organization_id = 'TU_ORG_ID';

-- Resetear manualmente si es necesario
UPDATE ai_rate_limits
  SET paused_until = NULL, consecutive_errors = 0, pause_reason = NULL
WHERE organization_id = 'TU_ORG_ID';
```

### Límite de tokens mensual

La columna `ai_tokens_limit` en `organizations` define el tope mensual. Por defecto son 100.000 tokens.

```sql
-- Ver uso
SELECT name, ai_tokens_used, ai_tokens_limit
FROM organizations;

-- Ajustar límite
UPDATE organizations
  SET ai_tokens_limit = 1000000  -- 1M tokens
WHERE id = 'TU_ORG_ID';

-- Resetear uso mensual (hacer via cron el día 1 de cada mes)
UPDATE organizations SET ai_tokens_used = 0;
```

### Ver uso detallado

```sql
-- Últimas 50 llamadas
SELECT operation, model, total_tokens, cost_usd_micro/1000000.0 AS cost_usd,
       latency_ms, success, created_at
FROM ai_usage_log
WHERE organization_id = 'TU_ORG_ID'
ORDER BY created_at DESC
LIMIT 50;

-- Resumen por operación este mes
SELECT operation, COUNT(*), SUM(total_tokens), SUM(cost_usd_micro)/1000000.0 AS usd
FROM ai_usage_log
WHERE organization_id = 'TU_ORG_ID'
  AND created_at >= date_trunc('month', now())
GROUP BY operation;
```

---

## 🐛 Troubleshooting

| Problema | Causa | Solución |
|---|---|---|
| "ANTHROPIC_API_KEY no configurada" al enviar mensaje | Secret no se seteó en Supabase | `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` + redeploy función |
| "No hay bot persona configurada" | La org no tiene persona | Correr el INSERT del Paso 2 (crear persona para tu org_id) |
| El bot responde pero tarda 10+ segundos | Cold start de Edge Function | Normal la primera vez tras deploy; luego baja a 1-3s |
| Playground dice "No hay canal web_widget" | Canal no creado para tu org | Correr el INSERT de canal del Paso 4 |
| Indexar doc devuelve "VOYAGE_API_KEY no configurada" | Voyage no está configurado | Opcional: registrarte en voyage.ai y setear el secret, o dejar el bot sin RAG |
| "rate limit paused" en respuesta | 5 errores seguidos de Anthropic | Verificar que la API key sea válida, que haya saldo en billing, y resetear con el UPDATE |
| "Límite mensual de tokens alcanzado" | `ai_tokens_used >= ai_tokens_limit` | Subir el límite o resetear el contador |

---

## 📋 Checklist

- [ ] Cuenta Anthropic creada con saldo
- [ ] `ANTHROPIC_API_KEY` configurada en Supabase secrets
- [ ] Migración `20260423000001_ai_schema.sql` aplicada
- [ ] 6 Edge Functions desplegadas (chat, classify, summarize, suggest, embed, ai-test-message)
- [ ] Persona "Asistente General" existe para tu org
- [ ] Canal `web_widget` existe para tu org
- [ ] `pnpm typecheck` pasa
- [ ] Puedes ver la sección "IA" en el menú lateral
- [ ] Playground responde con un mensaje real del bot
- [ ] Dashboard muestra tokens > 0 después de chatear
- [ ] (Opcional) Voyage API key + primer doc indexado + RAG funcionando

---

## 🗺️ Qué sigue

Ya tienes el **cerebro** listo. Los siguientes sprints serán conectar "grifos" que alimentan este cerebro:

- **Sprint 4:** Inbox funcional + widget web embebible (primer canal real)
- **Sprint 5:** WhatsApp Business API
- **Sprint 6:** Telegram, Instagram, Messenger
- **Sprint 7:** Constructor visual de flujos (if/else, horarios, keywords)
- **Sprint 8:** Reportes avanzados + tests + producción
