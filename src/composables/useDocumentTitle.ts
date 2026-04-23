// Ruta: /src/composables/useDocumentTitle.ts
import { watch } from 'vue'
import { useRoute } from 'vue-router'

/**
 * Actualiza el título del documento (lo que se ve en la pestaña del navegador)
 * según la ruta actual.
 *
 * Formato: "LORA · {título de la vista}"
 * Ejemplos:
 *   - /admin/inbox      → "LORA · Bandeja"
 *   - /admin/playground → "LORA · Playground"
 *   - /admin/dashboard  → "LORA · Dashboard"
 *
 * El título de cada vista se define en router/index.ts como `meta.title`.
 * Si la ruta no tiene título, se usa solo "LORA".
 */
export function useDocumentTitle() {
  const route = useRoute()

  watch(
    () => route.meta.title,
    (title) => {
      if (title && typeof title === 'string') {
        document.title = `LORA · ${title}`
      } else {
        document.title = 'LORA'
      }
    },
    { immediate: true }
  )
}
