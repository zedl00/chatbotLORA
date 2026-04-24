<!-- Ruta: /src/modules/inbox/components/ReassignDropdown.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 9 · Dropdown para reasignar conversación.
     Visible solo con permiso 'conversations.reassign'.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { useCan } from '@/composables/useCan'
import { useUiStore } from '@/stores/ui.store'
import { SupabaseSupervisorRepo } from '@/repository/supabase/supervisor.repo'
import { SupabaseAgentRepo } from '@/repository/supabase/agent.repo'
import type { AgentLive } from '@/types/agent.types'
import { AGENT_STATUS_LABELS } from '@/types/agent.types'
import { initials } from '@/utils/format'

interface Props {
  conversationId: string
  currentAgentId: string | null  // agents.id
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'done'): void }>()

const activeOrgId = useActiveOrganizationId()
const { can } = useCan()
const ui = useUiStore()
const supervisorRepo = new SupabaseSupervisorRepo()
const agentRepo = new SupabaseAgentRepo()

const open = ref(false)
const busy = ref(false)
const agents = ref<AgentLive[]>([])
const loadingAgents = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const canReassign = computed(() => can('conversations.reassign'))

const availableAgents = computed(() =>
  agents.value
    .filter((a) => a.agentId !== props.currentAgentId)
    .sort((a, b) => {
      // Online primero, luego busy, luego away, luego offline
      const order = { online: 0, busy: 1, away: 2, offline: 3 }
      return order[a.status] - order[b.status]
    })
)

async function loadAgents() {
  if (!activeOrgId.value) return
  loadingAgents.value = true
  try {
    agents.value = await agentRepo.listAgentsLive(activeOrgId.value)
  } catch (e) {
    console.error('[ReassignDropdown] Error cargando agentes:', e)
  } finally {
    loadingAgents.value = false
  }
}

async function toggleOpen(e: Event) {
  e.stopPropagation()
  if (!open.value && agents.value.length === 0) {
    await loadAgents()
  }
  open.value = !open.value
}

async function handleReassign(agentId: string, name: string) {
  if (!confirm(`¿Reasignar esta conversación a ${name}?`)) return

  busy.value = true
  try {
    await supervisorRepo.reassign(props.conversationId, agentId)
    ui.showToast('success', `Conversación reasignada a ${name}`)
    open.value = false
    emit('done')
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error al reasignar')
  } finally {
    busy.value = false
  }
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    open.value = false
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
  <div v-if="canReassign" ref="dropdownRef" class="relative inline-block">
    <button
      class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-1"
      :disabled="busy"
      @click="toggleOpen"
    >
      🔄 Reasignar <span class="text-slate-400 text-[10px]">▾</span>
    </button>

    <div
      v-if="open"
      class="absolute top-full right-0 mt-1 w-64 bg-white border border-surface-border rounded-xl shadow-card z-30 max-h-80 overflow-auto"
    >
      <div v-if="loadingAgents" class="p-4 text-center text-xs text-slate-400">
        Cargando agentes...
      </div>

      <div v-else-if="availableAgents.length === 0" class="p-4 text-center text-xs text-slate-400">
        No hay otros agentes disponibles
      </div>

      <div v-else>
        <div class="px-3 py-2 border-b border-surface-border text-[11px] text-slate-500 uppercase tracking-wide font-medium bg-slate-50">
          Reasignar a...
        </div>
        <button
          v-for="agent in availableAgents"
          :key="agent.agentId"
          class="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 transition-colors border-b border-surface-border last:border-0"
          :disabled="busy"
          @click="handleReassign(agent.agentId, agent.fullName ?? agent.email)"
        >
          <div class="relative flex-shrink-0">
            <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xs font-semibold">
              {{ initials(agent.fullName ?? agent.email) }}
            </div>
            <span
              class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
              :style="{ backgroundColor: AGENT_STATUS_LABELS[agent.status].color }"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-slate-800 truncate">
              {{ agent.fullName || agent.email }}
            </div>
            <div class="text-[11px] text-slate-500">
              {{ AGENT_STATUS_LABELS[agent.status].label }}
              <span v-if="agent.atCapacity" class="text-red-500 ml-1">· al tope</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
