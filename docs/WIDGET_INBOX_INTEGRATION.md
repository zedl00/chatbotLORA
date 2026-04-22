# 🌐 Widget + Inbox Integration Guide (Sprint 4)

> **Ruta:** `/docs/WIDGET_INBOX_INTEGRATION.md`
> Cómo integrar el Sprint 4 al proyecto.

---

## 📦 Contenido del módulo

```
widget-inbox-module/
├── supabase/
│   ├── migrations/
│   │   └── 20260424000001_widget_inbox.sql          ← NUEVO
│   └── functions/
│       ├── widget-session/                          ← NUEVO
│       └── widget-message/                          ← NUEVO
├── widget/
│   ├── src/widget.js                                ← NUEVO (script embebible)
│   └── public/demo.html                             ← NUEVO (página demo)
├── src/
│   ├── types/inbox.types.ts                         ← NUEVO
│   ├── repository/supabase/inbox.repo.ts            ← NUEVO
│   ├── composables/useRealtimeInbox.ts              ← NUEVO
│   ├── modules/
│   │   ├── inbox/
│   │   │   ├── views/InboxView.vue                  ← NUEVO (3 paneles)
│   │   │   └── components/
│   │   │       ├── ConversationList.vue             ← NUEVO
│   │   │       ├── ConversationThread.vue           ← NUEVO
│   │   │       └── ContactPanel.vue                 ← NUEVO
│   │   └── channels/
│   │       ├── views/ChannelsView.vue               ← NUEVO
│   │       └── components/
│   │           ├── WidgetConfigEditor.vue           ← NUEVO
│   │           └── WidgetInstallSnippet.vue         ← NUEVO
│   └── _modified/
│       └── router-index.ts                          ← reemplaza /src/router/index.ts
├── widget-session.ts                                ← funcion auto-contenida para dashboard
└── widget-message.ts                                ← funcion auto-contenida para dashboard
```

---

## 📥 Paso 1 — Copiar archivos

### Mac/Linux

```bash
unzip widget-inbox-module.zip -d /tmp/sprint4
cd /ruta/a/tu/proyecto

# Migración SQL
cp /tmp/sprint4/widget-inbox-module/supabase/migrations/20260424000001_widget_inbox.sql supabase/migrations/

# Edge Functions (si usas Supabase CLI)
cp -r /tmp/sprint4/widget-inbox-module/supabase/functions/widget-session supabase/functions/
cp -r /tmp/sprint4/widget-inbox-module/supabase/functions/widget-message supabase/functions/

# Widget embebible
mkdir -p public widget
cp /tmp/sprint4/widget-inbox-module/widget/src/widget.js public/
cp /tmp/sprint4/widget-inbox-module/widget/public/demo.html widget/

# Código frontend
cp /tmp/sprint4/widget-inbox-module/src/types/inbox.types.ts src/types/
cp /tmp/sprint4/widget-inbox-module/src/repository/supabase/inbox.repo.ts src/repository/supabase/
cp /tmp/sprint4/widget-inbox-module/src/composables/useRealtimeInbox.ts src/composables/

mkdir -p src/modules/inbox/views src/modules/inbox/components
cp /tmp/sprint4/widget-inbox-module/src/modules/inbox/views/InboxView.vue src/modules/inbox/views/
cp /tmp/sprint4/widget-inbox-module/src/modules/inbox/components/*.vue src/modules/inbox/components/

mkdir -p src/modules/channels/views src/modules/channels/components
cp /tmp/sprint4/widget-inbox-module/src/modules/channels/views/ChannelsView.vue src/modules/channels/views/
cp /tmp/sprint4/widget-inbox-module/src/modules/channels/components/*.vue src/modules/channels/components/

# Reemplazos
cp /tmp/sprint4/widget-inbox-module/src/_modified/router-index.ts src/router/index.ts
```

### Windows PowerShell

