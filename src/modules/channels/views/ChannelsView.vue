<!-- Ruta: /src/modules/channels/views/ChannelsView.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 11.5 · Vista principal de canales con métricas, CRUD completo,
     wizard de creación, y help panel.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { useUiStore } from '@/stores/ui.store'
import { useCan } from '@/composables/useCan'
import { SupabaseChannelsRepo } from '@/repository/supabase/channels.repo'
import type { ChannelMetrics, ChannelType } from '@/types/channel.types'
import ChannelCard from '../components/ChannelCard.vue'
import CreateChannelModal from '../components/CreateChannelModal.vue'
import EmptyChannelsState from '../components/EmptyChannelsState.vue'
import ChannelsHelpPanel from '../components/help/ChannelsHelpPanel.vue'

const activeOrgId = useActiveOrganizationId()
const ui = useUiStore()
const { can } = useCan()
const repo = new SupabaseChannelsRepo()

const channels = ref<ChannelMetrics[]>([])
const loading = ref(false)
const createModalOpen = ref(false)
const helpOpen = ref(false)

// Filtros
const typeFilter = ref<ChannelType | 'all'>('all')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')

const canCreate = computed(() => can('channels.create') || can('channels.configure'))
const canDelete = computed(() => can('channels.delete'))

// ── Load ──
async function load() {
  if (!activeOrgId.value) return
  loading.value = true
  try {
    channels.value = await repo.listWithMetrics(activeOrgId.value)
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error cargando canales')
  } finally {
    loading.value = false
  }
}

// ── Actions ──
async function handleRename(channel: ChannelMetrics) {
  const newName = prompt('Nuevo nombre:', channel.name)
  if (!newName || newName === channel.name) return
  try {
    await repo.rename(channel.channelId, newName.trim())
    ui.showToast('success', 'Canal renombrado')
    await load()
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error al renombrar')
  }
}

async function handleDuplicate(id: string) {
  try {
    const copy = await repo.duplicate(id)
    ui.showToast('success', `Canal duplicado: "${copy.name}"`)
    await load()
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error al duplicar')
  }
}

async function handleToggle(id: string, active: boolean) {
  try {
    await repo.setActive(id, active)
    ui.showToast('success', active ? 'Canal activado' : 'Canal desactivado')
    await load()
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error al cambiar estado')
  }
}

async function handleDelete(channel: ChannelMetrics) {
  if (!canDelete.value) {
    ui.showToast('error', 'No tienes permiso para eliminar canales')
    return
  }
  if (!confirm(`¿Eliminar el canal "${channel.name}"?\n\nEsta acción es permanente.`)) return
  try {
    const result = await repo.deleteChannel(channel.channelId)
    if (!result.deleted) {
      ui.showToast('warning', result.reason ?? 'No se pudo eliminar')
      return
    }
    ui.showToast('success', 'Canal eliminado')
    await load()
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error al eliminar')
  }
}

// ── Filters ──
const filteredChannels = computed(() => {
  return channels.value.filter(c => {
    if (typeFilter.value !== 'all' && c.type !== typeFilter.value) return false
    if (statusFilter.value === 'active' && !c.active) return false
    if (statusFilter.value === 'inactive' && c.active) return false
    return true
  })
})

// Unique types para tabs
const availableTypes = computed(() => {
  const set = new Set(channels.value.map(c => c.type))
  return Array.from(set)
})

// Stats
const stats = computed(() => ({
  total: channels.value.length,
  active: channels.value.filter(c => c.active).length,
  inactive: channels.value.filter(c => !c.active).length,
  totalConversations: channels.value.reduce((s, c) => s + c.totalConversations, 0)
}))

onMounted(load)
</script>

