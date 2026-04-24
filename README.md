# 🚀 Sprint 6 + 7 — Modo soporte + Editor de branding

Este paquete agrega 2 funcionalidades a LORA:

- **Sprint 6:** Modo soporte super_admin (banner + logs + confirmaciones)
- **Sprint 7:** Editor de branding per-tenant (color, logo, mensajes del widget)

---

## 📋 Resumen de cambios

| Tipo | Archivo | Sprint |
|---|---|---|
| 🆕 SQL | `supabase/migrations/20260423_sprint6_7_storage_support.sql` | 6+7 |
| 🆕 Composable | `src/composables/useSupportMode.ts` | 6 |
| 🆕 Composable | `src/composables/useLogoUpload.ts` | 7 |
| 🆕 Componente | `src/components/SupportModeBanner.vue` | 6 |
| 🔧 Modificado | `src/layouts/AdminLayout.vue` | 6 |
| 🆕 Componente | `src/modules/settings/components/LogoUploader.vue` | 7 |
| 🆕 Vista | `src/modules/settings/views/BrandingView.vue` | 7 |
| 🔧 Modificado | `src/router/index.ts` (agrega ruta /admin/branding) | 7 |

---

## 🔧 Instalación paso a paso

### Paso 1: Aplicar migración SQL

1. Abre Supabase Dashboard → SQL Editor
2. Copia el contenido de `supabase/migrations/20260423_sprint6_7_storage_support.sql`
3. Ejecuta
4. Al final verás la verificación:
   ```
   status='Sprint 6+7 migración aplicada'
   buckets_creados=1
   policies_storage=4
   funciones=1
   ```

### Paso 2: Copiar archivos al proyecto

Todos los archivos de este ZIP tienen su **ruta completa desde `/src`**.
Copia cada archivo a su destino respectivo en tu proyecto:

```
sprint-6-7/src/composables/useSupportMode.ts
  → C:\xampp\htdocs\proyectos\chatbot\src\composables\useSupportMode.ts

sprint-6-7/src/composables/useLogoUpload.ts
  → C:\xampp\htdocs\proyectos\chatbot\src\composables\useLogoUpload.ts

sprint-6-7/src/components/SupportModeBanner.vue
  → C:\xampp\htdocs\proyectos\chatbot\src\components\SupportModeBanner.vue

sprint-6-7/src/layouts/AdminLayout.vue
  → (REEMPLAZAR) C:\xampp\htdocs\proyectos\chatbot\src\layouts\AdminLayout.vue

sprint-6-7/src/modules/settings/components/LogoUploader.vue
  → C:\xampp\htdocs\proyectos\chatbot\src\modules\settings\components\LogoUploader.vue

sprint-6-7/src/modules/settings/views/BrandingView.vue
  → C:\xampp\htdocs\proyectos\chatbot\src\modules\settings\views\BrandingView.vue

sprint-6-7/src/router/index.ts
  → (VER NOTA ABAJO) C:\xampp\htdocs\proyectos\chatbot\src\router\index.ts
```

#### ⚠️ Nota sobre router/index.ts

El archivo `src/router/index.ts` es una REFERENCIA. Tu proyecto puede tener
más rutas que no quiero pisar. Agrega manualmente estas líneas en tu router:

**1. En los imports (arriba del archivo):**
```ts
const BrandingView = () => import('@/modules/settings/views/BrandingView.vue')
```

**2. En las children de `/admin` (dentro del AdminLayout):**
```ts
{
  path: 'branding',
  name: 'admin.branding',
  component: BrandingView,
  meta: {
    requiresAuth: true,
    title: 'Branding',
    permission: 'settings.update'
  }
},
```

Ponla antes de `{ path: 'users', ... }` para mantener el orden.

### Paso 3: Probar localmente

```powershell
npm run dev
```

#### Test 1 — Modo soporte (Sprint 6)
1. Login como super_admin (nestorvaldez@hotmail.com)
2. Cambia `.env.local` a `VITE_DEV_SUBDOMAIN=capitali`
3. Reinicia `npm run dev`
4. Recarga localhost
5. **Deberías ver banner naranja arriba:** "Modo soporte activo"
6. Botón "← Volver a mi panel" te lleva a admin

#### Test 2 — Login normal NO muestra banner
1. Logout
2. Cambia `.env.local` a `VITE_DEV_SUBDOMAIN=` (vacío)
3. Login como super_admin
4. **NO debe aparecer banner** (estás en tu propio panel)