```powershell
$S4 = "C:\ruta\a\widget-inbox-module"
$P  = "C:\ruta\a\tu\proyecto"

Copy-Item "$S4\supabase\migrations\20260424000001_widget_inbox.sql" "$P\supabase\migrations\"
Copy-Item "$S4\supabase\functions\widget-session" "$P\supabase\functions\" -Recurse -Force
Copy-Item "$S4\supabase\functions\widget-message" "$P\supabase\functions\" -Recurse -Force

New-Item -ItemType Directory -Force "$P\public"
Copy-Item "$S4\widget\src\widget.js" "$P\public\"
New-Item -ItemType Directory -Force "$P\widget"
Copy-Item "$S4\widget\public\demo.html" "$P\widget\"

Copy-Item "$S4\src\types\inbox.types.ts" "$P\src\types\"
Copy-Item "$S4\src\repository\supabase\inbox.repo.ts" "$P\src\repository\supabase\"
Copy-Item "$S4\src\composables\useRealtimeInbox.ts" "$P\src\composables\"

New-Item -ItemType Directory -Force "$P\src\modules\inbox\views"
New-Item -ItemType Directory -Force "$P\src\modules\inbox\components"
Copy-Item "$S4\src\modules\inbox\views\InboxView.vue" "$P\src\modules\inbox\views\"
Copy-Item "$S4\src\modules\inbox\components\*.vue" "$P\src\modules\inbox\components\"

New-Item -ItemType Directory -Force "$P\src\modules\channels\views"
New-Item -ItemType Directory -Force "$P\src\modules\channels\components"
Copy-Item "$S4\src\modules\channels\views\ChannelsView.vue" "$P\src\modules\channels\views\"
Copy-Item "$S4\src\modules\channels\components\*.vue" "$P\src\modules\channels\components\"

Copy-Item "$S4\src\_modified\router-index.ts" "$P\src\router\index.ts" -Force
```

---

## 🗄️ Paso 2 — Aplicar migración SQL

Copia y pega el contenido de `20260424000001_widget_inbox.sql` en el **SQL Editor** de Supabase.

### Verificación

```sql
-- 2 tablas nuevas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('widget_configs', 'widget_sessions');

-- Vista del inbox
SELECT * FROM v_inbox_conversations LIMIT 5;

-- Widget config creada para tu canal existente
SELECT wc.brand_name, c.name, c.type
FROM widget_configs wc
JOIN channels c ON c.id = wc.channel_id;
```

---

## ☁️ Paso 3 — Desplegar las 2 Edge Functions nuevas

### Opción A: Dashboard

Igual que hicimos con las funciones de IA:

1. **Deploy a new function** → nombre: `widget-session`
2. Copia el contenido de `widget-session.ts` (archivo en la raíz del ZIP)
3. Pegar en el editor, Deploy

4. **Deploy a new function** → nombre: `widget-message`
5. Copia el contenido de `widget-message.ts`
6. Pegar en el editor, Deploy

**Importante:** Ambas funciones deben tener **Verify JWT OFF** porque son públicas (el widget no tiene sesión).

### Opción B: CLI

```bash
supabase functions deploy widget-session --no-verify-jwt
supabase functions deploy widget-message --no-verify-jwt
```

---

## 🧪 Paso 4 — Probar el Inbox

```bash
pnpm typecheck && pnpm dev
```

1. Login
2. Sidebar → **Bandeja** (ícono 💬)
3. Verás un layout de 3 paneles
4. Si ya usaste el Playground, deberías ver **tu conversación de test**

**Prueba rápida:**

- Abre la conversación de test en el panel derecho
- Escribe un mensaje como agente → debe aparecer del lado derecho en azul
- Clic en **🙋 Tomar** → conversación se asigna a ti
- Clic en **🤖 IA ON/OFF** → alterna el bot
- Escribe una nota en el panel derecho → se guarda

---

## 🌐 Paso 5 — Probar el Widget

### Método A: página demo local

1. Abre `/widget/public/demo.html` en tu editor
2. Reemplaza `YOUR_ANON_KEY_HERE` con tu `VITE_SUPABASE_ANON_KEY`
   (lo sacas del archivo `.env` de tu proyecto)
3. Abre el HTML en el navegador:
   - **Mac/Linux:** `python3 -m http.server 8000` desde la carpeta `widget/public/`, luego `http://localhost:8000/demo.html`
   - **Windows:** doble clic al HTML funciona para probar, aunque algunos navegadores bloquean fetch desde `file://`. Usar el servidor local es más confiable.
