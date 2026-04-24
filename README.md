# 📝 Sprint 11 — Widget Update + Pre-chat + Post-chat

Widget web completamente reimaginado: configurable, con pre-chat form (obligatorio u opcional), post-chat CSAT, y sistema de ayuda in-app integrado.

---

## 📦 Archivos (14)

| Ruta | Tipo | Descripción |
|---|---|---|
| `supabase/migrations/2026_sprint_11.sql` | 🆕 SQL | Default settings, helper RPC, permiso |
| `supabase/functions/widget-config/index.ts` | 🆕 Edge | Endpoint público para leer settings |
| `supabase/functions/widget-csat/index.ts` | 🆕 Edge | Recibe rating del post-chat |
| `src/types/widget.types.ts` | 🆕 Tipos | Todos los tipos + defaults + merge helper |
| `src/repository/supabase/widget-config.repo.ts` | 🆕 Repo | CRUD de settings |
| `src/modules/channels/views/WidgetConfigView.vue` | 🆕 Vista | Vista principal con tabs |
| `src/modules/channels/components/widget-config/WidgetAppearanceTab.vue` | 🆕 | Colores, posición, logo, mensajes |
| `src/modules/channels/components/widget-config/WidgetPreChatTab.vue` | 🆕 | Editor completo pre-chat |
| `src/modules/channels/components/widget-config/WidgetPostChatTab.vue` | 🆕 | Editor post-chat CSAT |
| `src/modules/channels/components/widget-config/WidgetInstallationTab.vue` | 🆕 | Snippet + instrucciones |
| `src/modules/channels/components/widget-config/WidgetFieldEditor.vue` | 🆕 | Fila individual de campo |
| `src/modules/channels/components/widget-config/help/HelpTooltip.vue` | 🆕 | Tooltip premium reutilizable |
| `src/modules/channels/components/widget-config/help/WidgetConfigHelpPanel.vue` | 🆕 | Panel slide-in con docs |
| `src/router/index.ts` | 🔧 | + ruta `/admin/channels/widget/:id` |
| `public/widget.js` | 🔄 | REEMPLAZADO - con pre-chat + post-chat + settings dinámicos |

---

## 🚀 Aplicación paso a paso

### 1. SQL (Supabase SQL Editor)

Pega `2026_sprint_11.sql` → Run.

**Verificaciones esperadas:**
```
widgets_with_settings        : 3 (tus 3 widgets actuales ahora tienen defaults)
helper_function              : true
permission_channels_configure: true
```

### 2. Deploy Edge Functions

Necesitas subir 2 funciones nuevas:

**widget-config:**
```bash
cd supabase/functions
# Asegúrate de tener supabase CLI instalado: npm install -g supabase
supabase functions deploy widget-config --project-ref imvahmyywbtcfsduwbdq --no-verify-jwt
```

**widget-csat:**
```bash
supabase functions deploy widget-csat --project-ref imvahmyywbtcfsduwbdq --no-verify-jwt
```

⚠️ **`--no-verify-jwt` es crítico**: hace la función pública (accesible desde el widget en sitios del cliente).

Si no tienes supabase CLI, puedes deployarlos manualmente:
- Dashboard → Edge Functions → New Function
- Nombre: `widget-config` (exacto)
- Pega el contenido de `supabase/functions/widget-config/index.ts`
- Marca "Invocable without JWT" (muy importante)
- Deploy

Repite para `widget-csat`.

### 3. Copiar archivos frontend

Copia los 13 archivos respetando estructura `/src/...` y `/public/widget.js`.

### 4. Actualizar widget.js con la anon key

Abre `public/widget.js`, línea ~27:
```js
const SUPABASE_ANON_KEY = window.LORA_SUPABASE_ANON_KEY || ''
```

**Opción A (recomendada):** en build time inyecta la anon key desde variable de entorno.

**Opción B (simple):** hardcodea tu anon key pública:
```js
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5c...' // tu anon key
```

Recuerda que la **anon key es pública** (ya está en tu app principal), no es un secreto.

### 5. Build

```powershell
npm run build
```

### 6. Deploy FTP

Sube todo `dist/` a `/public_html/lora/` como siempre.

---

## 🧪 Tests en producción

### Test 1 — Vista de configuración carga

1. Login en `lora.jabenter.com`
2. Sidebar → **Canales** → clic en un widget web
3. Debería abrir `/admin/channels/widget/:id`
4. ✅ Verás: tabs (Apariencia, Pre-chat, Post-chat, Instalación)

