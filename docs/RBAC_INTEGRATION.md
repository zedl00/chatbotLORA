# 🔐 RBAC Integration Guide

> **Ruta:** `/docs/RBAC_INTEGRATION.md`
> **Cómo integrar el módulo RBAC Enterprise al proyecto base.**

---

## 📦 Contenido del módulo

```
rbac-module/
├── supabase/
│   ├── migrations/
│   │   ├── 20260422000001_rbac_schema.sql          ← NUEVO
│   │   ├── 20260422000002_rbac_seed.sql            ← NUEVO
│   │   ├── 20260422000003_rbac_functions.sql       ← NUEVO
│   │   └── 20260422000004_invitation_public_read.sql ← NUEVO
│   └── functions/
│       ├── user-invite/          ← NUEVA Edge Function
│       ├── user-accept-invite/   ← NUEVA Edge Function
│       └── user-create/          ← NUEVA Edge Function
└── src/
    ├── types/
    │   └── rbac.types.ts         ← NUEVO
    ├── repository/supabase/
    │   ├── rbac.repo.ts          ← NUEVO
    │   └── user.repo.ts          ← NUEVO
    ├── stores/
    │   └── permissions.store.ts  ← NUEVO
    ├── composables/
    │   └── useCan.ts             ← NUEVO
    ├── directives/
    │   └── can.ts                ← NUEVO
    ├── modules/
    │   ├── agents/views/
    │   │   ├── UsersView.vue           ← NUEVO
    │   │   ├── RolesView.vue           ← NUEVO
    │   │   ├── InvitationsView.vue     ← NUEVO
    │   │   └── AuditLogView.vue        ← NUEVO
    │   ├── agents/components/
    │   │   ├── InviteUserModal.vue     ← NUEVO
    │   │   ├── CreateUserModal.vue     ← NUEVO
    │   │   └── EditUserRolesModal.vue  ← NUEVO
    │   └── auth/views/
    │       ├── AcceptInviteView.vue    ← NUEVO
    │       └── ChangePasswordView.vue  ← NUEVO
    └── _modified/  ⚠️  Archivos que hay que REEMPLAZAR en el proyecto base
        ├── main.ts                ← reemplaza /src/main.ts
        ├── auth.store.ts          ← reemplaza /src/stores/auth.store.ts
        ├── repository-index.ts    ← reemplaza /src/repository/index.ts
        ├── router-index.ts        ← reemplaza /src/router/index.ts
        ├── router-guards.ts       ← reemplaza /src/router/guards.ts
        └── AdminLayout.vue        ← reemplaza /src/layouts/AdminLayout.vue
```

---

## 🚀 Paso 1 — Copiar archivos NUEVOS al proyecto

Desde la raíz del proyecto `chatbot-ia-empresarial/`:

```bash
# Descomprimir el módulo RBAC en una carpeta aparte
unzip rbac-module.zip -d /tmp/rbac

# Migraciones
cp /tmp/rbac/supabase/migrations/*.sql supabase/migrations/

# Edge Functions (carpetas completas)
cp -r /tmp/rbac/supabase/functions/user-invite        supabase/functions/
cp -r /tmp/rbac/supabase/functions/user-accept-invite supabase/functions/
cp -r /tmp/rbac/supabase/functions/user-create        supabase/functions/

# Archivos nuevos de src/
cp /tmp/rbac/src/types/rbac.types.ts                    src/types/
cp /tmp/rbac/src/repository/supabase/rbac.repo.ts       src/repository/supabase/
cp /tmp/rbac/src/repository/supabase/user.repo.ts       src/repository/supabase/
cp /tmp/rbac/src/stores/permissions.store.ts            src/stores/
cp /tmp/rbac/src/composables/useCan.ts                  src/composables/
cp -r /tmp/rbac/src/directives                          src/
cp /tmp/rbac/src/modules/agents/views/UsersView.vue     src/modules/agents/views/
cp /tmp/rbac/src/modules/agents/views/RolesView.vue     src/modules/agents/views/
cp /tmp/rbac/src/modules/agents/views/InvitationsView.vue src/modules/agents/views/
cp /tmp/rbac/src/modules/agents/views/AuditLogView.vue  src/modules/agents/views/
cp -r /tmp/rbac/src/modules/agents/components           src/modules/agents/
cp /tmp/rbac/src/modules/auth/views/AcceptInviteView.vue  src/modules/auth/views/
cp /tmp/rbac/src/modules/auth/views/ChangePasswordView.vue src/modules/auth/views/
```

---

## 🔁 Paso 2 — Reemplazar archivos MODIFICADOS

**Revisa los diffs antes de reemplazar.** Los 6 archivos de `_modified/` tienen cambios específicos marcados con comentarios `// 🆕 RBAC:`.

