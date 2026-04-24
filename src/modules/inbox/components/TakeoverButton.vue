<!-- Ruta: /src/modules/inbox/components/TakeoverButton.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 9 · Botón de Takeover.
     Visible solo si:
       - El usuario tiene permiso 'conversations.takeover'
       - La conversación tiene un agent_id DISTINTO al usuario actual
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useCan } from '@/composables/useCan'
import { useUiStore } from '@/stores/ui.store'
import { SupabaseSupervisorRepo } from '@/repository/supabase/supervisor.repo'

interface Props {
  conversationId: string
  currentAgentId: string | null
  currentAgentName?: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'done'): void }>()

const auth = useAuthStore()
const { can } = useCan()
const ui = useUiStore()
const repo = new SupabaseSupervisorRepo()

const busy = ref(false)

const canTakeover = computed(() => can('conversations.takeover'))

// Solo visible si hay un agente Y no soy yo mismo (ya asignado a mí no tiene sentido)
const shouldShow = computed(() => {
  if (!canTakeover.value) return false
  if (!props.currentAgentId) return false
  // Nota: agent_id apunta a agents.id, no a users.id. La comparación es contra el agent_id.
  // Si el usuario actual está asignado a esta conv, currentAgentName será su nombre.
  // Si hace takeover sobre sí mismo no tiene sentido. Comparamos por nombre como heurística,
  // o mejor: si el auth.user.fullName coincide con currentAgentName, es él mismo.
  return props.currentAgentName !== auth.user?.fullName
})

async function handleTakeover() {
  if (!confirm(`¿Tomar el control de esta conversación?\n\nEl agente actual ("${props.currentAgentName ?? 'sin nombre'}") ya no podrá responder. Esta acción quedará registrada.`)) {
    return
  }

  busy.value = true
  try {
    await repo.takeover(props.conversationId)
    ui.showToast('success', 'Has tomado el control de la conversación')
    emit('done')
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error al tomar control')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    v-if="shouldShow"
    class="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50"
    :disabled="busy"
    :title="`Tomar control (está atendiendo ${currentAgentName ?? 'otro agente'})`"
    @click="handleTakeover"
  >
    {{ busy ? '...' : '🦸 Tomar control' }}
  </button>
</template>
