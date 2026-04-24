<!-- Ruta: /src/modules/analytics/components/AgentRadarChart.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { AgentMetric } from '@/types/analytics.types'

interface Props {
  agent: AgentMetric | null
  allAgents: AgentMetric[]
}

const props = defineProps<Props>()

// Normalizar métricas de 0 a 100 respecto a los max del equipo
const profile = computed(() => {
  if (!props.agent || props.allAgents.length === 0) return null

  const maxVolume = Math.max(1, ...props.allAgents.map(a => a.totalConversations))
  const maxResolved = Math.max(1, ...props.allAgents.map(a => a.resolvedCount))
  const allFrts = props.allAgents.filter(a => a.avgFrtSeconds != null).map(a => a.avgFrtSeconds!)
  const minFrt = allFrts.length > 0 ? Math.min(...allFrts) : 60
  const maxFrt = allFrts.length > 0 ? Math.max(...allFrts) : 600

  const a = props.agent
  // Speed: invertido (menor FRT = mayor speed)
  let speed = 50
  if (a.avgFrtSeconds != null && maxFrt > minFrt) {
    speed = 100 - ((a.avgFrtSeconds - minFrt) / (maxFrt - minFrt)) * 100
  }

  return {
    volume:     (a.totalConversations / maxVolume) * 100,
    resolution: (a.resolvedCount / maxResolved) * 100,
    quality:    (a.avgCsat ?? 0) * 20,  // CSAT 1-5 → 20-100
    speed:      Math.max(0, Math.min(100, speed)),
    consistency: a.csatRatingsCount > 0 ? Math.min(100, (a.csatRatingsCount / 10) * 100) : 0
  }
})

// 5 ejes a 72° (360/5)
const AXES = [
  { key: 'volume',      label: 'Volumen',    angle: -Math.PI / 2 },                          // arriba
  { key: 'resolution',  label: 'Resueltas',  angle: -Math.PI / 2 + (2 * Math.PI) / 5 },
  { key: 'quality',     label: 'CSAT',       angle: -Math.PI / 2 + (4 * Math.PI) / 5 },
  { key: 'speed',       label: 'Velocidad',  angle: -Math.PI / 2 + (6 * Math.PI) / 5 },
  { key: 'consistency', label: 'Consistencia', angle: -Math.PI / 2 + (8 * Math.PI) / 5 }
]

const CX = 90, CY = 90, R = 65

function point(angle: number, radiusFraction: number): { x: number; y: number } {
  return {
    x: CX + R * radiusFraction * Math.cos(angle),
    y: CY + R * radiusFraction * Math.sin(angle)
  }
}

const gridCircles = [0.25, 0.5, 0.75, 1]

const polygonPoints = computed(() => {
  if (!profile.value) return ''
  return AXES.map(ax => {
    const value = (profile.value as any)[ax.key] / 100
    const p = point(ax.angle, value)
    return `${p.x},${p.y}`
  }).join(' ')
})

const labelPoints = computed(() =>
  AXES.map(ax => {
    const p = point(ax.angle, 1.18)
    return { ...ax, x: p.x, y: p.y }
  })
)
</script>

<template>
  <div class="flex flex-col items-center">
    <div v-if="!profile" class="text-xs text-slate-400 italic py-10">
      Selecciona un agente para ver su perfil
    </div>

    <svg v-else viewBox="0 0 180 180" class="w-full" style="max-width: 200px;">
      <!-- Grid concéntrico -->
      <polygon
        v-for="(frac, i) in gridCircles"
        :key="'grid' + i"
        :points="AXES.map(ax => { const p = point(ax.angle, frac); return `${p.x},${p.y}` }).join(' ')"
        fill="none"
        stroke="#e2e8f0"
        stroke-width="0.5"
      />

      <!-- Ejes radiales -->
      <line
        v-for="(ax, i) in AXES"
        :key="'axis' + i"
        :x1="CX" :y1="CY"
        :x2="point(ax.angle, 1).x" :y2="point(ax.angle, 1).y"
        stroke="#e2e8f0" stroke-width="0.5"
      />

      <!-- Polígono del agente -->
      <polygon
        :points="polygonPoints"
        fill="#378ADD"
        fill-opacity="0.25"
        stroke="#378ADD"
        stroke-width="1.5"
      />

      <!-- Labels -->
      <text
        v-for="l in labelPoints"
        :key="l.key"
        :x="l.x"
        :y="l.y"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="9"
        fill="#64748b"
      >
        {{ l.label }}
      </text>
    </svg>

    <div v-if="agent" class="text-xs font-semibold text-slate-700 mt-2">{{ agent.agentName }}</div>
  </div>
</template>
