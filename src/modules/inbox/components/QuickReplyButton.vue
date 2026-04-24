<!-- Ruta: /src/modules/inbox/components/QuickReplyButton.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 8 · Entrega 4
     Botón que abre un modal con la lista completa de snippets para
     buscar e insertar. Alternativa al dropdown "/" para usuarios
     que prefieren mouse.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { useQuickReplyStore } from '@/stores/quick-reply.store'
import type { QuickReply } from '@/types/agent.types'
import { QUICK_REPLY_CATEGORIES } from '@/types/agent.types'

const emit = defineEmits<{
  (e: 'select', qr: QuickReply): void
}>()

const auth = useAuthStore()
const activeOrgId = useActiveOrganizationId()
const store = useQuickReplyStore()

const open = ref(false)
const search = ref('')
const dialogRef = ref<HTMLElement | null>(null)

const visibleItems = computed<QuickReply[]>(() => {
  if (!auth.user?.id) return []
  const all = store.items.filter(
    (qr) => qr.isShared || qr.ownerId === auth.user!.id
  )
  if (!search.value.trim()) {
    return [...all].sort((a, b) => b.usageCount - a.usageCount).slice(0, 30)
  }
  const s = search.value.trim().toLowerCase()
  return all.filter(
    (qr) =>
      qr.shortcut.toLowerCase().includes(s) ||
      qr.title.toLowerCase().includes(s) ||
      qr.content.toLowerCase().includes(s)
  )
})

async function openModal() {
  if (activeOrgId.value) {
    await store.load(activeOrgId.value)
  }
  open.value = true
}

function closeModal() {
  open.value = false
  search.value = ''
}

function handleSelect(qr: QuickReply) {
  emit('select', qr)
  closeModal()
}

function handleClickOutside(e: MouseEvent) {
  if (open.value && dialogRef.value && !dialogRef.value.contains(e.target as Node)) {
    closeModal()
  }
}

function handleEsc(e: KeyboardEvent) {
  if (open.value && e.key === 'Escape') {
    closeModal()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleEsc)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleEsc)
})

function getCategoryEmoji(cat: string | null) {
  if (!cat) return ''
  const found = QUICK_REPLY_CATEGORIES.find((c) => c.value === cat)
  return found?.emoji ?? ''
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
      title="Respuestas rápidas (también puedes escribir / en el editor)"
      @click="openModal"
    >
      📚 Snippets
    </button>

    <!-- Modal flotante encima del botón -->
    <div
      v-if="open"
      ref="dialogRef"
      class="absolute bottom-full right-0 mb-2 w-[380px] max-h-[400px] bg-white border border-surface-border rounded-xl shadow-card z-30 flex flex-col overflow-hidden"
    >
      <!-- Header + search -->
      <div class="p-3 border-b border-surface-border">
        <input
          v-model="search"
          type="text"
          class="input text-sm"
          placeholder="Buscar snippet..."
          autofocus
        />
      </div>

      <!-- Lista -->
      <div v-if="visibleItems.length === 0" class="flex-1 p-6 text-center text-slate-400 text-sm">
        {{ search ? 'Sin snippets que coincidan' : 'No tienes snippets todavía' }}
      </div>
      <div v-else class="flex-1 overflow-auto">
        <button
          v-for="qr in visibleItems"
          :key="qr.id"
          type="button"
          class="w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-b border-surface-border last:border-0 hover:bg-slate-50 transition-colors"
          @mousedown.prevent="handleSelect(qr)"
        >
          <div class="flex-shrink-0 text-lg">
            {{ getCategoryEmoji(qr.category) || '💬' }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <code class="text-xs font-mono font-semibold text-brand-600">
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

      <!-- Footer -->
      <div class="px-3 py-2 border-t border-surface-border bg-slate-50 text-[10px] text-slate-500">
        Tip: escribe
        <kbd class="bg-white border border-surface-border px-1 rounded">/</kbd>
        en el chat para acceso rápido
      </div>
    </div>
  </div>
</template>
