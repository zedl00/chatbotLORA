<!-- Ruta: /src/modules/analytics/components/MetricCard.vue -->
<script setup lang="ts">
interface Props {
  label: string
  value: string | number
  delta?: number | null        // delta numérico (puede ser %)
  deltaUnit?: 'percent' | 'absolute' | 'seconds'
  deltaInverted?: boolean      // true si "menos es mejor" (ej: FRT)
  subtitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  delta: null,
  deltaUnit: 'percent',
  deltaInverted: false,
  subtitle: ''
})

// usar props en template evita TS6133
void props

function formatDelta(d: number, unit: string): string {
  const sign = d >= 0 ? '+' : ''
  if (unit === 'percent') return `${sign}${d.toFixed(0)}%`
  if (unit === 'seconds') {
    const abs = Math.abs(d)
    if (abs < 60) return `${sign}${d.toFixed(0)}s`
    return `${sign}${(d / 60).toFixed(1)}m`
  }
  return `${sign}${d.toFixed(1)}`
}

function isPositive(d: number, inverted: boolean): boolean {
  return inverted ? d < 0 : d > 0
}
</script>

<template>
  <div class="bg-surface-muted rounded-xl p-3">
    <div class="text-xs text-slate-500">{{ label }}</div>
    <div class="text-2xl font-semibold text-slate-800 mt-0.5">{{ value }}</div>
    <div class="text-xs mt-1 flex items-center gap-1">
      <span
        v-if="delta !== null && delta !== undefined && !isNaN(delta)"
        :class="isPositive(delta, deltaInverted) ? 'text-emerald-600' : (delta === 0 ? 'text-slate-400' : 'text-red-500')"
        class="font-medium"
      >
        {{ formatDelta(delta, deltaUnit) }}
      </span>
      <span v-if="subtitle" class="text-slate-400">{{ subtitle }}</span>
    </div>
  </div>
</template>
