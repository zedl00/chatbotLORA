<!-- Ruta: /src/modules/analytics/components/HourlyHeatmap.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { HeatmapCell } from '@/types/analytics.types'

interface Props {
  cells: HeatmapCell[]
}

const props = defineProps<Props>()

const maxCount = computed(() => Math.max(1, ...props.cells.map(c => c.count)))

// Reordenamos: lunes primero (1), domingo al final (0)
const DAYS = [1, 2, 3, 4, 5, 6, 0]
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const grid = computed(() => {
  return DAYS.map(day => ({
    day,
    hours: Array.from({ length: 24 }, (_, hour) => {
      const cell = props.cells.find(c => c.dayOfWeek === day && c.hourOfDay === hour)
      return cell ?? { dayOfWeek: day, hourOfDay: hour, count: 0 }
    })
  }))
})

function colorFor(count: number): string {
  if (count === 0) return '#f1f5f9'  // slate-100
  const intensity = count / maxCount.value
  if (intensity < 0.2) return '#ddd6fe'  // purple-200
  if (intensity < 0.4) return '#c4b5fd'  // purple-300
  if (intensity < 0.6) return '#a78bfa'  // purple-400
  if (intensity < 0.8) return '#8b5cf6'  // purple-500
  return '#6d28d9'  // purple-700
}

const hourLabels = [0, 6, 12, 18, 23]
</script>

<template>
  <div class="w-full">
    <!-- Grid -->
    <div class="space-y-1">
      <div v-for="(row, idx) in grid" :key="row.day" class="flex items-center gap-1">
        <span class="text-[10px] text-slate-500 w-7 flex-shrink-0">{{ DAY_LABELS[idx] }}</span>
        <div class="flex gap-0.5 flex-1">
          <div
            v-for="cell in row.hours"
            :key="cell.hourOfDay"
            class="flex-1 aspect-square rounded-sm cursor-default transition-transform hover:scale-125"
            :style="{ backgroundColor: colorFor(cell.count) }"
            :title="`${DAY_LABELS[idx]} ${cell.hourOfDay}:00 — ${cell.count} conversaciones`"
          />
        </div>
      </div>
    </div>

    <!-- Eje X: horas -->
    <div class="flex gap-1 mt-1.5">
      <span class="w-7 flex-shrink-0"></span>
      <div class="flex-1 relative" style="height: 12px;">
        <span
          v-for="h in hourLabels"
          :key="h"
          class="absolute text-[9px] text-slate-400"
          :style="{ left: `${(h / 23) * 100}%`, transform: 'translateX(-50%)' }"
        >
          {{ h }}h
        </span>
      </div>
    </div>

    <!-- Leyenda -->
    <div class="flex items-center gap-2 mt-3 text-[10px] text-slate-500 justify-center">
      <span>Menos</span>
      <div class="flex gap-0.5">
        <div class="w-3 h-3 rounded-sm" style="background:#f1f5f9" />
        <div class="w-3 h-3 rounded-sm" style="background:#ddd6fe" />
        <div class="w-3 h-3 rounded-sm" style="background:#c4b5fd" />
        <div class="w-3 h-3 rounded-sm" style="background:#a78bfa" />
        <div class="w-3 h-3 rounded-sm" style="background:#8b5cf6" />
        <div class="w-3 h-3 rounded-sm" style="background:#6d28d9" />
      </div>
      <span>Más</span>
    </div>
  </div>
</template>