4. Espera 1-2 segundos → verás la burbuja 💬 abajo a la derecha
5. Clic → se abre el panel
6. Escribe un mensaje
7. **En tu Inbox** (/admin/inbox) debería aparecer una conversación nueva en tiempo real
8. Responder desde el Inbox → mensaje aparece en el widget instantáneamente

### Método B: embeber en cualquier sitio

Tu app expone `/widget.js` si copiaste el archivo a `public/`. En cualquier sitio web puedes pegar:

```html
<script
  src="http://tu-app.com/widget.js"
  data-channel-id="TU_CHANNEL_ID"
  data-supabase-url="https://xxx.supabase.co"
  data-supabase-anon-key="eyJ..."
  async
></script>
```

Para producción, aloja `widget.js` en un CDN (Cloudflare, Vercel, etc.) y usa esa URL.

---

## 🎨 Paso 6 — Personalizar el widget

1. En la app → **Canales**
2. Busca tu canal `web_widget`
3. Clic en **🎨 Personalizar**
4. Cambia colores, textos, activa pre-chat form
5. Guardar → los cambios se reflejan inmediatamente en el widget

---

## ✨ Features disponibles

### Inbox

- ✅ Lista de conversaciones con filtros (mías, sin asignar, sin leer)
- ✅ Chat en tiempo real (WebSockets de Supabase)
- ✅ Asignación (tomar / liberar)
- ✅ Toggle IA on/off por conversación
- ✅ Resumen IA automático (botón 📋 al ver un handoff)
- ✅ Sugerencia IA (botón ✨ al escribir)
- ✅ Etiquetas dinámicas
- ✅ Notas internas del contacto
- ✅ Badges de urgencia/sentimiento
- ✅ Contador de no leídos

### Widget

- ✅ Script embebible de una línea
- ✅ Vanilla JS sin dependencias (38 KB)
- ✅ Personalización visual (color, logo, copy)
- ✅ Pre-chat form configurable (nombre, email, teléfono)
- ✅ Auto-abrir con retraso
- ✅ Persistencia de sesión (localStorage)
- ✅ Realtime bi-direccional
- ✅ Fallback a polling si realtime falla
- ✅ Notificación visual al llegar mensaje con widget cerrado

---

## 🐛 Troubleshooting

| Problema | Causa | Solución |
|---|---|---|
| Widget no aparece | falta atributo `data-channel-id` o mal el `data-supabase-url` | Verifica los 3 atributos del script tag |
| `Origen no permitido` | `allowed_origins` del widget_config restringe | Update: `UPDATE widget_configs SET allowed_origins = ARRAY['*']` |
| Mensajes no aparecen en realtime | Realtime no publicado | Verificar `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime'` |
| "No hay widget config" | Falta seed para tu org | Migración tiene un bloque DO que lo crea; si tu canal es nuevo: `INSERT INTO widget_configs (channel_id, organization_id) SELECT id, organization_id FROM channels WHERE type='web_widget'` |
| El bot no responde | Anthropic sin saldo | Cargar créditos en console.anthropic.com |
| Inbox vacío pero hay conversaciones | RLS bloqueando | Verificar que tu usuario tenga permiso `conversations.read` |

---

## 📋 Checklist

- [ ] Migración SQL aplicada, 2 tablas nuevas creadas
- [ ] `widget-session` y `widget-message` desplegadas con Verify JWT OFF
- [ ] `pnpm typecheck` pasa
- [ ] El Inbox muestra conversaciones y abrirlas funciona
- [ ] Enviar mensaje como agente funciona
- [ ] Tomar/Liberar conversación funciona
- [ ] Toggle IA funciona
- [ ] Página demo del widget se conecta y chatea
- [ ] Realtime funciona en ambas direcciones (inbox ↔ widget)

---

## 🗺️ Siguiente (Sprint 5)

- **WhatsApp Business API**: webhook de Meta, verificación del token, patrón adapter
- O si prefieres: **Telegram Bot API** (más fácil de configurar, sin Meta review)
- O **constructor visual de flujos** (if/else, keywords, horarios)
