<!-- Ruta: /src/modules/inbox/components/ConversationList.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { InboxConversation, InboxFilters } from '@/types/inbox.types'
import { CHANNEL_ICONS } from '@/types/inbox.types'
import { URGENCY_LABELS } from '@/types/ai.types'
import { formatRelativeTime, initials } from '@/utils/format'

const props = defineProps<{
  conversations: InboxConversation[]
  selectedId: string | null
  loading: boolean
  filters: InboxFilters
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'filter-change', filters: Partial<InboxFilters>): void
}>()

const total = computed(() => props.conversations.length)
const unreadTotal = computed(() => props.conversations.filter((c) => c.unreadCount > 0).length)
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header con título y filtros -->
    <div class="p-4 border-b border-surface-border">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-bold">Bandeja</h2>
        <div class="text-xs text-slate-500">
          {{ total }} · {{ unreadTotal }} sin leer
        </div>
      </div>

      <!-- Búsqueda -->
      <input
        type="text"
        :value="filters.search ?? ''"
        placeholder="🔍 Buscar por nombre o mensaje..."
        class="w-full px-3 py-2 text-sm border border-surface-border rounded-lg focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 mb-3"
        @input="(e) => emit('filter-change', { search: (e.target as HTMLInputElement).value || undefined })"
      />

      <!-- Chips de filtros -->
      <div class="flex flex-wrap gap-1">
        <button
          v-for="opt in [
            { value: 'all', label: 'Todas' },
            { value: 'me', label: 'Mías' },
            { value: 'unassigned', label: 'Sin asignar' }
          ]"
          :key="opt.value"
          class="text-xs px-2.5 py-1 rounded-full transition-colors"
          :class="filters.assignedTo === opt.value
            ? 'bg-brand-600 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
          @click="emit('filter-change', { assignedTo: opt.value as any })"
        >
          {{ opt.label }}
        </button>
        <button
          class="text-xs px-2.5 py-1 rounded-full transition-colors"
          :class="filters.unreadOnly
            ? 'bg-amber-500 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
          @click="emit('filter-change', { unreadOnly: !filters.unreadOnly })"
        >
          {{ filters.unreadOnly ? '● Sin leer' : 'Sin leer' }}
        </button>
      </div>
    </div>

    <!-- Lista -->
    <div class="flex-1 overflow-auto">
      <div v-if="loading && conversations.length === 0" class="p-8 text-center text-slate-400 text-sm">
        Cargando...
      </div>

      <div v-else-if="conversations.length === 0" class="p-8 text-center text-slate-400">
        <div class="text-3xl mb-2">📭</div>
        <p class="text-sm">No hay conversaciones</p>
      </div>

      <button
        v-for="conv in conversations"
        :key="conv.id"
        class="w-full text-left p-3 border-b border-surface-border/50 hover:bg-slate-50 transition-colors relative flex gap-3 items-start"
        :class="{
          'bg-brand-50': conv.id === selectedId,
          'bg-slate-50/50': conv.id !== selectedId && conv.unreadCount > 0
        }"
        @click="emit('select', conv.id)"
      >
        <!-- Avatar con channel icon overlaid -->
        <div class="relative shrink-0">
          <div class="w-10 h-10 rounded-full bg-slate-300 text-slate-700 grid place-items-center text-sm font-semibold">
            <img v-if="conv.contactAvatar" :src="conv.contactAvatar" class="w-full h-full rounded-full object-cover" />
            <span v-else>{{ initials(conv.contactName) }}</span>
          </div>
          <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white grid place-items-center text-[10px] border border-surface-border">
            {{ CHANNEL_ICONS[conv.channelType] }}
          </div>
        </div>

        <!-- Contenido -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <div class="font-medium text-sm truncate">
              {{ conv.contactName || 'Sin nombre' }}
            </div>
            <div class="text-[11px] text-slate-400 shrink-0">
              {{ formatRelativeTime(conv.lastMessageAt ?? conv.createdAt) }}
            </div>
          </div>

          <div class="flex items-center gap-1 mt-0.5">
            <!-- Badge handoff -->
            <span v-if="conv.handoffAt && !conv.agentId" class="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
              🤝 Handoff
            </span>
            <!-- Badge urgencia -->
            <span
              v-if="conv.lastUrgency && (conv.lastUrgency === 'high' || conv.lastUrgency === 'urgent')"
              class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              :style="{
                background: URGENCY_LABELS[conv.lastUrgency].color + '20',
                color: URGENCY_LABELS[conv.lastUrgency].color
              }"
            >
              ⚠ {{ URGENCY_LABELS[conv.lastUrgency].label }}
            </span>
            <!-- Bot/Agente indicator -->
            <span v-if="conv.aiActive && !conv.agentId" class="text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full">
              🤖 Bot
            </span>
            <span v-else-if="conv.agentId" class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
              👤 {{ conv.agentName?.split(' ')[0] ?? 'Agente' }}
            </span>
          </div>

          <div class="text-xs text-slate-500 truncate mt-1">
            {{ conv.lastMessagePreview || '...' }}
          </div>
        </div>

        <!-- Unread count badge -->
        <div
          v-if="conv.unreadCount > 0"
          class="shrink-0 w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold grid place-items-center"
        >
          {{ conv.unreadCount > 9 ? '9+' : conv.unreadCount }}
        </div>
      </button>
    </div>
  </div>
</template>
