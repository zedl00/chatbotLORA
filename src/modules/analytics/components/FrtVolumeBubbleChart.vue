<!-- Ruta: /src/modules/analytics/components/FrtVolumeBubbleChart.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { AgentMetric } from '@/types/analytics.types'
import { initials } from '@/utils/format'

interface Props {
  agents: AgentMetric[]
}

const props = defineProps<Props>()

const W = 320
const H = 180
const PAD_L = 40, PAD_R = 20, PAD_T = 15, PAD_B = 30

const validAgents = computed(() =>
  props.agents.filter(a => a.avgFrtSeconds !== null && a.totalConversations > 0)
)

const maxVolume = computed(() => Math.max(1, ...validAgents.value.map(a => a.totalConversations)))
const maxFrt = computed(() => Math.max(60, ...validAgents.value.map(a => a.avgFrtSeconds!)))

function x(volume: number): number {
  return PAD_L + (volume / maxVolume.value) * (W - PAD_L - PAD_R)
}

function y(frt: number): number {
  // FRT invertido: mayor arriba = peor
  return H - PAD_B - (1 - frt / maxFrt.value) * (H - PAD_T - PAD_B) - 15
}

function bubbleRadius(csatRatings: number): number {
  return Math.max(4, Math.min(14, 4 + csatRatings * 0.6))
}

function bubbleColor(csat: number | null): string {
  if (csat == null) return '#94a3b8'
  if (csat >= 4.5) return '#10b981'  // verde
  if (csat >= 4.0) return '#3b82f6'  // azul
  if (csat >= 3.0) return '#f59e0b'  // ámbar
  return '#ef4444'                    // rojo
}

function formatFrt(s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  return `${Math.floor(s / 60)}m`
}
</script>

<template>
  <div class="w-full">
    <svg v-if="validAgents.length > 0" :viewBox="`0 0 ${W} ${H}`" class="w-full" style="height: 180px;">
      <!-- Ejes -->
      <line :x1="PAD_L" :y1="PAD_T" :x2="PAD_L" :y2="H - PAD_B" stroke="#e2e8f0" stroke-width="0.5" />
      <line :x1="PAD_L" :y1="H - PAD_B" :x2="W - PAD_R" :y2="H - PAD_B" stroke="#e2e8f0" stroke-width="0.5" />

      <!-- Bubbles -->
      <g v-for="agent in validAgents" :key="agent.agentId">
        <circle
          :cx="x(agent.totalConversations)"
          :cy="y(agent.avgFrtSeconds!)"
          :r="bubbleRadius(agent.csatRatingsCount)"
          :fill="bubbleColor(agent.avgCsat)"
          fill-opacity="0.4"
          :stroke="bubbleColor(agent.avgCsat)"
          stroke-width="1.5"
        />
        <text
          :x="x(agent.totalConversations)"
          :y="y(agent.avgFrtSeconds!) + 1"
          text-anchor="middle"
          font-size="8"
          font-weight="600"
          :fill="bubbleColor(agent.avgCsat)"
        >
          {{ initials(agent.agentName) }}
        </text>
      </g>

      <!-- Labels de ejes -->
      <text :x="PAD_L - 6" :y="PAD_T + 4" text-anchor="end" font-size="8" fill="#94a3b8">{{ formatFrt(maxFrt) }}</text>
      <text :x="PAD_L - 6" :y="H - PAD_B" text-anchor="end" font-size="8" fill="#94a3b8">0s</text>
      <text :x="W / 2" :y="H - 6" text-anchor="middle" font-size="9" fill="#64748b">Volumen conversaciones →</text>
      <text :x="10" :y="H / 2" text-anchor="middle" font-size="9" fill="#64748b" :transform="`rotate(-90 10 ${H / 2})`">← FRT promedio</text>
    </svg>

    <div v-else class="text-xs text-slate-400 italic text-center py-8">
      Sin datos de agentes con FRT
    </div>

    <div v-if="validAgents.length > 0" class="text-[10px] text-slate-500 mt-1.5 flex items-center gap-3 justify-center">
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:#10b981" /> CSAT ≥ 4.5</span>
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:#3b82f6" /> 4.0-4.5</span>
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:#f59e0b" /> 3.0-4.0</span>
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:#ef4444" /> &lt; 3.0</span>
    </div>
    <p class="text-[10px] text-slate-400 mt-1 text-center italic">Tamaño de burbuja = # de ratings CSAT</p>
  </div>
</template>
