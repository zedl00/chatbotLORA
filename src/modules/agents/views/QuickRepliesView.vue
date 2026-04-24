<!-- Ruta: /src/modules/agents/views/QuickRepliesView.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 8 · Entrega 4
     Vista de gestión de Quick Replies (snippets).
     - Tabs: Mis snippets / Compartidos del equipo
     - Búsqueda y filtro por categoría
     - Acciones: crear, editar, eliminar
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { useCan } from '@/composables/useCan'
import { useUiStore } from '@/stores/ui.store'
import { useQuickReplyStore } from '@/stores/quick-reply.store'
import type { QuickReply } from '@/types/agent.types'
import { QUICK_REPLY_CATEGORIES } from '@/types/agent.types'
import { timeAgo } from '@/utils/format'
import QuickReplyModal from '../components/QuickReplyModal.vue'

const auth = useAuthStore()
const activeOrgId = useActiveOrganizationId()
const { can } = useCan()
const ui = useUiStore()
const store = useQuickReplyStore()

const tab = ref<'mine' | 'shared'>('mine')
const search = ref('')
const categoryFilter = ref<string>('')

const canCreate = can('quick_replies.create')
const canUpdate = can('quick_replies.update')
const canDelete = can('quick_replies.delete')

const showModal = ref(false)
const editing = ref<QuickReply | null>(null)

async function load() {
  if (!activeOrgId.value) return
  await store.load(activeOrgId.value, true)
}

onMounted(load)

// ─── Listados filtrados ─────
const myItems = computed(() => {
  if (!auth.user?.id) return []
  return store.items.filter((qr) => qr.ownerId === auth.user!.id && !qr.isShared)
})

const sharedItems = computed(() => {
  return store.items.filter((qr) => qr.isShared)
})

const currentList = computed(() => (tab.value === 'mine' ? myItems.value : sharedItems.value))

const filteredList = computed(() => {
  let list = currentList.value

  if (search.value.trim()) {
    const s = search.value.trim().toLowerCase()
    list = list.filter(
      (qr) =>
        qr.shortcut.toLowerCase().includes(s) ||
        qr.title.toLowerCase().includes(s) ||
        qr.content.toLowerCase().includes(s)
    )
  }

  if (categoryFilter.value) {
    list = list.filter((qr) => qr.category === categoryFilter.value)
  }

  return [...list].sort((a, b) => b.usageCount - a.usageCount)
})

// ─── Acciones ─────
function openCreate() {
  editing.value = null
  showModal.value = true
}

function openEdit(qr: QuickReply) {
  // Solo puedo editar los míos, o si soy admin/supervisor, también los compartidos
  const isMine = qr.ownerId === auth.user?.id
  const canEditShared = qr.isShared && can('quick_replies.share')

  if (!isMine && !canEditShared) {
    ui.showToast('error', 'No puedes editar este snippet')
    return
  }
  editing.value = qr
  showModal.value = true
}

async function handleDelete(qr: QuickReply) {
  if (!confirm(`¿Eliminar el snippet "/${qr.shortcut}"?`)) return
  try {
    await store.remove(qr.id)
    ui.showToast('success', 'Snippet eliminado')
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error al eliminar')
  }
}

function getCategoryLabel(cat: string | null) {
  if (!cat) return ''
  const found = QUICK_REPLY_CATEGORIES.find((c) => c.value === cat)
  return found ? `${found.emoji} ${found.label}` : cat
}

function canEditItem(qr: QuickReply) {
  if (!canUpdate) return false
  const isMine = qr.ownerId === auth.user?.id
  if (isMine) return true
  return qr.isShared && can('quick_replies.share')
}

