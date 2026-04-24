<!-- Ruta: /src/components/AgentStatusBadge.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Badge de estado del agente logueado con dropdown para cambiar.
     Usado en el header del AdminLayout.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useAgentStore } from '@/stores/agent.store'
import { useUiStore } from '@/stores/ui.store'
import { AGENT_STATUS_LABELS, type AgentStatus } from '@/types/agent.types'

const auth = useAuthStore()
const agentStore = useAgentStore()
const ui = useUiStore()

const showDropdown = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const current = computed(() => {
  const s = agentStore.status
  return AGENT_STATUS_LABELS[s]
})

const statuses: { key: AgentStatus; label: string; description: string }[] = [
  { key: 'online',  label: 'En línea',       description: 'Disponible para atender' },
  { key: 'busy',    label: 'Ocupado',        description: 'No recibir nuevas asignaciones' },
  { key: 'away',    label: 'Ausente',        description: 'No estoy activo ahora' },
  { key: 'offline', label: 'Desconectado',   description: 'Marcar como offline' }
]

async function changeStatus(newStatus: AgentStatus) {
  if (!auth.user?.id) return
  try {
    await agentStore.setStatus(auth.user.id, newStatus)
    ui.showToast('success', `Estado cambiado a ${AGENT_STATUS_LABELS[newStatus].label.toLowerCase()}`)
  } catch {
    ui.showToast('error', 'No se pudo cambiar el estado')
  } finally {
    showDropdown.value = false
  }
}

function toggleDropdown(e: Event) {
  e.stopPropagation()
  showDropdown.value = !showDropdown.value
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="dropdownRef" class="relative inline-block">
    <!-- Badge actual -->
    <button
      class="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium hover:bg-slate-100 transition-colors"
      :title="current.label"
      @click="toggleDropdown"
    >
      <span
        class="w-2 h-2 rounded-full flex-shrink-0"
        :style="{ backgroundColor: current.color }"
      />
      <span class="text-slate-700">{{ current.label }}</span>
      <span class="text-slate-400 text-[10px]">▼</span>
    </button>

    <!-- Dropdown -->
    <div
      v-if="showDropdown"
      class="absolute top-full right-0 mt-1 w-60 bg-white border border-surface-border rounded-xl shadow-card z-40 overflow-hidden"
    >
      <div class="p-2 space-y-0.5">
        <button
          v-for="opt in statuses"
          :key="opt.key"
          class="w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-slate-50 transition-colors"
          :class="{ 'bg-brand-50': agentStore.status === opt.key }"
          @click="changeStatus(opt.key)"
        >
          <span
            class="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
            :style="{ backgroundColor: AGENT_STATUS_LABELS[opt.key].color }"
          />
          <div class="flex-1 min-w-0">
            <div
              class="text-sm font-medium"
              :class="agentStore.status === opt.key ? 'text-brand-700' : 'text-slate-800'"
            >
              {{ opt.label }}
            </div>
            <div class="text-xs text-slate-500">{{ opt.description }}</div>
          </div>
          <span
            v-if="agentStore.status === opt.key"
            class="text-brand-600 text-sm flex-shrink-0"
          >
            ✓
          </span>
        </button>
      </div>

      <div class="px-4 py-2 border-t border-surface-border bg-slate-50 text-[10px] text-slate-400">
        El estado se actualiza automáticamente con tu actividad
      </div>
    </div>
  </div>
</template>