```bash
cp /tmp/rbac/src/_modified/main.ts                 src/main.ts
cp /tmp/rbac/src/_modified/auth.store.ts           src/stores/auth.store.ts
cp /tmp/rbac/src/_modified/repository-index.ts     src/repository/index.ts
cp /tmp/rbac/src/_modified/router-index.ts         src/router/index.ts
cp /tmp/rbac/src/_modified/router-guards.ts        src/router/guards.ts
cp /tmp/rbac/src/_modified/AdminLayout.vue         src/layouts/AdminLayout.vue
```

---

## 🗄️ Paso 3 — Aplicar migraciones a Supabase

```bash
supabase db push
```

Esto ejecuta las 4 migraciones en orden:
1. `20260422000001_rbac_schema.sql` — Crea 7 tablas nuevas.
2. `20260422000002_rbac_seed.sql` — Inserta 60+ permisos + 5 roles del sistema con sus permisos asignados.
3. `20260422000003_rbac_functions.sql` — Crea `has_permission()`, `get_user_permissions()`, triggers de auditoría, RLS, y **migra automáticamente** los `users.role` actuales a `user_roles`.
4. `20260422000004_invitation_public_read.sql` — Policy pública para leer invitaciones por token.

### ✅ Verificar la migración

En el SQL Editor de Supabase:

```sql
-- Ver permisos creados
SELECT category, COUNT(*) FROM permissions GROUP BY category ORDER BY category;

-- Ver roles del sistema
SELECT key, name, priority FROM roles WHERE is_system = true ORDER BY priority DESC;

-- Ver que tus usuarios existentes se migraron
SELECT u.email, u.role AS legacy_role, r.name AS new_role
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
ORDER BY u.created_at;

-- Probar has_permission con tu usuario
SELECT public.has_permission(
  (SELECT id FROM users WHERE email = 'tu@correo.com'),
  'users.invite',
  'all'::permission_scope
);
-- Debería devolver true si eres super_admin o admin
```

---

## 🌐 Paso 4 — Desplegar Edge Functions

```bash
# Configurar secrets requeridos
supabase secrets set RESEND_API_KEY=re_...         # opcional (si no, no se envían emails)
supabase secrets set RESEND_FROM_EMAIL=noreply@tudominio.com
supabase secrets set APP_URL=https://app.tudominio.com

# Deploy de las 3 funciones
supabase functions deploy user-invite
supabase functions deploy user-accept-invite --no-verify-jwt   # debe ser pública
supabase functions deploy user-create
```

> **Importante:** `user-accept-invite` se despliega con `--no-verify-jwt` porque el usuario AÚN NO tiene cuenta cuando invoca esta función. La seguridad la da el token criptográfico.

---

## 🧪 Paso 5 — Probar en local

```bash
pnpm install      # por si hay deps nuevas (no debería haber)
pnpm typecheck    # verificar que TypeScript compila
pnpm dev
```

### Flujo de prueba — Invitación por email

1. Login como `super_admin` en `/auth/login`
2. Ir a `/admin/users` → debe aparecer en el menú lateral.
3. Clic en **"✉️ Invitar por email"**
4. Llenar email (usa uno que tengas accesible), elegir rol **Agente**, enviar.
5. Si configuraste Resend, te llegará el email. Si no, aparece el link en pantalla para copiarlo.
6. Abrir el link en ventana privada → aterriza en `/auth/accept-invite?token=...`
7. Completar nombre, contraseña → click "Aceptar e ingresar".
8. Se crea la cuenta, se hace login automático, redirige al dashboard.

### Flujo de prueba — Crear usuario directo

1. En `/admin/users` → clic **"➕ Crear usuario"**.
2. Llenar datos, usar la contraseña temporal generada.
3. Copiar credenciales, entregarlas al usuario.
4. En ventana privada, hacer login con ese usuario.
5. Automáticamente es redirigido a `/auth/change-password` (forzado).
6. Después de cambiar la contraseña, accede al dashboard normalmente.

### Flujo de prueba — Roles personalizados

1. Ir a `/admin/roles`
2. Clic **"➕ Nuevo rol"**
3. Llenar datos: Nombre "Agente Senior", ícono `⭐`, color a elección.
4. En la lista de permisos, marcar los permisos del rol "Agente" + agregar `conversations.assign` con scope "team".
5. Guardar.
6. Ir a `/admin/users` → Editar roles de algún agente → asignarle "Agente Senior".
7. Login con ese usuario → verificar que ahora puede reasignar conversaciones.

### Flujo de prueba — Auditoría

1. Ir a `/admin/audit`
2. Deberías ver entradas por cada asignación/revocación de roles hecha en los flujos anteriores.
3. Clic en una entrada → detalle completo con before/after state en JSON.

---

## 💻 Paso 6 — Usar RBAC en tu código

### En templates Vue — directiva `v-can`

