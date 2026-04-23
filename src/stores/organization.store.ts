// Ruta: /src/stores/organization.store.ts
// ═══════════════════════════════════════════════════════════════
// Store de Pinia para la organización activa (tenant actual).
// Sprint 5 · Bloque 3.
// ═══════════════════════════════════════════════════════════════
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/services/supabase.client'
import { useOrganizationContext } from '@/composables/useOrganizationContext'
import type { OrganizationContext } from '@/types/organization.types'

// Tipo del RPC get_org_by_subdomain
interface OrgRpcRow {
  id: string
  name: string
  subdomain: string
  brand_name: string | null
  primary_color: string | null
  logo_url: string | null
  logo_full_url: string | null
  active: boolean
}

export const useOrganizationStore = defineStore('organization', () => {
  // ── STATE ──────────────────────────────────────────────
  const current = ref<OrganizationContext | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  // ── GETTERS ────────────────────────────────────────────
  const { subdomain, mode, isTenant, isSuperAdminMode } = useOrganizationContext()

  const displayName = computed(() => current.value?.brandName ?? current.value?.name ?? 'LORA')
  const primaryColor = computed(() => current.value?.primaryColor ?? '#0071E3')
  const logoUrl = computed(() => current.value?.logoUrl ?? null)
  const hasActiveOrg = computed(() => current.value !== null && current.value.active === true)

  // ── ACTIONS ────────────────────────────────────────────

  async function loadFromSubdomain() {
    if (!isTenant || !subdomain) {
      loaded.value = true
      return
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: rpcError } = await supabase
        .rpc('get_org_by_subdomain', { p_subdomain: subdomain })
        .maybeSingle()

      if (rpcError) throw rpcError

      if (!data) {
        error.value = `La empresa "${subdomain}" no existe o está desactivada`
        current.value = null
      } else {
        // Cast explícito del resultado del RPC
        const rpcData = data as unknown as OrgRpcRow

        current.value = {
          id: rpcData.id,
          name: rpcData.name,
          subdomain: rpcData.subdomain,
          brandName: rpcData.brand_name,
          primaryColor: rpcData.primary_color ?? '#0071E3',
          logoUrl: rpcData.logo_url,
          logoFullUrl: rpcData.logo_full_url,
          active: rpcData.active
        }
      }
    } catch (e) {
      console.error('[organization.store] Error cargando org:', e)
      error.value = e instanceof Error ? e.message : 'Error desconocido'
      current.value = null
    } finally {
      loading.value = false
      loaded.value = true
    }
  }

  /**
   * Aplica el color primario al DOM como CSS variables.
   */
  function applyBrandingToDOM() {
    if (typeof document === 'undefined') return
    const color = primaryColor.value
    document.documentElement.style.setProperty('--tenant-primary', color)
    document.documentElement.style.setProperty('--tenant-primary-dark', darkenColor(color, 0.15))

    if (current.value && isTenant) {
      document.title = `LORA · ${displayName.value}`
    }
  }

  function darkenColor(hex: string, factor: number): string {
    const h = hex.replace('#', '')
    let r = parseInt(h.substring(0, 2), 16)
    let g = parseInt(h.substring(2, 4), 16)
    let b = parseInt(h.substring(4, 6), 16)

    r = Math.round(r * (1 - factor))
    g = Math.round(g * (1 - factor))
    b = Math.round(b * (1 - factor))

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  function clear() {
    current.value = null
    error.value = null
    loaded.value = false
  }

  return {
    // state
    current,
    loading,
    error,
    loaded,
    // getters
    subdomain,
    mode,
    isTenant,
    isSuperAdminMode,
    displayName,
    primaryColor,
    logoUrl,
    hasActiveOrg,
    // actions
    loadFromSubdomain,
    applyBrandingToDOM,
    clear
  }
})
