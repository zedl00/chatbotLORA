# Plan de Commits — Sprint RBAC Enterprise

> **Ruta:** `/docs/RBAC_COMMITS.md`
> Secuencia recomendada para integrar el módulo RBAC vía feature branch.

---

## Estrategia

Una sola rama `feature/rbac-enterprise` desde `develop`, con commits atómicos. Al final, PR a `develop` → tras review, merge a `main` con tag `v0.2.0`.

## Preparación

```bash
git checkout develop
git pull origin develop
git checkout -b feature/rbac-enterprise
```

## Secuencia de commits

### 1. Schema SQL base del RBAC

```bash
git add supabase/migrations/20260422000001_rbac_schema.sql
git commit -m "feat(db): agregar schema de rbac con 7 tablas nuevas"
```

### 2. Catálogo de permisos y roles del sistema

```bash
git add supabase/migrations/20260422000002_rbac_seed.sql
git commit -m "feat(db): seed con 60+ permisos atómicos y 5 roles del sistema"
```

### 3. Funciones, RLS y migración automática

```bash
git add supabase/migrations/20260422000003_rbac_functions.sql
git commit -m "feat(db): función has_permission con rls y migración automática de datos legacy"
```

### 4. Policy pública para invitaciones

```bash
git add supabase/migrations/20260422000004_invitation_public_read.sql
git commit -m "feat(db): policy pública para aceptar invitaciones sin autenticación previa"
```

### 5. Tipos TypeScript

```bash
git add src/types/rbac.types.ts
git commit -m "feat(types): tipos del módulo rbac con constantes known_permissions"
```

### 6. Repositorios

```bash
git add src/repository/supabase/rbac.repo.ts \
        src/repository/supabase/user.repo.ts \
        src/repository/index.ts
git commit -m "feat(repository): repositorio rbac y user con mappers completos"
```

### 7. Store de permisos

```bash
git add src/stores/permissions.store.ts
git commit -m "feat(stores): store de permisos con cache o(1) y resolución de scopes"
```

### 8. Composable y directiva

```bash
git add src/composables/useCan.ts \
        src/directives/can.ts \
        src/main.ts
git commit -m "feat(auth): composable usecan y directiva v-can con modificadores any/all/not"
```

### 9. Edge Functions

```bash
git add supabase/functions/user-invite/ \
        supabase/functions/user-accept-invite/ \
        supabase/functions/user-create/
git commit -m "feat(functions): invitar, aceptar y crear usuarios con contraseña temporal"
```

### 10. Vistas y componentes RBAC

```bash
git add src/modules/agents/views/UsersView.vue \
        src/modules/agents/views/RolesView.vue \
        src/modules/agents/views/InvitationsView.vue \
        src/modules/agents/views/AuditLogView.vue \
        src/modules/agents/components/
git commit -m "feat(rbac): ui de gestión de usuarios, roles, invitaciones y auditoría"
```

### 11. Vistas auth nuevas

```bash
git add src/modules/auth/views/AcceptInviteView.vue \
        src/modules/auth/views/ChangePasswordView.vue
git commit -m "feat(auth): página pública de aceptar invitación y cambio forzado de contraseña"
```

### 12. Integración router y layout

```bash
git add src/router/index.ts \
        src/router/guards.ts \
        src/layouts/AdminLayout.vue
git commit -m "feat(router): guards de permisos y must-change-password + menú filtrado por permisos"
```

### 13. Store auth actualizado

```bash
git add src/stores/auth.store.ts
git commit -m "feat(auth): cargar permisos tras login y métodos updatepassword/refreshpermissions"
```

### 14. Documentación

```bash
git add docs/RBAC_INTEGRATION.md docs/RBAC_COMMITS.md
git commit -m "docs: guía de integración y plan de commits del módulo rbac"
```

### 15. Changelog y context

```bash
git add CHANGELOG.md CONTEXT.md
git commit -m "docs(changelog): registrar release v0.2.0 con rbac enterprise"
```

### 16. Push y PR

```bash
git push -u origin feature/rbac-enterprise
# Abrir PR en GitHub apuntando a develop
```

### 17. Tras merge a develop → release v0.2.0

```bash
git checkout develop && git pull
git checkout main && git pull
git merge develop --no-ff -m "chore(release): v0.2.0 — rbac enterprise"
git tag -a v0.2.0 -m "v0.2.0 — RBAC Enterprise"
git push origin main --tags
```

---

## Template del PR

Título: `feat: sistema RBAC enterprise con permisos granulares`

Cuerpo:

```markdown
## ¿Qué hace este PR?

Agrega un sistema completo de control de acceso basado en roles (RBAC) con:

- 7 tablas nuevas en DB (permissions, roles, role_permissions, user_roles, user_permissions, invitations, audit log)
- 60+ permisos atómicos en 13 categorías
- 5 roles del sistema preconfigurados
- Roles personalizados por organización
- Delegación temporal (expires_at)
- Permisos a nivel de equipo
- Invitación por email y creación directa con contraseña temporal
- Auditoría automática de cambios
- Composable `useCan()`, directiva `v-can`, guard `permissionGuard`
- 4 vistas nuevas: Usuarios, Roles, Invitaciones, Auditoría

## Breaking changes

Ninguno. `users.role` se mantiene por compatibilidad hacia atrás. Las rutas que usaban `meta.roles` siguen funcionando.

## Tests realizados

- [x] Typecheck pasa
- [x] Build pasa
- [x] Migración corre en staging sin errores
- [x] Usuario legacy (super_admin) mantiene acceso total tras migración
- [x] Invitación por email → aceptar → auto-login funciona
- [x] Crear usuario con contraseña temporal → login → cambio forzado funciona
- [x] Rol personalizado con permisos específicos funciona
- [x] v-can y v-can.any/all/not funcionan
- [x] Auditoría registra acciones automáticamente

## Screenshots

_[agregar capturas de: UsersView, RolesView, InvitationsView, AuditLogView]_

## Checklist

- [x] Cada archivo nuevo tiene `// Ruta: ...` o `<!-- Ruta: ... -->` al inicio
- [x] Sin `console.log()` olvidados
- [x] Sin credenciales hardcodeadas
- [x] `.env.example` actualizado si aplica (no requiere)
- [x] CHANGELOG.md actualizado en `[0.2.0]`
- [x] CONTEXT.md actualizado con decisiones nuevas
- [x] docs/RBAC_INTEGRATION.md creado
- [x] Tarea de Notion enlazada: _[pegar link]_
```
