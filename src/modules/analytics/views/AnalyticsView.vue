<!-- Ruta: /src/modules/analytics/views/AnalyticsView.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 10 · Vista principal del dashboard de analytics
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { useUiStore } from '@/stores/ui.store'
import { SupabaseAnalyticsRepo } from '@/repository/supabase/analytics.repo'
import type {
  AnalyticsFilters,
  AnalyticsSummary,
  ConversationAnalytics,
  DailyVolumePoint,
  AgentMetric,
  HeatmapCell
} from '@/types/analytics.types'
import { computeDateRange, formatSeconds } from '@/types/analytics.types'
import DateRangePicker from '../components/DateRangePicker.vue'
import MetricCard from '../components/MetricCard.vue'
import VolumeLineChart from '../components/VolumeLineChart.vue'
import StatusDonutChart from '../components/StatusDonutChart.vue'
import TopAgentsBarChart from '../components/TopAgentsBarChart.vue'
import HourlyHeatmap from '../components/HourlyHeatmap.vue'
import AgentRadarChart from '../components/AgentRadarChart.vue'
import FrtVolumeBubbleChart from '../components/FrtVolumeBubbleChart.vue'
import ExportCsvButton from '../components/ExportCsvButton.vue'
import LeaderboardTab from '../tabs/LeaderboardTab.vue'
import ComparativoTab from '../tabs/ComparativoTab.vue'

const activeOrgId = useActiveOrganizationId()
const ui = useUiStore()
const repo = new SupabaseAnalyticsRepo()

// ── State ──
const loading = ref(false)
const currentConversations = ref<ConversationAnalytics[]>([])
const previousConversations = ref<ConversationAnalytics[]>([])
const summary = ref<AnalyticsSummary | null>(null)
const dailyVolume = ref<DailyVolumePoint[]>([])
const agentMetrics = ref<AgentMetric[]>([])
const heatmapCells = ref<HeatmapCell[]>([])

const agentsForFilter = ref<{ agentId: string; name: string }[]>([])
const teamsForFilter = ref<{ teamId: string; name: string }[]>([])

// ── Filtros ──
const filters = ref<AnalyticsFilters>({
  range: computeDateRange('last_7_days'),
  agentId: null,
  channelType: null,
  status: null,
  priority: null,
  teamId: null
})

const activeTab = ref<'dashboard' | 'leaderboard' | 'heatmap' | 'comparativo'>('dashboard')

// Radar: agente seleccionado (default: top 1)
const selectedAgentIdForRadar = ref<string | null>(null)

const selectedAgentForRadar = computed(() => {
  if (!selectedAgentIdForRadar.value) return agentMetrics.value[0] ?? null
  return agentMetrics.value.find(a => a.agentId === selectedAgentIdForRadar.value) ?? null
})

const filterLabel = computed(() => {
  const parts: string[] = []
  if (filters.value.agentId) {
    const agent = agentsForFilter.value.find(a => a.agentId === filters.value.agentId)
    if (agent) parts.push(agent.name)
  }
  if (filters.value.channelType) parts.push(filters.value.channelType)
  if (filters.value.status) parts.push(filters.value.status)
  return parts.length > 0 ? parts.join(', ') : 'Todos'
})

// ── Carga ──
async function loadAnalytics() {
  if (!activeOrgId.value) return
  loading.value = true
  try {
    const { current, previous } = await repo.fetchConversations(activeOrgId.value, filters.value)
    currentConversations.value = current
    previousConversations.value = previous

    summary.value = repo.computeSummary(current, previous)
    dailyVolume.value = repo.computeDailyVolume(
      current, previous, filters.value.range.start, filters.value.range.end
    )
    agentMetrics.value = repo.computeAgentMetrics(current)
    heatmapCells.value = repo.computeHeatmap(current)

    // Default radar agent: el top
    if (!selectedAgentIdForRadar.value && agentMetrics.value.length > 0) {
      selectedAgentIdForRadar.value = agentMetrics.value[0].agentId
    }
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error cargando analytics')
    console.error('[AnalyticsView] Error:', e)
  } finally {
    loading.value = false
  }
}

async function loadFilters() {
  if (!activeOrgId.value) return
  try {
    const [agents, teams] = await Promise.all([
      repo.listAgentsForFilter(activeOrgId.value),
      repo.listTeamsForFilter(activeOrgId.value)
    ])
    agentsForFilter.value = agents
    teamsForFilter.value = teams
  } catch (e) {
    console.error('[AnalyticsView] Error cargando filtros:', e)
  }
}

// ── Watchers ──
watch(filters, loadAnalytics, { deep: true })
watch(activeOrgId, () => {
  loadFilters()
  loadAnalytics()
}, { immediate: false })

onMounted(async () => {
  await loadFilters()
  await loadAnalytics()
})

// Helpers para los selects
const CHANNEL_OPTIONS = [
  { value: null, label: 'Todos los canales' },
  { value: 'web_widget', label: '🌐 Web Widget' },
  { value: 'whatsapp',   label: '📱 WhatsApp' },
  { value: 'telegram',   label: '✈️ Telegram' },
  { value: 'instagram',  label: '📷 Instagram' },
  { value: 'messenger',  label: '💬 Messenger' },
  { value: 'email',      label: '✉️ Email' }
]

