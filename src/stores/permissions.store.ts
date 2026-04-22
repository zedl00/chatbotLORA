// Ruta: /src/stores/permissions.store.ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { SupabaseRbacRepo } from '@/repository/supabase/rbac.repo'
import type { EffectivePermission, PermissionScope } from '@/types/rbac.types'

const repo = new SupabaseRbacRepo()

/**
 * Store que cachea los permisos efectivos del usuario autenticado.
 * Se carga UNA VEZ al login y se refresca cuando cambia la sesión.
 */
export const usePermissionsStore = defineStore('permissions', () => {
  const permissions = ref<EffectivePermission[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  // Índice interno para búsqueda O(1)
  const index = computed<Map<string, PermissionScope>>(() => {
    const m = new Map<string, PermissionScope>()
    // Si hay wildcard, cualquier .has() retorna true
    const hasWildcard = permissions.value.some((p) => p.permissionKey === '*')
    if (hasWildcard) {
      m.set('*', 'all')
      return m
    }

    for (const p of permissions.value) {
      const existing = m.get(p.permissionKey)
      // Si ya está, mantener el scope más amplio: all > team > own
      if (!existing || scopeRank(p.scope) > scopeRank(existing)) {
        m.set(p.permissionKey, p.scope)
      }
    }
    return m
  })

  const isSuperAdmin = computed(() => index.value.has('*'))

  async function load(userId: string) {
    loading.value = true
    try {
      permissions.value = await repo.getEffectivePermissions(userId)
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  function clear() {
    permissions.value = []
    loaded.value = false
  }

  /**
   * Verifica si el usuario tiene el permiso con al menos el scope requerido.
   * - can('conversations.read')                → verifica que tenga algún scope
   * - can('conversations.read', 'team')        → debe tener team o all
   * - can('conversations.read', 'all')         → debe tener all
   */
  function can(permissionKey: string, requiredScope: PermissionScope = 'own'): boolean {
    if (isSuperAdmin.value) return true
    const userScope = index.value.get(permissionKey)
    if (!userScope) return false

    // Jerarquía: all (3) cubre team (2) cubre own (1)
    return scopeRank(userScope) >= scopeRank(requiredScope)
  }

  /**
   * Verifica múltiples permisos con lógica OR.
   * canAny(['a', 'b']) = true si tiene al menos uno.
   */
  function canAny(keys: string[]): boolean {
    if (isSuperAdmin.value) return true
    return keys.some((k) => index.value.has(k))
  }

  /**
   * Verifica múltiples permisos con lógica AND.
   */
  function canAll(keys: string[]): boolean {
    if (isSuperAdmin.value) return true
    return keys.every((k) => index.value.has(k))
  }

  /**
   * Retorna el scope del usuario para un permiso dado (útil para filtrar queries).
   * Ejemplo: `if (scopeOf('conversations.read') === 'own') { filter.agentId = myId }`
   */
  function scopeOf(permissionKey: string): PermissionScope | null {
    if (isSuperAdmin.value) return 'all'
    return index.value.get(permissionKey) ?? null
  }

  return {
    permissions,
    loaded,
    loading,
    isSuperAdmin,
    load,
    clear,
    can,
    canAny,
    canAll,
    scopeOf
  }
})

function scopeRank(s: PermissionScope): number {
  return s === 'all' ? 3 : s === 'team' ? 2 : 1
}