function canDeleteItem(qr: QuickReply) {
  if (!canDelete) return false
  const isMine = qr.ownerId === auth.user?.id
  if (isMine) return true
  return qr.isShared && can('quick_replies.share')
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h2 class="text-2xl font-bold">Respuestas rápidas</h2>
        <p class="text-slate-500 text-sm mt-1">
          Snippets que puedes insertar en el chat escribiendo
          <kbd class="bg-slate-100 px-1.5 py-0.5 rounded text-xs">/</kbd>
          seguido del shortcut.
        </p>
      </div>
      <button v-if="canCreate" class="btn-primary" @click="openCreate">
        + Nuevo snippet
      </button>
    </div>

    <!-- Tabs -->
    <div class="card p-2 flex gap-1">
      <button
        class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="tab === 'mine' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'"
        @click="tab = 'mine'"
      >
        Mis snippets
        <span
          class="text-xs px-1.5 py-0.5 rounded"
          :class="tab === 'mine' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'"
        >
          {{ myItems.length }}
        </span>
      </button>
      <button
        class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="tab === 'shared' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'"
        @click="tab = 'shared'"
      >
        Compartidos del equipo
        <span
          class="text-xs px-1.5 py-0.5 rounded"
          :class="tab === 'shared' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'"
        >
          {{ sharedItems.length }}
        </span>
      </button>
    </div>

    <!-- Filtros -->
    <div class="card p-4 flex flex-wrap gap-3 items-center">
      <input
        v-model="search"
        type="text"
        class="input flex-1 min-w-[200px]"
        placeholder="Buscar por shortcut, título o contenido..."
      />
      <select v-model="categoryFilter" class="input w-52">
        <option value="">Todas las categorías</option>
        <option v-for="c in QUICK_REPLY_CATEGORIES" :key="c.value" :value="c.value">
          {{ c.emoji }} {{ c.label }}
        </option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="store.loading && store.items.length === 0" class="card p-8 text-center text-slate-400 text-sm">
      Cargando snippets...
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredList.length === 0" class="card p-12 text-center">
      <div class="text-5xl mb-3">💬</div>
      <p class="text-slate-600 font-medium mb-1">
        {{
          search || categoryFilter
            ? 'No hay snippets con ese filtro'
            : (tab === 'mine'
                ? 'Aún no tienes snippets personales'
                : 'No hay snippets compartidos del equipo')
        }}
      </p>
      <p class="text-slate-400 text-sm mb-5">
        {{
          tab === 'mine'
            ? 'Crea frases frecuentes para agilizar tus respuestas.'
            : 'Los snippets compartidos los crean supervisores o admins.'
        }}
      </p>
      <button v-if="canCreate && !search && !categoryFilter" class="btn-primary" @click="openCreate">
        + Crear primer snippet
      </button>
    </div>

    <!-- Lista -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div
        v-for="qr in filteredList"
        :key="qr.id"
        class="card p-4 hover:shadow-md transition-shadow flex flex-col gap-2"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <code class="bg-brand-50 text-brand-700 px-2 py-0.5 rounded text-sm font-mono font-medium">
                /{{ qr.shortcut }}
              </code>
              <span v-if="qr.isShared" class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                COMPARTIDO
              </span>
              <span v-if="qr.category" class="text-xs text-slate-500">
                {{ getCategoryLabel(qr.category) }}
              </span>
            </div>
            <div class="font-medium text-slate-800 mt-1.5 truncate">{{ qr.title }}</div>
          </div>

          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              v-if="canEditItem(qr)"
              class="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
              title="Editar"
              @click="openEdit(qr)"
            >
              ✏️
            </button>
            <button
              v-if="canDeleteItem(qr)"
              class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar"
              @click="handleDelete(qr)"
            >
              🗑
            </button>
          </div>
        </div>

        <!-- Preview del contenido -->
        <div class="text-sm text-slate-600 bg-slate-50 rounded-lg p-2.5 max-h-24 overflow-hidden">
          {{ qr.content }}
        </div>

        <!-- Footer con stats -->
        <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>Usado {{ qr.usageCount }} {{ qr.usageCount === 1 ? 'vez' : 'veces' }}</span>
          <span>{{ timeAgo(qr.updatedAt) }}</span>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <QuickReplyModal
      v-if="showModal"
      :quick-reply="editing"
      @close="showModal = false"
      @saved="() => { showModal = false }"
    />
  </div>
</template>
