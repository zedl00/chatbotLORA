<!-- Ruta: /src/modules/analytics/components/StatusDonutChart.vue -->
<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  open: number
  pending: number
  resolved: number
  abandoned: number
}

const props = defineProps<Props>()

const total = computed(() => props.open + props.pending + props.resolved + props.abandoned)

const CIRC = 2 * Math.PI * 45  // circunferencia para r=45

const segments = computed(() => {
  if (total.value === 0) return []
  const items = [
    { label: 'Resueltas',   value: props.resolved,  color: '#10b981', lightBg: '#d1fae5' },
    { label: 'Abiertas',    value: props.open,      color: '#3b82f6', lightBg: '#dbeafe' },
    { label: 'Pendientes',  value: props.pending,   color: '#f59e0b', lightBg: '#fef3c7' },
    { label: 'Abandonadas', value: props.abandoned, color: '#94a3b8', lightBg: '#e2e8f0' }
  ]
  let offset = 0
  return items.map(item => {
    const pct = item.value / total.value
    const dashLen = pct * CIRC
    const seg = {
      ...item,
      pct,
      dashArray: `${dashLen} ${CIRC - dashLen}`,
      dashOffset: -offset
    }
    offset += dashLen
    return seg
  })
})
</script>

<template>
  <div class="flex items-center gap-4">
    <svg viewBox="0 0 110 110" class="flex-shrink-0" style="width: 110px; height: 110px;">
      <!-- Base circle -->
      <circle cx="55" cy="55" r="45" fill="none" stroke="#f1f5f9" stroke-width="14" />
      <!-- Segments -->
      <circle
        v-for="(s, i) in segments"
        :key="i"
        cx="55" cy="55" r="45"
        fill="none"
        :stroke="s.color"
        stroke-width="14"
        :stroke-dasharray="s.dashArray"
        :stroke-dashoffset="s.dashOffset"
        transform="rotate(-90 55 55)"
        stroke-linecap="butt"
      />
      <!-- Center total -->
      <text x="55" y="52" text-anchor="middle" font-size="20" font-weight="600" fill="#1e293b">{{ total }}</text>
      <text x="55" y="68" text-anchor="middle" font-size="9" fill="#94a3b8">total</text>
    </svg>

    <div class="flex-1 space-y-1.5 text-xs">
      <div v-for="(s, i) in segments" :key="i" class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0" :style="{ backgroundColor: s.color }" />
        <span class="text-slate-700 flex-1 truncate">{{ s.label }}</span>
        <span class="text-slate-500 font-medium">{{ s.value }}</span>
        <span class="text-slate-400 text-[10px] w-8 text-right">{{ (s.pct * 100).toFixed(0) }}%</span>
      </div>
      <div v-if="total === 0" class="text-slate-400 text-xs italic text-center py-2">
        Sin datos
      </div>
    </div>
  </div>
</template>
