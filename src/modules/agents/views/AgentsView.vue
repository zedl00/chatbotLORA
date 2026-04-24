<!-- Ruta: /src/modules/agents/views/AgentsView.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 8 · Entrega 3
     Vista del equipo de agentes con estado en vivo.
     Features:
       - Lista de agentes con avatar + estado + equipo
       - Indicador de conversaciones activas y capacidad
       - Filtros: todos / online / busy / away / offline
       - Recarga automática cada 30 segundos
       - Suscripción realtime a cambios de status
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { useUiStore } from '@/stores/ui.store'
import { SupabaseAgentRepo } from '@/repository/supabase/agent.repo'
import type { AgentLive, AgentStatus } from '@/types/agent.types'
import { AGENT_STATUS_LABELS } from '@/types/agent.types'
import { initials, timeAgo } from '@/utils/format'

const activeOrgId = useActiveOrganizationId()
const ui = useUiStore()
const repo = new SupabaseAgentRepo()

const agents = ref<AgentLive[]>([])
const loading = ref(false)
const filter = ref<'all' | AgentStatus>('all')

let refreshTimer: ReturnType<typeof setInterval> | null = null
let unsubscribeRealtime: (() => void) | null = null

async function load() {
  if (!activeOrgId.value) return
  loading.value = true
  try {
    agents.value = await repo.listAgentsLive(activeOrgId.value)
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error cargando agentes')
  } finally {
    loading.value = false
  }
}

function setupRealtime() {
  if (unsubscribeRealtime) unsubscribeRealtime()
  if (!activeOrgId.value) return

  unsubscribeRealtime = repo.subscribeToAgentStatus(
    activeOrgId.value,
    (updated) => {
      // Actualizar en la lista el agente modificado
      const idx = agents.value.findIndex((a) => a.agentId === updated.id)
      if (idx >= 0) {
        agents.value[idx] = {
          ...agents.value[idx],
          status: updated.status,
          statusMessage: updated.status_message,
          statusChangedAt: updated.status_changed_at,
          lastActivityAt: updated.last_activity_at
        }
      } else {
        // Agente no estaba en la lista: recargar todo
        load()
      }
    }
  )
}

onMounted(() => {
  load()
  setupRealtime()
  // Recarga cada 30s para mantener counts de conversaciones activas actualizados
  refreshTimer = setInterval(load, 30_000)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (unsubscribeRealtime) unsubscribeRealtime()
})

// ─── Filtros y stats ─────
const statusCounts = computed(() => {
  const counts: Record<AgentStatus, number> = {
    online: 0, busy: 0, away: 0, offline: 0
  }
  for (const a of agents.value) {
    counts[a.status]++
  }
  return counts
})

const filteredAgents = computed(() => {
  if (filter.value === 'all') return agents.value
  return agents.value.filter((a) => a.status === filter.value)
})

const statusFilters: { key: 'all' | AgentStatus; label: string; color: string }[] = [
  { key: 'all',     label: 'Todos',         color: '#64748b' },
  { key: 'online',  label: 'En línea',      color: '#10b981' },
  { key: 'busy',    label: 'Ocupados',      color: '#f59e0b' },
  { key: 'away',    label: 'Ausentes',      color: '#94a3b8' },
  { key: 'offline', label: 'Desconectados', color: '#64748b' }
]