const STATUS_OPTIONS = [
  { value: null, label: 'Todos los estados' },
  { value: 'open', label: 'Abiertas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'resolved', label: 'Resueltas' },
  { value: 'abandoned', label: 'Abandonadas' }
]

const PRIORITY_OPTIONS = [
  { value: null, label: 'Todas las prioridades' },
  { value: 0, label: 'Sin prioridad' },
  { value: 1, label: '🟢 Baja' },
  { value: 2, label: '🟡 Media' },
  { value: 3, label: '🔴 Alta' }
]
</script>

<template>
  <div class="p-6 max-w-[1400px] mx-auto">
    <!-- Header -->
    <div class="flex items-start justify-between mb-4 flex-wrap gap-3">
      <div>
        <h2 class="text-2xl font-bold">📊 Analytics</h2>
        <p class="text-sm text-slate-500 mt-1">Métricas del equipo de atención</p>
      </div>
      <ExportCsvButton
        :conversations="currentConversations"
        :agents="agentMetrics"
        :filter-label="filterLabel"
      />
    </div>

    <!-- Filtros -->
    <div class="bg-white border border-surface-border rounded-xl p-3 mb-4 flex flex-wrap gap-2 items-center">
      <DateRangePicker v-model="filters.range" />

      <select
        v-model="filters.agentId"
        class="text-sm px-2.5 py-1.5 border border-surface-border rounded-lg bg-white"
      >
        <option :value="null">👤 Todo el equipo</option>
        <option v-for="a in agentsForFilter" :key="a.agentId" :value="a.agentId">{{ a.name }}</option>
      </select>

      <select
        v-model="filters.channelType"
        class="text-sm px-2.5 py-1.5 border border-surface-border rounded-lg bg-white"
      >
        <option v-for="opt in CHANNEL_OPTIONS" :key="opt.value || 'all'" :value="opt.value">{{ opt.label }}</option>
      </select>

      <select
        v-model="filters.status"
        class="text-sm px-2.5 py-1.5 border border-surface-border rounded-lg bg-white"
      >
        <option v-for="opt in STATUS_OPTIONS" :key="opt.value || 'all'" :value="opt.value">{{ opt.label }}</option>
      </select>

      <select
        v-model="filters.priority"
        class="text-sm px-2.5 py-1.5 border border-surface-border rounded-lg bg-white"
      >
        <option v-for="opt in PRIORITY_OPTIONS" :key="opt.value ?? 'all'" :value="opt.value">{{ opt.label }}</option>
      </select>

      <select
        v-if="teamsForFilter.length > 0"
        v-model="filters.teamId"
        class="text-sm px-2.5 py-1.5 border border-surface-border rounded-lg bg-white"
      >
        <option :value="null">👥 Todos los equipos</option>
        <option v-for="t in teamsForFilter" :key="t.teamId" :value="t.teamId">{{ t.name }}</option>
      </select>
    </div>

    <!-- Timeline comparativo banner -->
    <div
      v-if="summary"
      class="px-4 py-2.5 rounded-xl mb-4 text-sm flex flex-wrap items-center gap-x-4 gap-y-1"
      :class="summary.totalDeltaPercent >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'"
    >
      <span class="text-base">📈</span>
      <span class="font-medium">Este período vs anterior:</span>
      <span class="flex items-center gap-1">
        <span :class="summary.totalDeltaPercent >= 0 ? 'text-emerald-700' : 'text-red-700'" class="font-semibold">
          {{ summary.totalDeltaPercent >= 0 ? '+' : '' }}{{ summary.totalDeltaPercent.toFixed(1) }}%
        </span>
        volumen
      </span>
      <span v-if="summary.frtDeltaSeconds !== null" class="flex items-center gap-1">
        <span :class="summary.frtDeltaSeconds <= 0 ? 'text-emerald-700' : 'text-red-700'" class="font-semibold">
          {{ summary.frtDeltaSeconds <= 0 ? '' : '+' }}{{ formatSeconds(Math.abs(summary.frtDeltaSeconds)) }}
        </span>
        FRT
      </span>
      <span v-if="summary.csatDelta !== null" class="flex items-center gap-1">
        <span :class="summary.csatDelta >= 0 ? 'text-emerald-700' : 'text-red-700'" class="font-semibold">
          {{ summary.csatDelta >= 0 ? '+' : '' }}{{ summary.csatDelta.toFixed(2) }}
        </span>
        CSAT
      </span>
    </div>

    <!-- Metric cards -->
    <div v-if="summary" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-4">
      <MetricCard
        label="Resueltas"
        :value="summary.resolved"
        :delta="summary.resolvedDeltaPercent"
        delta-unit="percent"
      />
      <MetricCard
        label="FRT promedio"
        :value="formatSeconds(summary.avgFrtSeconds)"
        :delta="summary.frtDeltaSeconds"
        delta-unit="seconds"
        :delta-inverted="true"
      />
      <MetricCard
        label="CSAT"
        :value="summary.avgCsat !== null ? `${summary.avgCsat.toFixed(1)} ★` : '—'"
        :delta="summary.csatDelta"
        delta-unit="absolute"
        :subtitle="`${summary.csatRatingsCount} ratings`"
      />
      <MetricCard
        label="Volumen total"
        :value="summary.total"
        :delta="summary.totalDeltaPercent"
        delta-unit="percent"
      />
      <MetricCard
        label="IA %"
        :value="`${summary.handoffRate.toFixed(0)}%`"
        :subtitle="'handoff rate'"
      />
    </div>

    <!-- Tabs -->
    <div class="border-b border-surface-border mb-4 flex gap-1">
      <button
        v-for="tab in [
          { id: 'dashboard',   label: '📊 Dashboard' },
          { id: 'leaderboard', label: '🏆 Leaderboard' },
          { id: 'heatmap',     label: '🔥 Horarios' },
          { id: 'comparativo', label: '🎯 Comparativo' }
        ]"
        :key="tab.id"
        class="px-4 py-2 text-sm transition-colors border-b-2"
        :class="activeTab === tab.id
          ? 'border-brand-500 text-brand-700 font-medium'
          : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="activeTab = tab.id as any"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Content tabs -->
    <div v-if="loading" class="card p-12 text-center text-slate-400 text-sm">
      Cargando analytics...
    </div>

    <div v-else-if="!summary || summary.total === 0" class="card p-12 text-center">
      <div class="text-5xl mb-2">📭</div>
      <h3 class="font-semibold text-slate-700">Sin datos en este período</h3>
      <p class="text-sm text-slate-500 mt-1">
        Prueba cambiar el rango de fechas o los filtros.
      </p>
    </div>

    <template v-else>
      <!-- TAB: Dashboard -->
      <div v-if="activeTab === 'dashboard'" class="space-y-3">
        <!-- Fila 1: Línea grande + Dona -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div class="card p-4 lg:col-span-2">
            <div class="font-semibold text-sm mb-2">📈 Volumen diario</div>
            <VolumeLineChart :data="dailyVolume" />
          </div>
          <div class="card p-4">
            <div class="font-semibold text-sm mb-2">🍩 Por estado</div>
            <StatusDonutChart
              :open="summary.open"
              :pending="summary.pending"
              :resolved="summary.resolved"
              :abandoned="summary.abandoned"
            />
          </div>
        </div>

        <!-- Fila 2: Barras + Radar -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div class="card p-4">
            <div class="font-semibold text-sm mb-2">📊 Top 5 agentes</div>
            <TopAgentsBarChart :agents="agentMetrics" :limit="5" />
          </div>
          <div class="card p-4">
            <div class="flex items-center justify-between mb-2">
              <div class="font-semibold text-sm">🎯 Perfil del agente</div>
              <select
                v-model="selectedAgentIdForRadar"
                class="text-xs px-2 py-1 border border-surface-border rounded-md bg-white"
              >
                <option v-for="a in agentMetrics" :key="a.agentId" :value="a.agentId">
                  {{ a.agentName }}
                </option>
              </select>
            </div>
            <AgentRadarChart :agent="selectedAgentForRadar" :all-agents="agentMetrics" />
          </div>
        </div>

        <!-- Fila 3: Heatmap + Bubble -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div class="card p-4">
            <div class="font-semibold text-sm mb-2">🔥 Horarios de mayor carga</div>
            <HourlyHeatmap :cells="heatmapCells" />
          </div>
          <div class="card p-4">
            <div class="font-semibold text-sm mb-2">🫧 FRT vs volumen por agente</div>
            <FrtVolumeBubbleChart :agents="agentMetrics" />
          </div>
        </div>

        <!-- Preview leaderboard -->
        <div class="card p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="font-semibold text-sm">🏆 Leaderboard (preview)</div>
            <button
              class="text-xs text-brand-600 hover:text-brand-700"
              @click="activeTab = 'leaderboard'"
            >
              Ver completo →
            </button>
          </div>
          <LeaderboardTab :agents="agentMetrics.slice(0, 3)" />
        </div>
      </div>

      <!-- TAB: Leaderboard -->
      <div v-else-if="activeTab === 'leaderboard'">
        <div class="card p-4">
          <LeaderboardTab :agents="agentMetrics" />
        </div>
      </div>

      <!-- TAB: Horarios -->
      <div v-else-if="activeTab === 'heatmap'">
        <div class="card p-6">
          <div class="font-semibold mb-1">🔥 Heatmap de actividad</div>
          <p class="text-xs text-slate-500 mb-4">Cantidad de conversaciones creadas por día de la semana y hora del día.</p>
          <HourlyHeatmap :cells="heatmapCells" />
        </div>
      </div>

      <!-- TAB: Comparativo -->
      <div v-else-if="activeTab === 'comparativo'">
        <ComparativoTab :summary="summary" />
      </div>
    </template>
  </div>
</template>
