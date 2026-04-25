// Ruta: /src/composables/useSystemConfig.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 11.6 · Composable para acceder a la config del sistema
//
// Uso típico en componentes:
//   const { widgetUrl, brandName, supportEmail } = useSystemConfig()
//
//   <template>
//     <a :href="supportUrl">Soporte</a>
//     <code>{{ widgetUrl }}</code>
//   </template>
//
// Siempre devuelve valores (con defaults) aunque no esté cargado aún.
// ═══════════════════════════════════════════════════════════════
import { useSystemConfigStore } from '@/stores/system-config.store'

export function useSystemConfig() {
  const store = useSystemConfigStore()

  return {
    // URLs
    adminUrl:     store.adminUrl,
    widgetUrl:    store.widgetUrl,
    apiUrl:       store.apiUrl,
    supportUrl:   store.supportUrl,
    landingUrl:   store.landingUrl,
    // Branding
    brandName:    store.brandName,
    brandTagline: store.brandTagline,
    supportEmail: store.supportEmail,
    // State
    loading:      store.loading,
    loaded:       store.loaded,
    // Helpers
    get:          store.get,
    reload:       store.loadPublic
  }
}
