// Ruta: /src/router/guards.ts
// ═══════════════════════════════════════════════════════════════
// MODIFICADO en Sprint 5 (Multi-tenant):
//   - orgContextGuard: NUEVO + fix de loop infinito en rutas auth
//   - superAdminGuard: NUEVO
//   - Los guards existentes (authGuard, mustChangePasswordGuard,
//     permissionGuard, roleGuard) NO cambian.
// ═══════════════════════════════════════════════════════════════
import type { NavigationGuard } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissionsStore } from '@/stores/permissions.store'
import { useOrganizationStore } from '@/stores/organization.store'
import type { UserRole } from '@/types/user.types'
import type { PermissionScope } from '@/types/rbac.types'

/**
 * Guard de autenticación: redirige a login si la ruta requiere auth y no hay sesión.
 */
export const authGuard: NavigationGuard = async (to) => {
  const authStore = useAuthStore()

  if (!authStore.initialized) {
    await authStore.initialize()
  }

  const isPublic = to.meta.public === true
  const requiresAuth = to.meta.requiresAuth === true

  if (requiresAuth && !authStore.isAuthenticated) {
    return { name: 'auth.login', query: { redirect: to.fullPath } }
  }

  if (isPublic && authStore.isAuthenticated && to.name === 'auth.login') {
    return { name: 'admin.dashboard' }
  }

  return true
}

/**
 * Guard que fuerza el cambio de contraseña cuando el flag must_change_password=true.
 * Aplica solo a usuarios autenticados en rutas del panel (no en /auth/*).
 */
export const mustChangePasswordGuard: NavigationGuard = (to) => {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) return true
  if (!authStore.mustChangePassword) return true

  // Permitir acceder a la vista de cambio de contraseña y signout
  if (to.name === 'auth.change-password') return true

  return { name: 'auth.change-password' }
}

/**
 * Guard de permisos granulares.
 */
export const permissionGuard: NavigationGuard = async (to) => {
  const authStore = useAuthStore()
  const permsStore = usePermissionsStore()

  if (!authStore.isAuthenticated) return true
  if (to.meta.public) return true

  if (!permsStore.loaded && authStore.user) {
    try {
      await permsStore.load(authStore.user.id)
    } catch (e) {
      console.error('[permissionGuard] Error cargando permisos:', e)
    }
  }

  const required = to.meta.permission as string | undefined
  const scope = (to.meta.permissionScope as PermissionScope | undefined) ?? 'own'
  const requiredAny = to.meta.permissionAny as string[] | undefined
  const requiredAll = to.meta.permissionAll as string[] | undefined

  if (required) {
    if (!permsStore.can(required, scope)) {
      console.warn(`[permissionGuard] Falta permiso: ${required} (scope: ${scope})`)
      return { name: 'admin.dashboard' }
    }
  }
  if (requiredAny && requiredAny.length > 0) {
    if (!permsStore.canAny(requiredAny)) {
      return { name: 'admin.dashboard' }
    }
  }
  if (requiredAll && requiredAll.length > 0) {
    if (!permsStore.canAll(requiredAll)) {
      return { name: 'admin.dashboard' }
    }
  }

  return true
}

/**
 * Guard de roles legacy.
 */
export const roleGuard: NavigationGuard = (to) => {
  const authStore = useAuthStore()
  const allowedRoles = to.meta.roles as UserRole[] | undefined

  if (!allowedRoles || allowedRoles.length === 0) return true
  if (!authStore.user) return { name: 'auth.login' }

  const userRole = authStore.user.role
  if (!allowedRoles.includes(userRole)) {
    return { name: 'admin.dashboard' }
  }

  return true
}

/**
 * 🆕 Sprint 5: Guard de contexto de organización.
 *
 * FIX IMPORTANTE (loop infinito):
 *   - El guard NUNCA se ejecuta en rutas con meta.public=true
 *   - El guard NUNCA se ejecuta en rutas /auth/*
 *   - Si detecta que el usuario no pertenece a la org, HACE LOGOUT
 *     antes de redirigir a login (no solo redirige, que causaba loop)
 */
export const orgContextGuard: NavigationGuard = async (to) => {
  // ═════════════════════════════════════════════════════════════
  // EXCLUSIONES CRÍTICAS (para evitar loop infinito)
  // ═════════════════════════════════════════════════════════════

  // 1. Rutas públicas NUNCA pasan por este guard
  if (to.meta.public === true) return true

  // 2. Cualquier ruta /auth/* NUNCA pasa por este guard
  //    (login, forgot-password, accept-invite, change-password)
  if (to.path.startsWith('/auth/')) return true

  // 3. Si el nombre de la ruta empieza con 'auth.', tampoco
  if (typeof to.name === 'string' && to.name.startsWith('auth.')) return true

  const authStore = useAuthStore()
  const orgStore = useOrganizationStore()

  // Si aún no cargó la org, esperar
  if (!orgStore.loaded) {
    await orgStore.loadFromSubdomain()
  }

  // En modo super-admin (admin.lorachat.net) no validamos subdomain
  if (orgStore.isSuperAdminMode) {
    return true
  }

  // En modo unknown (localhost sin VITE_DEV_SUBDOMAIN), permitir
  if (orgStore.mode === 'unknown') {
    return true
  }

  // Aquí estamos en modo tenant → el subdomain debe existir y estar activa
  if (!orgStore.current) {
    return {
      name: 'auth.login',
      query: { error: 'org_not_found', subdomain: orgStore.subdomain ?? '' }
    }
  }

  // Si el usuario está autenticado, validar que pertenezca a esta org
  if (authStore.isAuthenticated && authStore.user) {
    const userOrgId = authStore.user.organizationId
    const currentOrgId = orgStore.current.id
    const isSuperAdmin = authStore.user.role === 'super_admin'

    if (!isSuperAdmin && userOrgId !== currentOrgId) {
      console.warn(
        `[orgContextGuard] Usuario ${authStore.user.email} de org ${userOrgId} ` +
        `intentó acceder a org ${currentOrgId}. Cerrando sesión y redirigiendo.`
      )

      // 🆕 FIX: cerrar sesión antes de redirigir.
      // Sin esto, después del redirect el usuario sigue "autenticado"
      // pero en el subdomain incorrecto, y el guard vuelve a disparar → loop.
      try {
        await authStore.signOut()
        orgStore.clear()
      } catch (e) {
        console.error('[orgContextGuard] Error cerrando sesión:', e)
      }

      return {
        name: 'auth.login',
        query: { error: 'wrong_org' }
      }
    }
  }

  return true
}

/**
 * 🆕 Sprint 5: Guard exclusivo para rutas de super_admin.
 */
export const superAdminGuard: NavigationGuard = (to) => {
  const authStore = useAuthStore()

  if (!authStore.isAuthenticated || !authStore.user) {
    return { name: 'auth.login', query: { redirect: to.fullPath } }
  }

  if (authStore.user.role !== 'super_admin') {
    console.warn('[superAdminGuard] Acceso denegado a usuario no super_admin')
    return { name: 'admin.dashboard' }
  }

  return true
}