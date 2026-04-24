<!-- Ruta: /src/modules/analytics/tabs/ComparativoTab.vue -->
<script setup lang="ts">
import type { AnalyticsSummary } from '@/types/analytics.types'
import { formatSeconds } from '@/types/analytics.types'

interface Props {
  summary: AnalyticsSummary
}

const props = defineProps<Props>()
void props // Vue auto-expone summary en template

function formatDeltaPercent(d: number): string {
  const sign = d >= 0 ? '+' : ''
  return `${sign}${d.toFixed(1)}%`
}
</script>

<template>
  <div class="space-y-4">
    <!-- Volumen -->
    <div class="card p-5">
      <h4 class="font-semibold text-slate-800 mb-3">📊 Volumen de conversaciones</h4>
      <div class="grid grid-cols-3 gap-4">
        <div>
          <div class="text-xs text-slate-500">Período actual</div>
          <div class="text-2xl font-bold text-slate-800 mt-1">{{ summary.total }}</div>
        </div>
        <div>
          <div class="text-xs text-slate-500">Período anterior</div>
          <div class="text-2xl font-bold text-slate-500 mt-1">{{ summary.previousTotal }}</div>
        </div>
        <div>
          <div class="text-xs text-slate-500">Cambio</div>
          <div
            class="text-2xl font-bold mt-1"
            :class="summary.totalDeltaPercent >= 0 ? 'text-emerald-600' : 'text-red-600'"
          >
            {{ formatDeltaPercent(summary.totalDeltaPercent) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Resueltas -->
    <div class="card p-5">
      <h4 class="font-semibold text-slate-800 mb-3">✅ Conversaciones resueltas</h4>
      <div class="grid grid-cols-3 gap-4">
        <div>
          <div class="text-xs text-slate-500">Período actual</div>
          <div class="text-2xl font-bold text-slate-800 mt-1">{{ summary.resolved }}</div>
        </div>
        <div>
          <div class="text-xs text-slate-500">Período anterior</div>
          <div class="text-2xl font-bold text-slate-500 mt-1">{{ summary.previousResolved }}</div>
        </div>
        <div>
          <div class="text-xs text-slate-500">Cambio</div>
          <div
            class="text-2xl font-bold mt-1"
            :class="summary.resolvedDeltaPercent >= 0 ? 'text-emerald-600' : 'text-red-600'"
          >
            {{ formatDeltaPercent(summary.resolvedDeltaPercent) }}
          </div>
        </div>
      </div>
    </div>

    <!-- FRT -->
    <div class="card p-5">
      <h4 class="font-semibold text-slate-800 mb-3">⚡ Tiempo de primera respuesta (FRT)</h4>
      <div class="grid grid-cols-3 gap-4">
        <div>
          <div class="text-xs text-slate-500">Período actual</div>
          <div class="text-2xl font-bold text-slate-800 mt-1">
            {{ formatSeconds(summary.avgFrtSeconds) }}
          </div>
        </div>
        <div>
          <div class="text-xs text-slate-500">Período anterior</div>
          <div class="text-2xl font-bold text-slate-500 mt-1">
            {{ formatSeconds(summary.previousAvgFrtSeconds) }}
          </div>
        </div>
        <div>
          <div class="text-xs text-slate-500">Cambio</div>
          <div
            v-if="summary.frtDeltaSeconds !== null"
            class="text-2xl font-bold mt-1"
            :class="summary.frtDeltaSeconds <= 0 ? 'text-emerald-600' : 'text-red-600'"
          >
            {{ summary.frtDeltaSeconds <= 0 ? '' : '+' }}{{ formatSeconds(Math.abs(summary.frtDeltaSeconds)) }}
          </div>
          <div v-else class="text-sm text-slate-400 mt-1">—</div>
        </div>
      </div>
      <p class="text-xs text-slate-400 mt-2 italic">Menos tiempo = mejor</p>
    </div>

    <!-- CSAT -->
    <div class="card p-5">
      <h4 class="font-semibold text-slate-800 mb-3">⭐ Satisfacción del cliente (CSAT)</h4>
      <div class="grid grid-cols-3 gap-4">
        <div>
          <div class="text-xs text-slate-500">Período actual</div>
          <div class="text-2xl font-bold text-slate-800 mt-1">
            {{ summary.avgCsat !== null ? `${summary.avgCsat.toFixed(1)} ★` : '—' }}
          </div>
        </div>
        <div>
          <div class="text-xs text-slate-500">Período anterior</div>
          <div class="text-2xl font-bold text-slate-500 mt-1">
            {{ summary.previousAvgCsat !== null ? `${summary.previousAvgCsat.toFixed(1)} ★` : '—' }}
          </div>
        </div>
        <div>
          <div class="text-xs text-slate-500">Cambio</div>
          <div
            v-if="summary.csatDelta !== null"
            class="text-2xl font-bold mt-1"
            :class="summary.csatDelta >= 0 ? 'text-emerald-600' : 'text-red-600'"
          >
            {{ summary.csatDelta >= 0 ? '+' : '' }}{{ summary.csatDelta.toFixed(2) }}
          </div>
          <div v-else class="text-sm text-slate-400 mt-1">—</div>
        </div>
      </div>
    </div>
  </div>
</template>
