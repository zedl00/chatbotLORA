<!-- Ruta: /src/modules/channels/components/ChannelActionsMenu.vue -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { ChannelMetrics } from '@/types/channel.types'

interface Props {
  channel: ChannelMetrics
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'rename'): void
  (e: 'duplicate'): void
  (e: 'toggle'): void
  (e: 'delete'): void
}>()

const open = ref(false)
const menuRef = ref<HTMLElement | null>(null)

function toggleMenu(e: Event) {
  e.stopPropagation()
  open.value = !open.value
}

function handleAction(action: () => void) {
  open.value = false
  action()
}

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      class="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center text-lg"
      @click="toggleMenu"
    >
      ⋯
    </button>

    <div
      v-if="open"
      class="absolute top-full right-0 mt-1 w-48 bg-white border border-surface-border rounded-xl shadow-card z-20 py-1"
    >
      <button
        class="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2"
        @click="handleAction(() => emit('rename'))"
      >
        ✏️ Renombrar
      </button>
      <button
        class="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2"
        @click="handleAction(() => emit('duplicate'))"
      >
        📑 Duplicar
      </button>
      <button
        class="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2"
        @click="handleAction(() => emit('toggle'))"
      >
        <template v-if="channel.active">
          ⏸️ Desactivar
        </template>
        <template v-else>
          ▶️ Activar
        </template>
      </button>
      <div class="border-t border-surface-border my-1" />
      <button
        class="w-full px-3 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2 disabled:text-slate-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        :disabled="channel.totalConversations > 0"
        :title="channel.totalConversations > 0
          ? `No se puede eliminar: tiene ${channel.totalConversations} conversaciones`
          : 'Eliminar canal'"
        @click="handleAction(() => emit('delete'))"
      >
        🗑️ Eliminar
      </button>
    </div>
  </div>
</template>
