<!-- Ruta: /src/modules/analytics/components/ExportCsvButton.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { ConversationAnalytics, AgentMetric } from '@/types/analytics.types'
import { formatSeconds } from '@/types/analytics.types'

interface Props {
  conversations: ConversationAnalytics[]
  agents: AgentMetric[]
  filterLabel: string
}

const props = defineProps<Props>()

function csvEscape(val: any): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(csvEscape).join(','))
  ].join('\n')

  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function exportConversations() {
  const today = new Date().toISOString().slice(0, 10)
  downloadCsv(
    `lora_conversations_${today}.csv`,
    [
      'ID', 'Estado', 'Canal', 'Prioridad', 'Agente', 'Contact ID',
      'Creado', 'Handoff', 'Primera respuesta', 'Resuelto',
      'FRT (seg)', 'Resolución (seg)', 'CSAT', 'Tokens IA'
    ],
    props.conversations.map(c => [
      c.id,
      c.status,
      c.channelType,
      c.priority,
      c.agentName ?? '',
      c.contactId ?? '',
      c.createdAt,
      c.handoffAt ?? '',
      c.firstResponseAt ?? '',
      c.resolvedAt ?? '',
      c.frtSeconds ?? '',
      c.resolutionSeconds ?? '',
      c.csatScore ?? '',
      c.aiTokensUsed
    ])
  )
}

function exportAgents() {
  const today = new Date().toISOString().slice(0, 10)
  downloadCsv(
    `lora_agentes_${today}.csv`,
    [
      'Agente', 'Email', 'Total conversaciones', 'Resueltas', 'Abandonadas',
      'Abiertas', 'FRT promedio', 'Tiempo resolución',
      'CSAT promedio', 'Ratings CSAT', 'Última actividad'
    ],
    props.agents.map(a => [
      a.agentName,
      a.agentEmail,
      a.totalConversations,
      a.resolvedCount,
      a.abandonedCount,
      a.openCount,
      formatSeconds(a.avgFrtSeconds),
      formatSeconds(a.avgResolutionSeconds),
      a.avgCsat !== null ? a.avgCsat.toFixed(2) : '',
      a.csatRatingsCount,
      a.lastActivityAt ?? ''
    ])
  )
}

const disabled = computed(() => props.conversations.length === 0 && props.agents.length === 0)
</script>

<template>
  <div class="relative group">
    <button
      class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
      :disabled="disabled"
    >
      📥 Exportar CSV
      <span class="text-[10px] text-slate-400">▾</span>
    </button>

    <div class="absolute top-full right-0 mt-1 w-52 bg-white border border-surface-border rounded-xl shadow-card z-20 hidden group-hover:block">
      <button
        class="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-surface-border"
        @click="exportConversations"
      >
        <div class="font-medium text-slate-700">📋 Conversaciones</div>
        <div class="text-[10px] text-slate-500">{{ conversations.length }} filas · {{ filterLabel }}</div>
      </button>
      <button
        class="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
        @click="exportAgents"
      >
        <div class="font-medium text-slate-700">👥 Métricas por agente</div>
        <div class="text-[10px] text-slate-500">{{ agents.length }} agentes</div>
      </button>
    </div>
  </div>
</template>