#### Test 3 — Editor de branding (Sprint 7)
1. Login como admin de una empresa (capitalird@gmail.com)
2. Ve al menú lateral → **"Branding"** (ícono 🎨)
3. Prueba cada funcionalidad:
   - Subir un logo (drag & drop)
   - Cambiar el color primario
   - Editar el título de bienvenida
4. Click en **"Guardar cambios"**
5. Recarga la página → los cambios persisten ✓
6. El sidebar ahora muestra el logo (si subiste uno)

### Paso 4: Build de producción

```powershell
npm run build
```

Si sale algún error de TypeScript, pégamelo y lo arreglo.

### Paso 5: Deploy via FTP

1. Sube `dist/` a `/public_html/admin.lorachat.net/`
2. Prueba en incógnita:
   - `admin.lorachat.net` como super_admin → sin banner
   - `capitali.lorachat.net` como super_admin → CON banner
   - `capitali.lorachat.net` como capitalird → ver menú Branding

---

## 🎯 Lo que logras con este paquete

### Sprint 6 — Modo soporte

✅ Banner naranja visible cuando super_admin entra a tenant ajeno
✅ Botón rápido "Volver a mi panel"
✅ Logs de auditoría con prefix `support_mode.*`
✅ Función SQL para registrar acciones (disponible para otros módulos)

### Sprint 7 — Editor de branding

✅ Upload de logo con drag & drop (PNG/JPG/WEBP/SVG, máx 2MB)
✅ Color picker con preview en vivo
✅ Editor de mensajes del widget (bienvenida, offline)
✅ Preview del widget al lado (igual al del wizard)
✅ Permisos: solo admins con `settings.update`
✅ Super_admin puede editar branding de cualquier empresa (modo soporte)

---

## 🗂️ Storage en Supabase

Después de aplicar la migración, verás en Supabase → Storage:

```
📁 organization-logos (bucket público)
   📁 {org_id_1}/
      └── logo-1234567890.png
   📁 {org_id_2}/
      └── logo-9876543210.jpg
```

Las policies aseguran que:
- Cualquiera puede **leer** (necesario para el widget público)
- Solo admins de la org pueden **subir/borrar** en su carpeta
- Super_admin puede gestionar cualquier carpeta

---

## 🧪 Comandos útiles para debugging

### Ver logs de super_admin en BD
```sql
SELECT
  created_at,
  action,
  u.email AS super_admin,
  o.name AS target_org,
  changes
FROM audit_logs al
JOIN users u ON u.id = al.user_id
JOIN organizations o ON o.id = al.organization_id
WHERE action LIKE 'support_mode.%'
ORDER BY created_at DESC
LIMIT 10;
```

### Ver logos subidos
```sql
SELECT
  name,
  created_at,
  ROUND((metadata->>'size')::numeric / 1024, 1) AS kb
FROM storage.objects
WHERE bucket_id = 'organization-logos'
ORDER BY created_at DESC;
```

### Limpiar logos huérfanos
```sql
-- (opcional, si hay logos de empresas que ya se borraron)
DELETE FROM storage.objects
WHERE bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1] NOT IN (
    SELECT id::text FROM organizations
  );
```

---

## ❓ Troubleshooting

### "New row violates row-level security policy"
La policy de upload falló. Verifica:
- Estás logueado
- Tu user tiene `role='admin'` o `role='super_admin'`
- El path del archivo empieza con tu `organization_id`

### El banner de modo soporte no aparece
Verifica:
- Eres super_admin (`users.role = 'super_admin'`)
- Tu `organizationId` ≠ `orgStore.current.id`
- Estás en un subdomain (no localhost sin VITE_DEV_SUBDOMAIN)

### El logo no aparece en el sidebar después de subirlo
Recarga la página. El `orgStore.current.logoUrl` se actualiza al momento,
pero si estabas en otra pestaña puede tener cache del estado anterior.

---

## 🎯 Próximos sprints sugeridos

Después de deployar este paquete, los siguientes pasos recomendados son:

**Sprint 8 — Email automático de invitaciones (2h)**
Para que las empresas nuevas reciban el link por email automáticamente
en lugar del copy-paste manual del wizard.

**Sprint 9 — Telegram como 2do canal (2-3h)**
Primer canal adicional al widget web. Amplía el mercado de clientes.

**Sprint 11 — Facturación Stripe (6h)**
Monetización: 3 planes (Starter / Pro / Business) con gates por features.

¡Listo para seguir después del deploy! 🚀
