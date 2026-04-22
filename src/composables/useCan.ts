// Ruta: /src/composables/useCan.ts
import { computed, type ComputedRef } from 'vue'
import { usePermissionsStore } from '@/stores/permissions.store'
import type { PermissionScope } from '@/types/rbac.types'

/**
 * Composable principal para verificar permisos en componentes.
 *
 * Uso en <script setup>:
 *   const { can, canAny, canAll, scopeOf, isSuperAdmin } = useCan()
 *   if (can('conversations.assign')) { ... }
 *
 * Uso en <template>:
 *   <button v-if="can('conversations.delete', 'all')">Eliminar</button>
 *
 * Uso reactivo como computed:
 *   const canEdit = useCanRef('conversations.update', 'team')
 *   <div v-if="canEdit">...</div>
 */
export function useCan() {
  const store = usePermissionsStore()

  return {
    can:          store.can,
    canAny:       store.canAny,
    canAll:       store.canAll,
    scopeOf:      store.scopeOf,
    isSuperAdmin: computed(() => store.isSuperAdmin),
    loaded:       computed(() => store.loaded)
  }
}

/**
 * Versión reactiva: retorna un ComputedRef<boolean>.
 * Útil si los permisos pueden cambiar durante la sesión (ej. tras aceptar un rol nuevo).
 */
export function useCanRef(
  permissionKey: string,
  scope: PermissionScope = 'own'
): ComputedRef<boolean> {
  const store = usePermissionsStore()
  return computed(() => store.can(permissionKey, scope))
}