**⚠️ Si al clic en el widget no te lleva a esta ruta:** tu ChannelsView actual no está pasando al routing nuevo. En ese caso, navega manualmente a:
```
https://lora.jabenter.com/admin/channels/widget/033fd98f-be93-4bf5-b090-94e26f091d94
```

(usa uno de tus 3 channel IDs)

### Test 2 — Tab Apariencia

- Cambia color → selector o presets
- Cambia posición → izquierda / derecha
- Cambia nombre de marca → "Soporte Norson"
- Pega URL de logo → opcional
- Cambia mensaje de bienvenida
- Click **"Guardar cambios"**
- ✅ Toast verde "Configuración guardada"

### Test 3 — Tab Pre-chat

- Toggle "Pre-chat activo" a ON
- Selecciona modo "Opcional"
- Activa campo "Teléfono" con toggle "Mostrar"
- Marca "Obligatorio" para email
- Reordena con flechas ▲▼
- Click "Guardar"

### Test 4 — Tab Post-chat

- Toggle "Post-chat activo" a ON
- Activa "Permitir comentario"
- Personaliza textos
- Click "Guardar"

### Test 5 — Tab Instalación

- Copia el snippet con el botón
- ✅ Toast "Copiado al portapapeles"
- Léelo: debe tener tu channelId correcto

### Test 6 — Widget en sitio externo (el test crítico)

