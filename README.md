# Sprint 5 — Multi-tenant con subdominios

Arquitectura completa para que LORA soporte múltiples empresas con sus propios subdominios: `jab.lorachat.net`, `norson.lorachat.net`, `capitali.lorachat.net`, etc.

Incluye también el **wizard del super admin** para crear empresas nuevas sin tocar SQL.

---

## 📦 Archivos incluidos (13)

```
lora-sprint5/
├── README.md                                                          ← este archivo
│
├── supabase/
│   └── migrations/
│       └── 20260423_sprint5_functions.sql                             ← RPC atómico + RLS super_admin
│
└── src/
    ├── types/
    │   └── organization.types.ts                                      ← NUEVO · tipos TS
    │
    ├── stores/
    │   └── organization.store.ts                                      ← NUEVO · Pinia store
    │
    ├── composables/
    │   └── useOrganizationContext.ts                                  ← NUEVO · detector de subdomain
    │
    ├── router/
    │   ├── guards.ts                                                  ← REEMPLAZO · +orgContextGuard, +superAdminGuard
    │   └── index.ts                                                   ← REEMPLAZO · +ruta super-admin
    │
    ├── repository/supabase/
    │   └── organizations.repo.ts                                      ← NUEVO · CRUD de orgs
    │
    ├── layouts/
    │   └── AdminLayout.vue                                            ← REEMPLAZO · sección LORA Admin + branding dinámico
    │
    └── modules/super-admin/
        ├── views/
        │   └── OrganizationsView.vue                                  ← NUEVO · lista + acciones
        └── components/
            ├── CreateOrganizationWizard.vue                           ← NUEVO · wizard 4 pasos
            ├── OrganizationCard.vue                                   ← NUEVO · card individual
            ├── SubdomainInput.vue                                     ← NUEVO · input con validación
            └── WidgetPreview.vue                                      ← NUEVO · preview en vivo
```

---

## 🎯 Qué hace este Sprint

### 1. Detección automática de subdomain
Cuando alguien entra a `jab.lorachat.net`:
1. El composable `useOrganizationContext()` detecta `subdomain = "jab"`
2. El store `organization.store.ts` llama al RPC `get_org_by_subdomain('jab')`
3. Si existe → carga los datos de Jab, aplica su color primario al CSS
4. Si no existe → redirige a login con error

### 2. Login contextualizado
- Super admin entra a cualquier subdomain → **OK**
- Admin de Jab entra a `jab.lorachat.net` → **OK**
- Admin de Jab entra a `norson.lorachat.net` → **Acceso denegado** (usuario de otra org)

### 3. Branding dinámico
Cuando estás en `jab.lorachat.net`:
- Sidebar del admin muestra **"Jab Enterprises"** en vez de "LORA"
- Color primario del CSS cambia al de Jab
- Título de la pestaña: "LORA · Jab Enterprises"

### 4. Wizard del super admin
Tú (`role = 'super_admin'`) ves una nueva sección **"LORA Admin"** en el sidebar:
- Click en "Organizaciones" → lista completa de empresas
- Botón "+ Nueva empresa" → wizard de 4 pasos
- Al crear: genera org + canal widget + rol admin + invitación en una transacción
- Resultado: te muestra el link de invitación con botones "Copiar" y "Compartir por WhatsApp"

---

## 🚀 Orden de instalación (5 pasos)

### Paso 1 — Backup (importante)

```powershell
cd C:\xampp\htdocs\proyectos\chatbot

# Branch de seguridad
git checkout -b feat/sprint-5-multitenant
git add -A
git commit -m "pre-sprint-5 snapshot"
```

### Paso 2 — Correr migración SQL

1. Abre: https://supabase.com/dashboard/project/imvahmyywbtcfsduwbdq/sql/new
2. Copia todo el contenido de `supabase/migrations/20260423_sprint5_functions.sql`
3. Pégalo en el editor
4. Click en **Run**

