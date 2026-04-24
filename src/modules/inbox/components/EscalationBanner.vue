<!-- Ruta: /src/modules/inbox/components/EscalationBanner.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 9 · Banner rojo en la conversación cuando hay SLA breach
     u otra escalation activa.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed } from 'vue'
import { useEscalationsStore } from '@/stores/escalations.store'
import { useUiStore } from '@/stores/ui.store'
import { ESCALATION_TYPE_LABELS } from '@/types/supervisor.types'
import { timeAgo } from '@/utils/format'

interface Props {
  conversationId: string
}

const props = defineProps<Props>()

const store = useEscalationsStore()
const ui = useUiStore()

const escalations = computed(() => store.getForConversation(props.conversationId))

// Priorizar el SLA breach si hay varios
const primary = computed(() => {
  const slaB = escalations.value.find((e) => e.type === 'sla_breach')
  return slaB ?? escalations.value[0] ?? null
})

async function handleResolve() {
  if (!primary.value) return
  try {
    await store.resolveManually(primary.value.id)
    ui.showToast('success', 'Alerta resuelta')
  } catch {
    ui.showToast('error', 'Error al resolver alerta')
  }
}
</script>

<template>
  <div
    v-if="primary"
    class="px-4 py-2.5 flex items-center gap-3 text-sm"
    :class="{
      'bg-red-50 border-b border-red-200 text-red-900': primary.type === 'sla_breach',
      'bg-amber-50 border-b border-amber-200 text-amber-900': primary.type === 'takeover',
      'bg-blue-50 border-b border-blue-200 text-blue-900': primary.type === 'reassign'
    }"
  >
    <span class="text-lg flex-shrink-0">
      {{ ESCALATION_TYPE_LABELS[primary.type].emoji }}
    </span>

    <div class="flex-1 min-w-0">
      <div class="font-semibold text-xs">
        {{ ESCALATION_TYPE_LABELS[primary.type].label }}
      </div>
      <div class="text-xs mt-0.5 opacity-90">
        <template v-if="primary.type === 'sla_breach'">
          El agente no respondió dentro del SLA.
          <span v-if="primary.fromUserName">Asignado a {{ primary.fromUserName }}.</span>
          Detectado {{ timeAgo(primary.createdAt) }}.
        </template>
        <template v-else-if="primary.type === 'takeover'">
          {{ primary.toUserName ?? 'Un supervisor' }} tomó el control {{ timeAgo(primary.createdAt) }}.
        </template>
        <template v-else-if="primary.type === 'reassign'">
          Conversación reasignada
          <template v-if="primary.fromUserName && primary.toUserName">
            de {{ primary.fromUserName }} a {{ primary.toUserName }}
          </template>
          {{ timeAgo(primary.createdAt) }}.
        </template>
      </div>
    </div>

    <button
      class="px-2.5 py-1 text-xs font-medium rounded-md hover:bg-white/60 transition-colors flex-shrink-0"
      @click="handleResolve"
    >
      ✓ Marcar como visto
    </button>
  </div>
</template>
