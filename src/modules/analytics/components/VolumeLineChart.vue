<!-- Ruta: /src/modules/analytics/components/VolumeLineChart.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { DailyVolumePoint } from '@/types/analytics.types'

interface Props {
  data: DailyVolumePoint[]
}

const props = defineProps<Props>()

const W = 600
const H = 180
const PAD_L = 32, PAD_R = 12, PAD_T = 12, PAD_B = 30

const maxVal = computed(() => {
  const vals = props.data.flatMap(d => [d.current, d.previous])
  return Math.max(1, ...vals)
})

function x(i: number): number {
  if (props.data.length <= 1) return PAD_L
  return PAD_L + (i / (props.data.length - 1)) * (W - PAD_L - PAD_R)
}

function y(v: number): number {
  return H - PAD_B - (v / maxVal.value) * (H - PAD_T - PAD_B)
}

const currentPath = computed(() =>
  props.data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.current)}`).join(' ')
)

const previousPath = computed(() =>
  props.data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.previous)}`).join(' ')
)

const areaPath = computed(() =>
  props.data.length > 0
    ? `${currentPath.value} L${x(props.data.length - 1)},${H - PAD_B} L${x(0)},${H - PAD_B} Z`
    : ''
)

// Labels de eje X (mostrar cada ~5 puntos)
const xLabels = computed(() => {
  if (props.data.length === 0) return []
  const step = Math.max(1, Math.floor(props.data.length / 6))
  return props.data
    .map((d, i) => ({ label: formatDateLabel(d.date), x: x(i), show: i % step === 0 || i === props.data.length - 1 }))
    .filter(l => l.show)
})

function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <div class="w-full">
    <svg :viewBox="`0 0 ${W} ${H}`" class="w-full" style="height: 180px;" preserveAspectRatio="none">
      <!-- Grid horizontal -->
      <line :x1="PAD_L" :y1="PAD_T" :x2="PAD_L" :y2="H - PAD_B" stroke="#e2e8f0" stroke-width="0.5" />
      <line :x1="PAD_L" :y1="H - PAD_B" :x2="W - PAD_R" :y2="H - PAD_B" stroke="#e2e8f0" stroke-width="0.5" />

      <!-- Eje Y: labels simples -->
      <text :x="PAD_L - 6" :y="PAD_T + 4" text-anchor="end" font-size="9" fill="#94a3b8">{{ maxVal }}</text>
      <text :x="PAD_L - 6" :y="(H - PAD_B)" text-anchor="end" font-size="9" fill="#94a3b8">0</text>

      <!-- Período anterior (línea punteada gris) -->
      <path v-if="data.length > 1" :d="previousPath" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,3" />

      <!-- Área actual -->
      <path v-if="data.length > 1" :d="areaPath" fill="#378ADD" fill-opacity="0.08" />

      <!-- Línea actual -->
      <path v-if="data.length > 1" :d="currentPath" fill="none" stroke="#378ADD" stroke-width="2" />

      <!-- Puntos -->
      <g v-for="(d, i) in data" :key="i">
        <circle :cx="x(i)" :cy="y(d.current)" r="3" fill="#378ADD" />
      </g>

      <!-- Labels X -->
      <g v-for="(l, i) in xLabels" :key="'x' + i">
        <text :x="l.x" :y="H - 10" text-anchor="middle" font-size="9" fill="#94a3b8">{{ l.label }}</text>
      </g>
    </svg>

    <div class="flex gap-4 text-[10px] text-slate-500 mt-1 justify-end pr-3">
      <span class="flex items-center gap-1">
        <span class="inline-block w-3 h-0.5 bg-blue-500" />
        actual
      </span>
      <span class="flex items-center gap-1">
        <span class="inline-block w-3 h-0.5 border-t border-dashed border-slate-400" style="border-top-style: dashed;" />
        período anterior
      </span>
    </div>
  </div>
</template>
