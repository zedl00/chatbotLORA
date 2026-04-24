// Ruta: /src/composables/useActiveOrganizationId.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 6.5: Fuente única de verdad para el ID de organización
// activo en el contexto multi-tenant.
//
// Reglas:
//   1. Si el usuario es super_admin Y está operando en un tenant
//      ajeno (modo soporte) → devuelve el ID del tenant activo.
//   2. Si no → devuelve el ID de la organización del usuario.
//
// Ejemplo:
//   - Super_admin en admin.lorachat.net → devuelve su orgId (Jab)
//   - Super_admin en capitali.lorachat.net → devuelve orgId de Capitali
//   - CapitaliRD en capitali.lorachat.net → devuelve orgId de Capitali
//   - CapitaliRD en jab.lorachat.net → no llega aquí, guard lo bloquea
//
// USO:
//   const activeOrgId = useActiveOrganizationId()
//   if (!activeOrgId.value) return
//   await repo.listX(activeOrgId.value)
// ═══════════════════════════════════════════════════════════════
import { computed, type ComputedRef } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useOrganizationStore } from '@/stores/organization.store'

export function useActiveOrganizationId(): ComputedRef<string | null> {
  const auth = useAuthStore()
  const orgStore = useOrganizationStore()

  return computed(() => {
    if (!auth.user) return null

    const isSuperAdmin = auth.user.role === 'super_admin'
    const isInTenantContext = orgStore.isTenant && orgStore.current !== null

    if (isSuperAdmin && isInTenantContext && orgStore.current) {
      return orgStore.current.id
    }

    return auth.user.organizationId
  })
}

export function getActiveOrganizationId(): string | null {
  const auth = useAuthStore()
  const orgStore = useOrganizationStore()

  if (!auth.user) return null

  const isSuperAdmin = auth.user.role === 'super_admin'
  const isInTenantContext = orgStore.isTenant && orgStore.current !== null

  if (isSuperAdmin && isInTenantContext && orgStore.current) {
    return orgStore.current.id
  }

  return auth.user.organizationId
}
