<!-- Ruta: /src/modules/inbox/components/QuickReplyDropdown.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 8 · Entrega 4
     Dropdown flotante que aparece cuando el agente escribe "/" en el
     editor de mensajes. Muestra los snippets disponibles filtrados
     por el prefix después del "/".

     Navegación con flechas, Enter/Tab para insertar, Esc para cerrar.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useQuickReplyStore } from '@/stores/quick-reply.store'
import type { QuickReply } from '@/types/agent.types'
import { QUICK_REPLY_CATEGORIES } from '@/types/agent.types'

interface Props {
  /** Prefix después de "/" (ej: "sal" en "/sal") */
  prefix: string
  /** Si está visible o no */
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', qr: QuickReply): void
  (e: 'close'): void
}>()

const auth = useAuthStore()
const store = useQuickReplyStore()

const selectedIndex = ref(0)

const matches = computed<QuickReply[]>(() => {
  if (!auth.user?.id) return []
  return store.searchByShortcut(auth.user.id, props.prefix)
})

// Reset índice al cambiar el prefix o las matches
watch([() => props.prefix, matches], () => {
  selectedIndex.value = 0
})

function select(qr: QuickReply) {
  emit('select', qr)
}

function handleKeyDown(e: KeyboardEvent) {
  if (!props.visible) return
  if (matches.value.length === 0) {
    if (e.key === 'Escape') {
      e.preventDefault()
      emit('close')
    }
    return
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      selectedIndex.value = (selectedIndex.value + 1) % matches.value.length
      break
    case 'ArrowUp':
      e.preventDefault()
      selectedIndex.value =
        (selectedIndex.value - 1 + matches.value.length) % matches.value.length
      break
    case 'Enter':
    case 'Tab':
      e.preventDefault()
      select(matches.value[selectedIndex.value])
      break
    case 'Escape':
      e.preventDefault()
      emit('close')
      break
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyDown, true)
})

function getCategoryEmoji(cat: string | null) {
  if (!cat) return ''
  const found = QUICK_REPLY_CATEGORIES.find((c) => c.value === cat)
  return found?.emoji ?? ''
}
</script>

<template>
  <div
    v-if="visible"
    class="absolute bottom-full left-0 right-0 mb-2 bg-white border border-surface-border rounded-xl shadow-card max-h-72 overflow-auto z-20"
  >
    <!-- Header -->
    <div class="px-3 py-2 border-b border-surface-border text-[11px] text-slate-500 uppercase tracking-wide font-medium bg-slate-50">
      Respuestas rápidas · <kbd class="bg-white border border-surface-border px-1 rounded text-[10px]">↑↓</kbd> navegar · <kbd class="bg-white border border-surface-border px-1 rounded text-[10px]">Enter</kbd> insertar · <kbd class="bg-white border border-surface-border px-1 rounded text-[10px]">Esc</kbd> cerrar
    </div>

    <!-- Empty -->
    <div v-if="matches.length === 0" class="p-4 text-center text-slate-400 text-sm">
      Sin snippets que coincidan con
      <code class="bg-slate-100 px-1.5 py-0.5 rounded">/{{ prefix }}</code>
    </div>

    <!-- Lista -->
    <div v-else>
      <button
        v-for="(qr, idx) in matches"
        :key="qr.id"
        type="button"
        class="w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-b border-surface-border last:border-0 transition-colors"
        :class="idx === selectedIndex ? 'bg-brand-50' : 'hover:bg-slate-50'"
        @mousedown.prevent="select(qr)"
        @mouseenter="selectedIndex = idx"
      >
        <div class="flex-shrink-0 text-lg">
          {{ getCategoryEmoji(qr.category) || '💬' }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <code
              class="text-xs font-mono font-semibold"
              :class="idx === selectedIndex ? 'text-brand-700' : 'text-brand-600'"
            >
              /{{ qr.shortcut }}
            </code>
            <span class="text-sm font-medium text-slate-800 truncate">{{ qr.title }}</span>
            <span v-if="qr.isShared" class="text-[9px] bg-emerald-100 text-emerald-700 px-1 rounded font-medium">
              EQUIPO
            </span>
          </div>
          <div class="text-xs text-slate-500 truncate mt-0.5">
            {{ qr.content }}
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
