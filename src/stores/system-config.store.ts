// Ruta: /src/stores/system-config.store.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 11.6 · Store global de configuración del sistema
//
// Estrategia de carga:
// - Al iniciar la app (main.ts / App.vue), se llama loadPublic()
// - Si el usuario es super_admin, también se llama loadAll()
// - Los valores se cachean. Se pueden refrescar manualmente.
// ═══════════════════════════════════════════════════════════════
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { SupabaseSystemConfigRepo } from '@/repository/supabase/system-config.repo'
import type { SystemConfigItem } from '@/types/system-config.types'

const repo = new SupabaseSystemConfigRepo()

export const useSystemConfigStore = defineStore('systemConfig', () => {
  // ── STATE ──────────────────────────────────────────────
  const publicConfig = ref<Record<string, any>>({})
  const allItems = ref<SystemConfigItem[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  // ── GETTERS ────────────────────────────────────────────
  const adminUrl      = computed<string>(() => publicConfig.value.admin_url      ?? 'https://admin.lorachat.net')
  const widgetUrl     = computed<string>(() => publicConfig.value.widget_url     ?? 'https://admin.lorachat.net/widget.js')
  const apiUrl        = computed<string>(() => publicConfig.value.api_url        ?? '')
  const brandName     = computed<string>(() => publicConfig.value.brand_name     ?? 'LORA Chat')
  const brandTagline  = computed<string>(() => publicConfig.value.brand_tagline  ?? '')
  const supportEmail  = computed<string>(() => publicConfig.value.support_email  ?? '')
  const supportUrl    = computed<string>(() => publicConfig.value.support_url    ?? '')
  const landingUrl    = computed<string>(() => publicConfig.value.landing_url    ?? '')

  // ── ACTIONS ────────────────────────────────────────────

  /**
   * Carga las configs públicas (todos los usuarios autenticados).
   * Es la carga mínima que necesita cualquier pantalla del admin.
   */
  async function loadPublic() {
    if (loading.value) return
    loading.value = true
    error.value = null
    try {
      publicConfig.value = await repo.getPublicConfig()
      loaded.value = true
    } catch (e: any) {
      error.value = e?.message ?? 'Error cargando configuración'
      console.error('[systemConfig.store] loadPublic:', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * Carga TODAS las configs (solo super_admin por RLS).
   * Usada en la vista de administración de configs.
   */
  async function loadAll() {
    loading.value = true
    error.value = null
    try {
      allItems.value = await repo.listAll()
      // Reconstruir también publicConfig a partir del listado
      const newPublic: Record<string, any> = {}
      for (const item of allItems.value) {
        if (item.isPublic) newPublic[item.key] = item.value
      }
      publicConfig.value = newPublic
      loaded.value = true
    } catch (e: any) {
      error.value = e?.message ?? 'Error cargando configuración completa'
      console.error('[systemConfig.store] loadAll:', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * Actualizar una config.
   */
  async function updateValue(key: string, value: any) {
    const updated = await repo.updateValue(key, value)
    // Actualizar cache local
    const idx = allItems.value.findIndex(i => i.key === key)
    if (idx >= 0) allItems.value[idx] = updated
    if (updated.isPublic) publicConfig.value[key] = updated.value
  }

  /**
   * Restaurar valor por defecto.
   */
  async function resetToDefault(key: string) {
    const updated = await repo.resetToDefault(key)
    const idx = allItems.value.findIndex(i => i.key === key)
    if (idx >= 0) allItems.value[idx] = updated
    if (updated.isPublic) publicConfig.value[key] = updated.value
  }

  /**
   * Obtener una config por key (desde cache).
   */
  function get(key: string): any {
    return publicConfig.value[key]
  }

  /**
   * Obtener un item completo (con metadata) por key.
   */
  function getItem(key: string): SystemConfigItem | undefined {
    return allItems.value.find(i => i.key === key)
  }

  /**
   * Agrupar items por categoría (para la UI del admin).
   */
  const groupedByCategory = computed(() => {
    const groups = new Map<string, SystemConfigItem[]>()
    for (const item of allItems.value) {
      if (!groups.has(item.category)) groups.set(item.category, [])
      groups.get(item.category)!.push(item)
    }
    return groups
  })

  return {
    // state
    publicConfig,
    allItems,
    loading,
    loaded,
    error,
    // computed shortcuts
    adminUrl,
    widgetUrl,
    apiUrl,
    brandName,
    brandTagline,
    supportEmail,
    supportUrl,
    landingUrl,
    groupedByCategory,
    // actions
    loadPublic,
    loadAll,
    updateValue,
    resetToDefault,
    get,
    getItem
  }
})