**Resultado esperado:** la última query devuelve `count = 4` (las 4 funciones nuevas creadas).

### Paso 3 — Copiar los archivos Vue/TS

Descomprime el ZIP y copia los archivos a sus rutas (todos en `src/`):

| Archivo del ZIP | Destino |
|---|---|
| `src/types/organization.types.ts` | Crea nuevo |
| `src/stores/organization.store.ts` | Crea nuevo |
| `src/composables/useOrganizationContext.ts` | Crea nuevo |
| `src/repository/supabase/organizations.repo.ts` | Crea nuevo |
| `src/router/guards.ts` | **REEMPLAZA el existente** |
| `src/router/index.ts` | **REEMPLAZA el existente** |
| `src/layouts/AdminLayout.vue` | **REEMPLAZA el existente** |
| `src/modules/super-admin/views/OrganizationsView.vue` | Crea nuevo |
| `src/modules/super-admin/components/CreateOrganizationWizard.vue` | Crea nuevo |
| `src/modules/super-admin/components/OrganizationCard.vue` | Crea nuevo |
| `src/modules/super-admin/components/SubdomainInput.vue` | Crea nuevo |
| `src/modules/super-admin/components/WidgetPreview.vue` | Crea nuevo |

### Paso 4 — Verificar compilación

```powershell
cd C:\xampp\htdocs\proyectos\chatbot

# Check de TypeScript
npm run typecheck
```

Debería terminar sin errores.

Si hay errores de TypeScript, me los pegas y los resolvemos.

### Paso 5 — Build y deploy

```powershell
npm run build
```

Sube `/dist` al FTP de `admin.lorachat.net` sobrescribiendo lo existente.

---

## ✅ Validación post-deploy

### Check 1: Super admin UI visible

1. Abre `https://admin.lorachat.net` en incógnito
2. Login con tu cuenta super_admin
3. En el sidebar, al final, deberías ver una sección **"LORA Admin"** con el ícono 🏢 **"Organizaciones"**
4. Si no la ves → tu usuario no tiene `role = 'super_admin'` en la tabla `users`

**Para verificar tu rol:**
```sql
SELECT id, email, role FROM users WHERE id = auth.uid();
```

Si `role != 'super_admin'`:
```sql
UPDATE users SET role = 'super_admin' WHERE id = 'f8c1ecb6-2230-448b-9508-140e97d5ba5e';
```

### Check 2: Lista de organizaciones

Click en "Organizaciones". Deberías ver:
- **Jab Enterprises** (subdomain: jab) — activa
- **Norson Group** (subdomain: norson) — activa

Con sus métricas de usuarios y conversaciones.

### Check 3: Crear Capitali con el wizard

Click en **+ Nueva empresa** y sigue los 4 pasos:

```
Paso 1: Nombre = "Capitali" · Email = (opcional, ej: admin@capitali.com)
Paso 2: Subdomain = "capitali" (debe mostrar ✓ Disponible)
Paso 3: Color = #10B981 (verde) · Mensaje bienvenida = "Hola! En qué te puedo ayudar?"
Paso 4: Click en "✨ Crear empresa"
```

Al final deberías ver:
- ✅ Modal verde "¡Empresa creada! 🎉"
- URL: `https://capitali.lorachat.net`
- Link de invitación copiable
- Botón "📱 WhatsApp" para compartir

### Check 4: Acceder al subdomain nuevo

Abre en incógnito: `https://capitali.lorachat.net`

Deberías ver:
- Login de LORA
- Al entrar con tu cuenta super_admin: sidebar muestra **"Capitali"** con el color verde
- El título de la pestaña dice "LORA · Capitali"

### Check 5: Aislamiento de datos (RLS)

Desde `https://capitali.lorachat.net`:
- Vas a Inbox → debe estar **vacío** (Capitali no tiene conversaciones aún)
- Vas a Canales → hay un canal "Widget Web" pre-creado