1. Ve a [CodePen.io](https://codepen.io/pen)
2. En HTML pega el snippet que copiaste en Test 5
3. En Settings → Behavior → desactiva Auto-Update
4. Espera que el Pen recargue
5. ✅ Ves el botón flotante 💬 con tu color custom
6. Click al botón → aparece el pre-chat (si lo activaste)
7. Completa el form → se abre el chat
8. Envía un mensaje → bot IA responde
9. Ve al admin `/admin/inbox` → ves la conversación con los datos del pre-chat

### Test 7 — Post-chat funciona

1. En el Inbox, marca la conversación como **Resuelta**
2. **NOTA:** actualmente el widget NO sabe automáticamente que la conv se resolvió. Para probar el post-chat **manualmente**:
   - Abre DevTools en el tab con el widget
   - Consola: `window.LoraChatAPI.showPostChat()`
3. ✅ Ves el modal de estrellas
4. Selecciona 4 estrellas + comentario → click "Enviar"
5. ✅ Ves "¡Gracias por tu tiempo!"
6. Ve al admin/Analytics → esa conversación tiene CSAT 4

**⚠️ Limitación conocida de Sprint 11:** el post-chat automático al resolver requiere un evento de realtime adicional que implementaremos en Sprint 11.5 si decidimos refinar. Por ahora se dispara manualmente con la API JS expuesta.

### Test 8 — Help panel

1. En `/admin/channels/widget/:id` click en **💡 Guía** arriba-derecha
2. ✅ Se abre panel lateral con 6 secciones expandibles
3. Expande "¿Cuándo activar el pre-chat?"
4. Expande "Glosario"
5. Cierra con ✕

### Test 9 — Tooltips

En Tab Apariencia o Pre-chat, hover sobre los iconitos `ℹ`:
- ✅ Aparece tooltip oscuro con explicación breve

### Test 10 — Dirty state

1. Cambia un valor
2. Verás badge ámbar flotante "⚠️ Tienes cambios sin guardar"
3. Intenta navegar fuera → browser pregunta "¿Salir sin guardar?"
4. Click "Descartar" → todo vuelve al original

---

## 🎨 Lo que va a ver tu cliente (flujo completo)

```
1. Cliente abre tu sitio
   ↓
2. Ve botón flotante "💬" (con tu color)
   ↓
3. Click → aparece ventana del chat
   ↓ (si pre-chat está activo)
4. Form: "Antes de empezar"
   [ Nombre       ]
   [ Email        ]
   [ Teléfono     ]  (si activaste)
   [ Motivo ▼     ]  (si activaste)
   [ Iniciar conversación ]
   ↓
5. Chat normal con tu bot IA
   ↓
6. Bot responde o pasa a agente humano
   ↓
7. Al cerrar la conversación (si post-chat activo):
   "¿Cómo fue tu atención?"
   ★ ★ ★ ★ ★
   [comentario opcional]
   [Enviar]
   ↓
8. "¡Gracias por tu tiempo!" → se cierra
```

---

## 🐛 Troubleshooting

### "No se puede cargar config" en widget

La Edge Function `widget-config` no está deployada o no es pública.
Verifica:
```bash
curl https://imvahmyywbtcfsduwbdq.supabase.co/functions/v1/widget-config?channel_id=TU_ID
```
Debe devolver JSON con el settings. Si da 401, la función no tiene `--no-verify-jwt`.

### Widget aparece pero sin estilos custom

El `settings` está vacío. Verifica con SQL:
```sql
SELECT id, name, jsonb_pretty(settings) FROM channels WHERE type = 'web_widget';
```

Si algún widget tiene `{}`, re-corre el SQL de migración — el UPDATE solo afecta widgets con settings vacío.

### CSAT no se guarda

Probablemente `widget-csat` no está deployada. Verifica con:
```bash
curl -X POST https://imvahmyywbtcfsduwbdq.supabase.co/functions/v1/widget-csat \
  -H "Content-Type: application/json" \
  -d '{"conversation_id":"test","rating":5}'
```

### Widget se ve en mobile mal

Los anchos del widget son fijos en 380px. Si quieres 100% responsive para pantallas &lt;400px, puedes editar `public/widget.js` línea del `#lora-chat-window`:
```css
width: 380px;
max-width: calc(100vw - 40px);
```

---

## 💡 Decisiones de diseño importantes

1. **Settings como JSONB único** (en lugar de columnas): máxima flexibilidad para agregar features sin migraciones.
2. **Edge Functions públicas para widget**: no exponen la service role key. El helper RPC `get_widget_public_config` remueve cualquier campo sensible.
3. **Widget carga config en runtime**: cambios en el admin se reflejan **instantáneamente** (hasta 5 min de cache HTTP) sin reinstalar snippet.
4. **Merge defensivo de settings**: `mergeWidgetSettings()` garantiza que si añadimos un campo nuevo en el futuro (ej: `branding.font_family`), los widgets viejos siguen funcionando.
5. **Validación en cliente Y servidor**: el form valida required antes de enviar, pero el RPC también rechazaría data mala.

---

## 📊 Impacto en el sistema

- ✅ Widgets existentes siguen funcionando (el snippet viejo sin pre-chat es compatible)
- ✅ Nuevos widgets tienen pre-chat/post-chat deshabilitados por default (no-op)
- ✅ Analytics empieza a recibir `csat_score` real cuando activen post-chat
- ✅ Contacts con nombre/email/teléfono real cuando activen pre-chat

---

## 💾 Commit sugerido

```bash
cd C:\xampp\htdocs\proyectos\chatbot
git add -A
git commit -m "feat(sprint-11): Widget update + Pre-chat + Post-chat + Help system

SQL:
- Default settings para widgets existentes (backward compatible)
- Helper RPC get_widget_public_config (expone settings sin secretos)
- Permiso channels.configure

Edge Functions:
- widget-config (pública, no-verify-jwt): sirve settings al widget
- widget-csat (pública): recibe rating del post-chat

Frontend Admin:
- Vista /admin/channels/widget/:id con 4 tabs
- Tab Apariencia: color, posicion, logo, mensajes
- Tab Pre-chat: toggle + modo + campos configurables (visibilidad,
  obligatorio, orden, labels)
- Tab Post-chat: CSAT con estrellas y comentario opcional
- Tab Instalación: snippet copy-paste con preview
- Dirty state con warning antes de navegar
- Help panel lateral con 6 secciones didacticas
- Tooltips premium en cada elemento

Widget:
- Carga config dinamica de edge function
- Pre-chat form con validacion cliente
- Post-chat con CSAT estrellas + comentario
- Realtime bidireccional mantenido
- API expuesta: window.LoraChatAPI.showPostChat() para testing

Help system (Opción C):
- Tooltips contextuales (hovers)
- Panel lateral con 6 secciones expandibles
- Contenido premium didactico (cuando activar, tips de conversion,
  glosario)"

git push
```

---

## 🎯 Siguiente sprint

Con Sprint 11 en producción, el roadmap sigue con:

- **Sprint 12:** Help System framework completo + docs retroactivas de Sprints 7-10
- **Sprint 13:** Landing comercial lorachat.net
- **Sprint 14:** Telegram como 2do canal
- **Sprint 15:** Stripe billing
- **Sprint 16:** WhatsApp Business API
- **Sprint 17:** Constructor visual de flujos
