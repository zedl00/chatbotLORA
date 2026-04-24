// Ruta: /src/composables/useSupportMode.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 6: Detecta si el usuario está operando en "modo soporte".
//
// Modo soporte = super_admin entrando a un tenant que NO es el suyo.
// Ejemplo: nestorvaldez@hotmail.com (super_admin de Jab) entra a
// capitali.lorachat.net → está operando en modo soporte sobre Capitali.
//
// Se usa para:
//   - Mostrar banner naranja arriba del panel
//   - Loggear acciones con prefix 'support_mode.' en audit_logs
//   - Pedir confirmaciones adicionales en acciones destructivas
// ═══════════════════════════════════════════════════════════════
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useOrganizationStore } from '@/stores/organization.store'
import { supabase } from '@/services/supabase.client'

export function useSupportMode() {
  const auth = useAuthStore()
  const orgStore = useOrganizationStore()

  /**
   * true cuando el usuario actual es super_admin Y está en un tenant
   * que no es su propia organización.
   */
  const isSupportMode = computed(() => {
    if (!auth.user) return false
    if (auth.user.role !== 'super_admin') return false
    if (!orgStore.isTenant) return false
    if (!orgStore.current) return false

    return auth.user.organizationId !== orgStore.current.id
  })

  /**
   * El nombre de la empresa que está viendo el super_admin.
   */
  const supportingOrgName = computed(() => {
    if (!isSupportMode.value) return null
    return orgStore.displayName
  })

  /**
   * URL del panel "propio" del super_admin (admin.lorachat.net).
   */
  const ownPanelUrl = computed(() => {
    if (import.meta.env.DEV) {
      return '/admin/dashboard'
    }
    return 'https://admin.lorachat.net/admin/dashboard'
  })

  /**
   * Vuelve al panel de super_admin (sale del modo soporte).
   */
  function exitSupportMode() {
    window.location.href = ownPanelUrl.value
  }

  /**
   * Registra una acción en audit_logs marcada como "support_mode".
   * Útil para tener trazabilidad clara de qué hizo el super_admin
   * mientras operaba en nombre de otra empresa.
   */
  async function logSupportAction(
    action: string,
    options?: {
      entityType?: string
      entityId?: string
      details?: Record<string, unknown>
    }
  ): Promise<void> {
    if (!isSupportMode.value || !orgStore.current) return

    try {
      await supabase.rpc('log_support_mode_action', {
        p_target_org_id: orgStore.current.id,
        p_action: action,
        p_entity_type: options?.entityType ?? null,
        p_entity_id: options?.entityId ?? null,
        p_details: options?.details ?? {}
      })
    } catch (e) {
      console.warn('[useSupportMode] Error registrando acción de soporte:', e)
    }
  }

  /**
   * Wrapper para pedir confirmación extra en acciones destructivas
   * cuando se está en modo soporte.
   *
   * Uso:
   *   const ok = await confirmIfSupportMode('Eliminar contacto', 'contact.delete')
   *   if (!ok) return
   */
  async function confirmIfSupportMode(
    actionDescription: string,
    actionKey: string,
    entityId?: string
  ): Promise<boolean> {
    if (!isSupportMode.value) return true

    const confirmed = window.confirm(
      `⚠️ MODO SOPORTE\n\n` +
      `Estás operando en ${supportingOrgName.value} como super_admin.\n\n` +
      `Acción: ${actionDescription}\n\n` +
      `¿Continuar?`
    )

    if (confirmed) {
      await logSupportAction(actionKey, { entityId })
    }

    return confirmed
  }

  return {
    isSupportMode,
    supportingOrgName,
    ownPanelUrl,
    exitSupportMode,
    logSupportAction,
    confirmIfSupportMode
  }
}
