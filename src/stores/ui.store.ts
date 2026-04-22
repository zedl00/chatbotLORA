// Ruta: /src/stores/ui.store.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false)
  const toasts = ref<Toast[]>([])

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function showToast(type: Toast['type'], message: string, duration = 3500) {
    const id = crypto.randomUUID()
    toasts.value.push({ id, type, message, duration })
    setTimeout(() => dismissToast(id), duration)
  }

  function dismissToast(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    sidebarCollapsed,
    toasts,
    toggleSidebar,
    showToast,
    dismissToast
  }
})