<template>
  <div class="p-6 max-w-[1200px] mx-auto">
    <!-- Header -->
    <div class="flex items-start justify-between flex-wrap gap-3 mb-5">
      <div>
        <h2 class="text-2xl font-bold">Canales</h2>
        <p class="text-sm text-slate-500 mt-1">
          Gestiona las vías por donde recibes conversaciones
        </p>
      </div>
      <div class="flex gap-2 items-center">
        <button
          class="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
          @click="helpOpen = true"
        >
          💡 Guía
        </button>
        <button
          v-if="canCreate"
          class="btn-primary flex items-center gap-2"
          @click="createModalOpen = true"
        >
          + Crear canal
        </button>
      </div>
    </div>

    <!-- Stats resumen -->
    <div v-if="!loading && channels.length > 0" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div class="bg-surface-muted rounded-xl p-3">
        <div class="text-xs text-slate-500">Canales totales</div>
        <div class="text-2xl font-semibold text-slate-800 mt-0.5">{{ stats.total }}</div>
      </div>
      <div class="bg-surface-muted rounded-xl p-3">
        <div class="text-xs text-slate-500">Activos</div>
        <div class="text-2xl font-semibold text-emerald-700 mt-0.5">{{ stats.active }}</div>
      </div>
      <div class="bg-surface-muted rounded-xl p-3">
        <div class="text-xs text-slate-500">Inactivos</div>
        <div class="text-2xl font-semibold text-slate-500 mt-0.5">{{ stats.inactive }}</div>
      </div>
      <div class="bg-surface-muted rounded-xl p-3">
        <div class="text-xs text-slate-500">Conversaciones</div>
        <div class="text-2xl font-semibold text-slate-800 mt-0.5">{{ stats.totalConversations }}</div>
      </div>
    </div>

    <!-- Filtros -->
    <div
      v-if="!loading && channels.length > 0"
      class="flex items-center gap-2 mb-4 flex-wrap"
    >
      <div class="flex gap-1 p-1 bg-slate-100 rounded-lg">
        <button
          class="px-3 py-1 text-xs rounded-md transition-colors"
          :class="statusFilter === 'all'
            ? 'bg-white text-slate-800 font-medium shadow-sm'
            : 'text-slate-500 hover:text-slate-800'"
          @click="statusFilter = 'all'"
        >
          Todos ({{ stats.total }})
        </button>
        <button
          class="px-3 py-1 text-xs rounded-md transition-colors"
          :class="statusFilter === 'active'
            ? 'bg-white text-slate-800 font-medium shadow-sm'
            : 'text-slate-500 hover:text-slate-800'"
          @click="statusFilter = 'active'"
        >
          Activos ({{ stats.active }})
        </button>
        <button
          v-if="stats.inactive > 0"
          class="px-3 py-1 text-xs rounded-md transition-colors"
          :class="statusFilter === 'inactive'
            ? 'bg-white text-slate-800 font-medium shadow-sm'
            : 'text-slate-500 hover:text-slate-800'"
          @click="statusFilter = 'inactive'"
        >
          Inactivos ({{ stats.inactive }})
        </button>
      </div>

      <select
        v-if="availableTypes.length > 1"
        v-model="typeFilter"
        class="text-sm px-3 py-1.5 border border-surface-border rounded-lg bg-white"
      >
        <option value="all">Todos los tipos</option>
        <option v-for="t in availableTypes" :key="t" :value="t">{{ t }}</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-16 text-slate-400">
      Cargando canales...
    </div>

    <!-- Empty state -->
    <EmptyChannelsState
      v-else-if="channels.length === 0"
      @create="createModalOpen = true"
    />

    <!-- Lista de canales -->
    <div
      v-else
      class="grid grid-cols-1 lg:grid-cols-2 gap-4"
    >
      <ChannelCard
        v-for="channel in filteredChannels"
        :key="channel.channelId"
        :channel="channel"
        @refresh="load"
        @duplicate="handleDuplicate"
        @rename="handleRename"
        @toggle="handleToggle"
        @delete="handleDelete"
      />
    </div>

    <!-- Empty después de filtro -->
    <div
      v-if="!loading && channels.length > 0 && filteredChannels.length === 0"
      class="text-center py-12 text-slate-400"
    >
      <div class="text-4xl mb-2">🔍</div>
      <p class="text-sm">No hay canales con esos filtros</p>
      <button
        class="text-xs text-brand-600 mt-2 hover:underline"
        @click="() => { statusFilter = 'all'; typeFilter = 'all' }"
      >
        Limpiar filtros
      </button>
    </div>

    <!-- Create modal -->
    <CreateChannelModal
      v-model="createModalOpen"
      @created="load"
    />

    <!-- Help panel -->
    <ChannelsHelpPanel v-model="helpOpen" />
  </div>
</template>
