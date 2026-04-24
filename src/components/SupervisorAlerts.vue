<!-- Ruta: /src/components/SupervisorAlerts.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 9 · Badge en header con contador de escalamientos activos.
     Click → dropdown con últimos 5-10 eventos + "Ver todos"
     Visible solo para usuarios con permiso 'escalations.read'.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCan } from '@/composables/useCan'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { useEscalationsStore } from '@/stores/escalations.store'
import { ESCALATION_TYPE_LABELS } from '@/types/supervisor.types'
import { timeAgo } from '@/utils/format'

const { can } = useCan()
const activeOrgId = useActiveOrganizationId()
const store = useEscalationsStore()
const router = useRouter()

const open = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const canSee = computed(() => can('escalations.read'))

// Cargar al montar + realtime
watch(
  activeOrgId,
  async (orgId) => {
    if (!orgId || !canSee.value) return
    await store.load(orgId)
    store.subscribe(orgId)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  store.clear()
})

// Top 8 escalamientos
const recent = computed(() => store.active.slice(0, 8))

function toggleDropdown(e: Event) {
  e.stopPropagation()
  open.value = !open.value
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

function goToConversation(conversationId: string) {
  open.value = false
  router.push({
    name: 'admin.inbox',
    query: { conversationId }
  })
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div v-if="canSee" ref="dropdownRef" class="relative inline-block">
    <!-- Badge -->
    <button
      class="relative flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
      :class="store.count > 0
        ? 'bg-red-50 text-red-700 hover:bg-red-100'
        : 'text-slate-500 hover:bg-slate-100'"
      :title="`${store.count} alerta${store.count === 1 ? '' : 's'} activa${store.count === 1 ? '' : 's'}`"
      @click="toggleDropdown"
    >
      <span class="text-base leading-none">🚨</span>
      <span v-if="store.count > 0" class="font-semibold">{{ store.count }}</span>
      <span v-else class="text-slate-400">0</span>
    </button>

    <!-- Dropdown -->
    <div
      v-if="open"
      class="absolute top-full right-0 mt-1 w-96 bg-white border border-surface-border rounded-xl shadow-card z-40 max-h-[420px] flex flex-col overflow-hidden"
    >
      <div class="p-3 border-b border-surface-border flex items-center justify-between">
        <h4 class="text-sm font-semibold">Alertas del equipo</h4>
        <span class="text-xs text-slate-400">{{ store.count }} activas</span>
      </div>

      <div v-if="store.loading" class="p-6 text-center text-slate-400 text-sm">
        Cargando alertas...
      </div>

      <div v-else-if="recent.length === 0" class="p-8 text-center">
        <div class="text-3xl mb-2">✅</div>
        <p class="text-slate-600 font-medium text-sm">Todo en orden</p>
        <p class="text-slate-400 text-xs mt-1">No hay alertas activas ahora mismo</p>
      </div>

      <div v-else class="flex-1 overflow-auto">
        <button
          v-for="esc in recent"
          :key="esc.id"
          class="w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-b border-surface-border last:border-0 hover:bg-slate-50 transition-colors"
          @click="goToConversation(esc.conversationId)"
        >
          <div class="flex-shrink-0 text-xl mt-0.5">
            {{ ESCALATION_TYPE_LABELS[esc.type].emoji }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span
                class="text-xs font-semibold"
                :style="{ color: ESCALATION_TYPE_LABELS[esc.type].color }"
              >
                {{ ESCALATION_TYPE_LABELS[esc.type].label }}
              </span>
              <span class="text-xs text-slate-400">· {{ timeAgo(esc.createdAt) }}</span>
            </div>
            <div class="text-sm text-slate-800 mt-0.5 truncate">
              {{ esc.contactName || 'Conversación sin nombre' }}
            </div>
            <div v-if="esc.type === 'sla_breach' && esc.fromUserName" class="text-xs text-slate-500 truncate">
              Agente: {{ esc.fromUserName }}
            </div>
            <div v-else-if="esc.type === 'takeover'" class="text-xs text-slate-500 truncate">
              {{ esc.fromUserName ?? 'alguien' }} → {{ esc.toUserName ?? 'supervisor' }}
            </div>
            <div v-else-if="esc.type === 'reassign'" class="text-xs text-slate-500 truncate">
              {{ esc.fromUserName ?? '—' }} → {{ esc.toUserName ?? '—' }}
            </div>
          </div>
        </button>
      </div>

      <div v-if="store.count > recent.length" class="px-3 py-2 border-t border-surface-border bg-slate-50">
        <span class="text-[10px] text-slate-500">
          Mostrando {{ recent.length }} de {{ store.count }}
        </span>
      </div>
    </div>
  </div>
</template>