function countForFilter(key: 'all' | AgentStatus): number {
  if (key === 'all') return agents.value.length
  return statusCounts.value[key]
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-2xl font-bold">Equipo</h2>
        <p class="text-slate-500 text-sm mt-1">
          {{ agents.length }} miembros ·
          <span class="text-emerald-600">{{ statusCounts.online }} en línea</span>
          · <span class="text-amber-600">{{ statusCounts.busy }} ocupados</span>
        </p>
      </div>
    </div>

    <!-- Tabs de filtro -->
    <div class="card p-2 flex gap-1 overflow-x-auto">
      <button
        v-for="f in statusFilters"
        :key="f.key"
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
        :class="filter === f.key ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'"
        @click="filter = f.key"
      >
        <span
          v-if="f.key !== 'all'"
          class="w-2 h-2 rounded-full"
          :style="{ backgroundColor: f.color }"
        />
        <span>{{ f.label }}</span>
        <span
          class="text-xs px-1.5 py-0.5 rounded"
          :class="filter === f.key ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'"
        >
          {{ countForFilter(f.key) }}
        </span>
      </button>
    </div>

    <!-- Grid de agentes -->
    <div v-if="loading && agents.length === 0" class="card p-8 text-center text-slate-400 text-sm">
      Cargando agentes...
    </div>

    <div v-else-if="filteredAgents.length === 0" class="card p-12 text-center">
      <div class="text-5xl mb-3">👥</div>
      <p class="text-slate-600 font-medium">
        {{ filter === 'all' ? 'No hay agentes' : `No hay agentes ${statusFilters.find(f => f.key === filter)?.label.toLowerCase()}` }}
      </p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="agent in filteredAgents"
        :key="agent.agentId"
        class="card p-4 hover:shadow-md transition-shadow"
      >
        <!-- Avatar + nombre + estado -->
        <div class="flex items-start gap-3">
          <div class="relative flex-shrink-0">
            <div
              class="w-12 h-12 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-semibold"
            >
              <img
                v-if="agent.avatarUrl"
                :src="agent.avatarUrl"
                class="w-full h-full rounded-full object-cover"
              />
              <span v-else>{{ initials(agent.fullName ?? agent.email) }}</span>
            </div>
            <!-- Dot de estado -->
            <span
              class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white"
              :style="{ backgroundColor: AGENT_STATUS_LABELS[agent.status].color }"
              :title="AGENT_STATUS_LABELS[agent.status].label"
            />
          </div>

          <div class="flex-1 min-w-0">
            <div class="font-medium text-slate-800 truncate">
              {{ agent.fullName || agent.email }}
            </div>
            <div class="text-xs text-slate-500 truncate">
              {{ agent.email }}
            </div>
            <div class="text-xs mt-1 flex items-center gap-1.5">
              <span
                class="inline-flex items-center gap-1 font-medium"
                :style="{ color: AGENT_STATUS_LABELS[agent.status].color }"
              >
                {{ AGENT_STATUS_LABELS[agent.status].label }}
              </span>
              <span class="text-slate-400">·</span>
              <span class="text-slate-500">{{ timeAgo(agent.lastActivityAt) }}</span>
            </div>
          </div>
        </div>

        <!-- Status message (si existe) -->
        <div v-if="agent.statusMessage" class="mt-3 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 italic">
          "{{ agent.statusMessage }}"
        </div>

        <!-- Stats -->
        <div class="mt-3 pt-3 border-t border-surface-border grid grid-cols-2 gap-2 text-xs">
          <div>
            <div class="text-slate-500">Conversaciones</div>
            <div class="font-semibold text-slate-800">
              {{ agent.activeConversations }} / {{ agent.maxConcurrentChats }}
              <span
                v-if="agent.atCapacity"
                class="ml-1 text-[10px] text-red-500 font-normal"
                title="Al máximo de capacidad"
              >
                · TOPE
              </span>
            </div>
          </div>
          <div>
            <div class="text-slate-500">Equipo</div>
            <div class="font-medium truncate">
              <span v-if="agent.teamName" :style="{ color: agent.teamColor ?? '#64748b' }">
                {{ agent.teamName }}
              </span>
              <span v-else class="text-slate-300">Sin equipo</span>
            </div>
          </div>
        </div>

        <!-- Skills (si las tiene) -->
        <div v-if="agent.skills && agent.skills.length > 0" class="mt-3 flex flex-wrap gap-1">
          <span
            v-for="skill in agent.skills.slice(0, 3)"
            :key="skill"
            class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
          >
            {{ skill }}
          </span>
          <span
            v-if="agent.skills.length > 3"
            class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px]"
          >
            +{{ agent.skills.length - 3 }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
