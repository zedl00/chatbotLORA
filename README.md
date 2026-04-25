> ✅ **Estado:** En producción en [admin.lorachat.net](https://admin.lorachat.net)
> 📅 **Sprint actual:** 11.6 — System Configuration


# 🔧 Sprint 11.6 — System Configuration (parametrización global)

Tabla `system_config` editable desde el admin con vista premium para super_admin.
URLs ya no hardcoded; se leen del store Pinia con cache + fallback.

---

## 📦 Contenido del ZIP

### Archivos NUEVOS (10) — copiar directo

| Archivo | Tipo |
|---|---|
| `supabase/migrations/2026_sprint_11_6.sql` | SQL migration |
| `supabase/functions/public-config/index.ts` | Edge Function pública |
| `src/types/system-config.types.ts` | Tipos |
| `src/repository/supabase/system-config.repo.ts` | Repo CRUD |
| `src/stores/system-config.store.ts` | Pinia store |
| `src/composables/useSystemConfig.ts` | Composable |
| `src/modules/super-admin/views/SystemConfigView.vue` | Vista admin |
| `src/modules/super-admin/components/ConfigItemEditor.vue` | Editor inline |
| `src/modules/super-admin/components/help/SystemConfigHelpPanel.vue` | Help panel |
| `public/widget.js` | Widget actualizado (parametrizado) |

### Archivos REEMPLAZADOS (creados por mí en Sprint 11.5, sin riesgo)

| Archivo | Razón |
|---|---|
| `src/modules/channels/components/ChannelCard.vue` | Usa `useSystemConfig().widgetUrl` |
| `src/modules/channels/components/widget-config/WidgetInstallationTab.vue` | Usa `useSystemConfig().widgetUrl` |

### Archivos COMPARTIDOS — parches quirúrgicos abajo (NO REEMPLAZAR)

- `src/router/index.ts` → agregar 1 ruta hija
- `src/layouts/AdminLayout.vue` → agregar 1 nav item
- `src/main.ts` o `src/App.vue` → cargar config al iniciar

---

## 🚀 Aplicación — orden estricto

### 1️⃣ SQL (3 min)

Supabase → SQL Editor → pega `2026_sprint_11_6.sql` → Run.

**Verifica al final del output:**
```
tabla_creada:    true
rpc_publica:     true
configs_seed:    8
```

Y ves un preview de las 8 configs sembradas (admin_url, widget_url, brand_name, etc.).

### 2️⃣ Deploy Edge Function (5 min)

```powershell
cd C:\xampp\htdocs\proyectos\chatbot
supabase functions deploy public-config --no-verify-jwt
```

⚠️ El `--no-verify-jwt` es CRÍTICO: el widget.js no tiene auth.

**Test rápido en navegador:**
```
https://imvahmyywbtcfsduwbdq.supabase.co/functions/v1/public-config
```

Debe devolver JSON con `widget_url`, `brand_name`, etc. (las is_public=true).

### 3️⃣ Copiar archivos NUEVOS (10 archivos)

Respeta las rutas exactas desde `/src/`. El widget.js va a `/public/`.

### 4️⃣ Reemplazar archivos del Sprint 11.5 (2 archivos)

- `ChannelCard.vue` (lo creé en 11.5, sin riesgo)
- `WidgetInstallationTab.vue` (lo creé en Sprint 11, sin riesgo)

### 5️⃣ Parche en `src/router/index.ts`

**ABRIR el archivo y BUSCAR** este bloque:

```typescript
  {
    path: '/super-admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, superAdmin: true },
    children: [
      { path: '', redirect: { name: 'super-admin.organizations' } },
      {
        path: 'organizations',
        name: 'super-admin.organizations',
        component: () => import('@/modules/super-admin/views/OrganizationsView.vue'),
        meta: { title: 'Organizaciones', superAdmin: true }
      }
    ]
  },
```

**REEMPLAZARLO por:**

```typescript
  {
    path: '/super-admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, superAdmin: true },
    children: [
      { path: '', redirect: { name: 'super-admin.organizations' } },
      {
        path: 'organizations',
        name: 'super-admin.organizations',
        component: () => import('@/modules/super-admin/views/OrganizationsView.vue'),
        meta: { title: 'Organizaciones', superAdmin: true }
      },
      // 🆕 Sprint 11.6
      {
        path: 'system-config',
        name: 'super-admin.system-config',
        component: () => import('@/modules/super-admin/views/SystemConfigView.vue'),
        meta: { title: 'Configuración del Sistema', superAdmin: true }
      }
    ]
  },
```

Solo agregaste el bloque `// 🆕 Sprint 11.6` con su llave previa. **Nada más cambia.**

### 6️⃣ Parche en `src/layouts/AdminLayout.vue`

**BUSCAR** la sección "LORA Admin" donde está 🏢 Organizaciones (debería ser un `v-if` con `isSuperAdmin`).

Probablemente se ve algo así:

```vue
<!-- Sección LORA Admin (solo super_admin) -->
<div v-if="isSuperAdmin">
  <div class="...">LORA Admin</div>
  <RouterLink :to="{ name: 'super-admin.organizations' }">
    🏢 Organizaciones
  </RouterLink>
</div>
```

**AGREGAR** una nueva `RouterLink` justo después de la de Organizaciones (dentro del mismo `<div v-if="isSuperAdmin">`):

```vue
<RouterLink :to="{ name: 'super-admin.system-config' }" class="[copia-las-mismas-clases-CSS-de-Organizaciones]">
  🔧 Configuración del Sistema
</RouterLink>
```

**Importante:** copia EXACTAMENTE las clases CSS que tiene la `RouterLink` de Organizaciones para mantener el estilo consistente. Si me pasas el bloque exacto te mando el parche con las clases correctas.

### 7️⃣ Parche en `src/main.ts` o `src/App.vue` — cargar config al iniciar

**BUSCAR** donde se monta la app (típicamente en `main.ts`):

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

**AGREGAR** después de `app.use(createPinia())` y antes de `app.mount`:

```typescript
// 🆕 Sprint 11.6: cargar config pública del sistema
import { useSystemConfigStore } from '@/stores/system-config.store'
useSystemConfigStore().loadPublic()  // fire and forget, no bloquea
```

O alternativamente, puedes hacerlo en `App.vue` con `onMounted` si prefieres.

### 8️⃣ Build + verificar

```powershell
npm run build
```

**Debe pasar sin errores.** Si aparece algo, pégame el output completo.

### 9️⃣ Commit + Deploy FTP

```powershell
git add -A
git commit -m "feat(sprint-11.6): system_config parametrizado

SQL:
- Tabla system_config con RLS (super_admin write, all read)
- RPC publica get_public_config para widget
- 8 configs seed con admin.lorachat.net

Edge Function:
- public-config (sin JWT, cache 5 min)

Frontend:
- Tipos, repo, store Pinia con cache
- Composable useSystemConfig
- Vista SystemConfigView (super_admin) con tabs por categoria
- ConfigItemEditor con validacion por tipo
- Help panel con 6 secciones

Refactor:
- ChannelCard usa widgetUrl del store
- WidgetInstallationTab usa widgetUrl del store
- widget.js fetch a /public-config con cache localStorage

Pendiente: limpiar referencias a lora.jabenter.com en estado-proyecto.md y README.md (no criticas)"

git push
npm run build
# CoreFTP -> /public_html/lora/ -> borrar todo -> subir dist/
```

---

## 🧪 Tests post-deploy

### Test 1 — Página accesible solo para super_admin
- Login como super_admin → ves "🔧 Configuración del Sistema" en sidebar
- Login como admin normal → NO la ves
- Acceso directo a `/super-admin/system-config` redirige si no eres super_admin

### Test 2 — Vista funciona
- ✅ 8 configs cargadas
- ✅ Tabs por categoría (URLs, Branding)
- ✅ Click en una config → puedes editar
- ✅ Click "Guardar" → toast verde
- ✅ Click "🔄 Default" → confirmación + restaura

### Test 3 — Cambio se propaga al admin
- Modifica `brand_name` a "LORA Test"
- Recarga otra pestaña del admin
- En la sidebar (si lo usa) o footer debería verse "LORA Test"

### Test 4 — Widget usa la config del store
- Ve a `/admin/channels` → click "📋 Copiar HTML completo"
- El snippet debe usar **la URL actual** del store (no hardcoded)

### Test 5 — Endpoint público funciona
- En navegador: `https://imvahmyywbtcfsduwbdq.supabase.co/functions/v1/public-config`
- Devuelve JSON con configs públicas

### Test 6 — Widget en producción carga config
- Pega snippet en CodePen
- Abre DevTools → Network
- Debe ver request a `/public-config` que devuelve 200
- Cache 5 min (localStorage `lora_public_config`)

---

## 🛡️ Validaciones de seguridad

✅ **`is_public=false`** nunca se expone fuera de auth
✅ **RLS** en tabla: solo super_admin escribe, autenticados leen
✅ **RPC `get_public_config`** filtra solo `is_public=true`
✅ **service_role_key** no se usa desde frontend
✅ **anon key** no expone configs privadas (RLS lo previene)

---

## 🎯 Después de Sprint 11.6

Con esto tienes:
- ✅ Sistema parametrizable mantenible
- ✅ Cambio de dominio = SQL UPDATE de 1 línea
- ✅ Multi-tenant ready
- ✅ Cache inteligente cliente
- ✅ Documentación in-app

Roadmap pendiente:
- Sprint 12: Help System framework + docs retroactivas
- Sprint 13: Landing comercial lorachat.net
- Sprint 14: Telegram
- Sprint 15: Stripe billing
- Sprint 16: WhatsApp Business

---

## 🧹 Después: borrar lora.jabenter.com (tu estrategia "chaos")

Una vez aplicado todo y testeado:

1. cPanel → Subdomains → eliminar `lora.jabenter.com`
2. Esperar 30 min
3. Si algo explota:
   - Identifica qué archivo todavía referencia el dominio viejo
   - Cambia el valor en `system_config` con la URL correcta
   - O actualiza el código fuente si está hardcoded

Lo bueno es que con system_config, la mayoría de los cambios son SQL UPDATE.

---

## 📌 Si necesitas help

Si algún build falla, pégame el output. Recordatorio política nueva:

✅ Toqué archivos compartidos solo via parches en chat (router, AdminLayout, main.ts)
✅ ZIP solo con archivos nuevos o que yo creé (ChannelCard 11.5, WidgetInstallationTab 11)
✅ Si rompo build, lo arreglo sin pedir más archivos

Adelante con la aplicación, te espero. 🚀
t e s t  
 