```vue
<template>
  <!-- Simple -->
  <button v-can="'conversations.assign'" @click="assign">Asignar</button>

  <!-- Con scope específico -->
  <button v-can="['conversations.delete', 'all']" @click="deleteConv">
    Eliminar
  </button>

  <!-- Cualquiera de varios (OR) -->
  <div v-can.any="['contacts.create', 'contacts.update']">
    Puedes gestionar contactos
  </div>

  <!-- Todos (AND) -->
  <div v-can.all="['reports.view', 'reports.export']">
    Exportar reporte
  </div>

  <!-- Inverso (mostrar si NO tiene) -->
  <div v-can.not="'billing.manage'">
    Actualiza tu plan
  </div>
</template>
```

### En `<script setup>` — composable `useCan`

```vue
<script setup lang="ts">
import { useCan } from '@/composables/useCan'

const { can, canAny, canAll, scopeOf, isSuperAdmin } = useCan()

// Imperativo
function handleDelete() {
  if (!can('contacts.delete')) {
    alert('No tienes permiso')
    return
  }
  // ...
}

// Para filtrar queries según scope
const myScope = scopeOf('conversations.read')  // 'own' | 'team' | 'all' | null
const query = {
  agentId: myScope === 'own' ? currentUserId : undefined,
  teamId:  myScope === 'team' ? currentTeamId : undefined
  // myScope === 'all' → sin filtro
}
</script>
```

### En rutas — `meta.permission`

```typescript
{
  path: '/admin/contacts',
  name: 'admin.contacts',
  component: () => import('@/modules/contacts/views/ContactsView.vue'),
  meta: {
    permission: 'contacts.read',         // permiso requerido
    permissionScope: 'own'               // scope mínimo (default: 'own')
  }
}

// O con lógica OR:
{
  meta: {
    permissionAny: ['reports.view', 'reports.view_costs']
  }
}
```

### En código imperativo (stores, servicios)

```typescript
import { usePermissionsStore } from '@/stores/permissions.store'

const permsStore = usePermissionsStore()

if (permsStore.can('conversations.takeover', 'team')) {
  // ...
}

if (permsStore.isSuperAdmin) {
  // ...
}
```

### Refrescar permisos tras asignar un rol

```typescript
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
// ... después de asignar un rol nuevo al propio usuario ...
await auth.refreshPermissions()
```

---

## 🛡️ Paso 7 — Proteger tus RLS existentes con permisos granulares

Las policies RLS actuales del schema base usan `is_role_at_least('admin')`. Con RBAC puedes migrarlas gradualmente a:

```sql
-- ANTES (legacy):
CREATE POLICY "channels_manage_admin" ON channels
  FOR ALL USING (
    organization_id = public.current_user_org_id()
    AND public.is_role_at_least('admin')
  );

-- DESPUÉS (RBAC):
DROP POLICY "channels_manage_admin" ON channels;
CREATE POLICY "channels_manage_with_permission" ON channels
  FOR ALL USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('channels.update')
  )
  WITH CHECK (organization_id = public.current_user_org_id());
```

> **Hazlo gradualmente.** La función `is_role_at_least()` sigue funcionando; no es obligatorio migrar todas las policies de golpe.

---

## ⚠️ Troubleshooting

| Problema | Causa | Solución |
|---|---|---|
| `has_permission() returns false` para tu super_admin | El usuario no tiene entrada en `user_roles` | Verificar que la migración 003 corrió; ejecutar manualmente el `INSERT` en `user_roles` |
| La UI muestra todos los menús a todos | Permisos no se cargaron tras login | Revisar consola; verificar que `permissions.store.load()` se invoca tras `loadProfile()` |
| `/auth/accept-invite?token=X` dice "Invitación no encontrada" | La policy pública no está aplicada | Verificar que la migración `20260422000004` corrió |
| El email de invitación no llega | Resend no configurado o API key incorrecta | Por ahora, copiar el link manualmente desde el modal |
| `user-create` devuelve 403 | El usuario logueado no tiene `users.create` | Como super_admin, asignarse el permiso o usar rol Admin |

---

## 📋 Checklist final

- [ ] Las 4 migraciones corrieron sin errores
- [ ] `SELECT COUNT(*) FROM permissions` devuelve ≥ 60
- [ ] `SELECT COUNT(*) FROM roles WHERE is_system=true` devuelve 5
- [ ] Tu super_admin tiene entrada en `user_roles`
- [ ] Los 6 archivos modificados están reemplazados
- [ ] `pnpm typecheck` pasa
- [ ] `pnpm dev` arranca sin errores
- [ ] Puedes ver el menú "Administración" en el sidebar
- [ ] Puedes invitar un usuario y el flujo completo funciona
- [ ] `/admin/audit` muestra las acciones hechas
- [ ] `v-can="'conversations.assign'"` esconde/muestra botones correctamente