Desde `https://jab.lorachat.net`:
- Vas a Inbox → ves **las conversaciones de Jab**

Confirma que los datos no se cruzan.

---

## 🐛 Problemas comunes y soluciones

### Problema 1: "La empresa 'capitali' no existe o está desactivada"

**Causa:** el wildcard DNS no está propagando para ese subdomain, o la org no está en DB.

**Solución:**
```powershell
# Verifica DNS
nslookup capitali.lorachat.net

# Si no existe, espera 5-10 minutos y vuelve a probar
```

```sql
-- Verifica la org en DB
SELECT id, name, subdomain, active FROM organizations WHERE subdomain = 'capitali';
```

### Problema 2: Error "Solo super_admin puede crear organizaciones"

**Causa:** tu usuario no tiene `role = 'super_admin'` en la tabla `users`.

**Solución:**
```sql
UPDATE users SET role = 'super_admin' WHERE id = 'TU_USER_ID';
```

### Problema 3: "No hay tablas bot_personas" (warning opcional)

La función intenta crear una bot_persona default. Si esa tabla no existe, se salta esa parte. Es esperado.

Si quieres crear una persona default para orgs nuevas en el futuro, verifica que la tabla exista o ajusta la función.

### Problema 4: El branding del tenant no se aplica

**Causa:** El store no carga la org antes de renderizar el layout.

**Solución:** Verifica que `orgStore.applyBrandingToDOM()` se llame en `onMounted` del AdminLayout. Si el problema persiste, revisa que el RPC `get_org_by_subdomain` sea accesible por `anon` (la migración lo configura).

### Problema 5: TypeScript se queja del import de `useDocumentTitle`

Si no tienes ese composable (lo creamos en Sprint 7), reemplaza la línea:
```typescript
import { useDocumentTitle } from '@/composables/useDocumentTitle'
```
Y la llamada `useDocumentTitle()` con un comentario o elimínalas. Son opcionales.

---

## 🎨 Personalización

### Cambiar el dominio base

Si algún día migras el dominio, edita `src/composables/useOrganizationContext.ts`:

```typescript
const BASE_DOMAIN = 'lorachat.net'  // ← cambiar aquí
```

### Agregar subdominios reservados

```sql
INSERT INTO reserved_subdomains (subdomain, reason)
VALUES ('nuevo', 'Mi razón');
```

### Desarrollo local con subdomain simulado

En `.env.local`:
```
VITE_DEV_SUBDOMAIN=jab
```

Reinicia `npm run dev` y la app se comportará como si estuvieras en `jab.lorachat.net`. Útil para probar el flujo tenant sin DNS real.

---

## 📊 Qué NO incluye este Sprint (decisiones futuras)

Intencional para no inflar este sprint:

- ❌ **Envío automático de email de invitación** — por ahora copias el link manualmente
- ❌ **Editar organizaciones existentes** (nombre/color/subdomain) — solo crear/activar/desactivar
- ❌ **Borrado permanente de organizaciones** — solo soft delete (active=false)
- ❌ **Subir logos** — URL manual por ahora, upload en Sprint futuro
- ❌ **Gestión de planes/billing** — el campo `plan` existe pero no hace nada
- ❌ **Transferencia de datos entre orgs** — no está implementado
- ❌ **Auto-servicio (clientes creando su propia org)** — solo super_admin crea orgs

---

## 🗺️ Próximos sprints sugeridos

Una vez este funcione:

1. **Editor de branding por tenant** — para que cada admin pueda editar su propio color/logo
2. **Email automático de invitación** — setup Resend o Brevo
3. **Landing page de "sign up"** — auto-servicio para que nuevos clientes se registren
4. **Billing con Stripe** — cobrar planes
5. **Telegram como canal adicional** — que faltó del backlog

---

**© 2026 Jab Enterprises · LORA Chat Sprint 5**
