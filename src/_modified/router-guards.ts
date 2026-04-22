// Ruta: /src/router/guards.ts
// ═══════════════════════════════════════════════════════════════
// MODIFICADO en RBAC sprint:
//   - Nuevo permissionGuard (usa permisos granulares)
//   - Nuevo mustChangePasswordGuard (para usuarios con contraseña temporal)
//   - roleGuard se mantiene por compatibilidad con rutas que aún usen meta.roles
// ═══════════════════════════════════════════════════════════════
import type { NavigationGuard } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissionsStore } from '@/stores/permissions.store'
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
 * 🆕 Guard que fuerza el cambio de contraseña cuando el flag must_change_password=true.
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
 * 🆕 Guard de permisos granulares.
 * Lee meta.permission (string o array) y verifica con permissionsStore.
 *
 * Formas de uso en meta:
 *   meta: { permission: 'conversations.read' }
 *   meta: { permission: 'conversations.read', permissionScope: 'team' }
 *   meta: { permissionAny: ['reports.view', 'reports.export'] }
 *   meta: { permissionAll: ['users.read', 'roles.read'] }
 */
export const permissionGuard: NavigationGuard = async (to) => {
  const authStore = useAuthStore()
  const permsStore = usePermissionsStore()

  if (!authStore.isAuthenticated) return true   // authGuard ya manejó esto
  if (to.meta.public) return true

  // Si aún no cargaron los permisos, esperar
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
 * Guard de roles legacy (compatibilidad). Solo se activa si meta.roles está presente.
 * Las nuevas rutas deben usar meta.permission en lugar de meta.roles.
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
