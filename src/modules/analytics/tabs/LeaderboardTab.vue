<!-- Ruta: /src/modules/analytics/tabs/LeaderboardTab.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { AgentMetric } from '@/types/analytics.types'
import { formatSeconds } from '@/types/analytics.types'
import { initials } from '@/utils/format'

interface Props {
  agents: AgentMetric[]
}

const props = defineProps<Props>()

const ranked = computed(() =>
  [...props.agents].sort((a, b) => {
    // Score compuesto: resueltas + (CSAT × 5) - (FRT / 60)
    const scoreA = a.resolvedCount + (a.avgCsat ?? 0) * 5 - (a.avgFrtSeconds ?? 0) / 60
    const scoreB = b.resolvedCount + (b.avgCsat ?? 0) * 5 - (b.avgFrtSeconds ?? 0) / 60
    return scoreB - scoreA
  })
)

function medalFor(rank: number): string {
  if (rank === 0) return '🥇'
  if (rank === 1) return '🥈'
  if (rank === 2) return '🥉'
  return ''
}

function rankBgFor(rank: number): string {
  if (rank === 0) return 'bg-amber-50 border-amber-200'
  if (rank === 1) return 'bg-slate-50 border-slate-200'
  if (rank === 2) return 'bg-orange-50 border-orange-200'
  return 'border-surface-border'
}
</script>

<template>
  <div>
    <div v-if="ranked.length === 0" class="text-center text-slate-400 text-sm py-12 italic">
      Sin agentes con actividad en este período.
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="(agent, i) in ranked"
        :key="agent.agentId"
        class="flex items-center gap-3 p-3 rounded-xl border transition-colors hover:bg-slate-50"
        :class="rankBgFor(i)"
      >
        <div class="w-10 flex-shrink-0 text-center">
          <span v-if="i < 3" class="text-2xl">{{ medalFor(i) }}</span>
          <span v-else class="text-sm font-semibold text-slate-400">#{{ i + 1 }}</span>
        </div>

        <div class="w-10 h-10 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm font-semibold flex-shrink-0">
          {{ initials(agent.agentName) }}
        </div>

        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-slate-800 truncate">{{ agent.agentName }}</div>
          <div class="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            <span><strong class="text-slate-700">{{ agent.resolvedCount }}</strong> resueltas</span>
            <span v-if="agent.avgFrtSeconds !== null">
              FRT <strong class="text-slate-700">{{ formatSeconds(agent.avgFrtSeconds) }}</strong>
            </span>
            <span v-if="agent.avgCsat !== null">
              CSAT <strong class="text-slate-700">{{ agent.avgCsat.toFixed(1) }} ★</strong>
              <span class="text-slate-400">({{ agent.csatRatingsCount }})</span>
            </span>
            <span v-if="agent.totalConversations > 0">
              {{ ((agent.resolvedCount / agent.totalConversations) * 100).toFixed(0) }}% resolución
            </span>
          </div>
        </div>

        <div class="hidden sm:flex flex-col items-end text-xs flex-shrink-0">
          <div class="text-slate-400">Volumen</div>
          <div class="font-semibold text-slate-700">{{ agent.totalConversations }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
