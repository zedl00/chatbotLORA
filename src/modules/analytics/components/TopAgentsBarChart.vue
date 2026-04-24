<!-- Ruta: /src/modules/analytics/components/TopAgentsBarChart.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { AgentMetric } from '@/types/analytics.types'
import { initials } from '@/utils/format'

interface Props {
  agents: AgentMetric[]
  limit?: number
}

const props = withDefaults(defineProps<Props>(), { limit: 5 })

const top = computed(() => props.agents.slice(0, props.limit))
const maxResolved = computed(() => Math.max(1, ...top.value.map(a => a.resolvedCount)))
</script>

<template>
  <div class="space-y-2">
    <div v-if="top.length === 0" class="text-slate-400 text-xs text-center py-6 italic">
      Sin actividad de agentes en este período
    </div>
    <div
      v-for="agent in top"
      :key="agent.agentId"
      class="flex items-center gap-2.5 text-xs"
    >
      <div class="w-6 h-6 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-[10px] font-semibold flex-shrink-0">
        {{ initials(agent.agentName) }}
      </div>
      <span class="w-24 truncate text-slate-700 font-medium">{{ agent.agentName }}</span>
      <div class="flex-1 h-5 bg-slate-100 rounded overflow-hidden relative">
        <div
          class="h-full bg-brand-400 transition-all"
          :style="{ width: `${(agent.resolvedCount / maxResolved) * 100}%` }"
        />
      </div>
      <span class="w-8 text-right text-slate-700 font-semibold">{{ agent.resolvedCount }}</span>
    </div>
  </div>
</template>
