<!-- Ruta: /src/modules/inbox/components/ContactPanel.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     MODIFICADO en Sprint 8 · Entrega 4:
       - Nueva sección "Últimas conversaciones" con historial mini
         del contacto (últimas 5 conversaciones previas).
       - Click en cualquier conversación → abre detalle del contacto
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { SupabaseInboxRepo } from '@/repository/supabase/inbox.repo'
import { SupabaseContactRepo, type ContactConversationSummary } from '@/repository/supabase/contact.repo'
import type { InboxConversation, ConversationNote } from '@/types/inbox.types'
import { formatDateTime, formatRelativeTime, initials } from '@/utils/format'

const props = defineProps<{ conversation: InboxConversation }>()
const emit = defineEmits<{ (e: 'updated'): void }>()

const router = useRouter()
const auth = useAuthStore()
const activeOrgId = useActiveOrganizationId()
const repo = new SupabaseInboxRepo()
const contactRepo = new SupabaseContactRepo()

// 🆕 Sprint 7.5: link al perfil completo del contacto
function goToContactProfile() {
  if (!props.conversation.contactId) return
  router.push({
    name: 'admin.contact-detail',
    params: { id: props.conversation.contactId }
  })
}

const notes = ref<ConversationNote[]>([])
const newNote = ref('')
const addingNote = ref(false)
const loadingNotes = ref(false)
const newTag = ref('')
const saveFeedback = ref<'idle' | 'saved' | 'error'>('idle')

// 🆕 Sprint 8 Entrega 4: Historial mini del contacto
const pastConversations = ref<ContactConversationSummary[]>([])
const loadingPast = ref(false)

// Ordenar notas: pinned primero, luego por fecha desc
const sortedNotes = computed(() => {
  return [...notes.value].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
})

// Filtrar la conversación actual del historial (no queremos verla en el mini)
const otherConversations = computed(() =>
  pastConversations.value.filter((c) => c.id !== props.conversation.id).slice(0, 5)
)

async function loadPastConversations() {
  if (!props.conversation?.contactId) return
  loadingPast.value = true
  try {
    pastConversations.value = await contactRepo.listConversationsByContact(
      props.conversation.contactId,
      6  // traemos 6 para luego filtrar la actual y dejar hasta 5
    )
  } catch (e) {
    console.error('[ContactPanel] Error cargando historial:', e)
    pastConversations.value = []
  } finally {
    loadingPast.value = false
  }
}

async function loadNotes() {
  if (!props.conversation?.id) return
  loadingNotes.value = true
  try {
    notes.value = await repo.listNotes(props.conversation.id)
  } catch (e) {
    console.error('[ContactPanel] Error cargando notas:', e)
    notes.value = []
  } finally {
    loadingNotes.value = false
  }
}

async function addNote() {
  const content = newNote.value.trim()
  if (!content) return

  if (!auth.user?.id || !activeOrgId.value) {
    alert('Sesión no válida. Por favor, recarga la página.')
    return
  }

  addingNote.value = true
  saveFeedback.value = 'idle'
  try {
    const note = await repo.addNote(
      props.conversation.id,
      activeOrgId.value,
      content,
      auth.user.id
    )
    notes.value.unshift(note)
    newNote.value = ''
    saveFeedback.value = 'saved'
    setTimeout(() => (saveFeedback.value = 'idle'), 1500)
  } catch (e) {
    console.error('[ContactPanel] Error agregando nota:', e)
    saveFeedback.value = 'error'
    alert('Error al guardar la nota: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    addingNote.value = false
  }
}

async function deleteNote(id: string) {
  if (!confirm('¿Eliminar esta nota? No se puede deshacer.')) return
  try {
    await repo.deleteNote(id)
    notes.value = notes.value.filter((n) => n.id !== id)
  } catch (e) {
    console.error('[ContactPanel] Error eliminando nota:', e)
    alert('Error al eliminar: ' + (e instanceof Error ? e.message : String(e)))
  }
}

async function togglePin(note: ConversationNote) {
  const newPinned = !note.pinned
  const target = notes.value.find((n) => n.id === note.id)
  if (target) target.pinned = newPinned

  try {
    await repo.togglePinNote(note.id, newPinned)
  } catch (e) {
    if (target) target.pinned = !newPinned
    console.error('[ContactPanel] Error cambiando pin:', e)
    alert('No se pudo cambiar el pin: ' + (e instanceof Error ? e.message : String(e)))
  }
}

async function addTag() {
  const tag = newTag.value.trim().toLowerCase()
  if (!tag) return
  const tags = [...(props.conversation.tags ?? []), tag]
  await repo.updateTags(props.conversation.id, [...new Set(tags)])
  newTag.value = ''
  emit('updated')
}

async function removeTag(tag: string) {
  const tags = props.conversation.tags.filter((t) => t !== tag)
  await repo.updateTags(props.conversation.id, tags)
  emit('updated')
}

// Recargar al cambiar la conversación activa
watch(() => props.conversation.id, () => {
  loadNotes()
  loadPastConversations()
})

onMounted(() => {
  loadNotes()
  loadPastConversations()
})

function isMyNote(note: ConversationNote): boolean {
  return note.authorId === auth.user?.id
}

// Config visual de estados de conversación
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:     { label: 'Abierta',    color: '#2563eb', bg: '#dbeafe' },
  pending:  { label: 'Pendiente',  color: '#d97706', bg: '#fef3c7' },
  resolved: { label: 'Resuelta',   color: '#059669', bg: '#d1fae5' },
  closed:   { label: 'Cerrada',    color: '#475569', bg: '#e2e8f0' }
}

function statusBadge(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, color: '#475569', bg: '#e2e8f0' }
}

function goToPastConversation() {
  // Por ahora solo redirigimos al perfil del contacto, ahí se ve el historial completo.
  // En un sprint futuro podemos pasar ?conversationId=X para abrir directo.
  goToContactProfile()
}
</script>

<template>
  <div class="p-5 space-y-5">
    <!-- Avatar + nombre -->
    <div class="text-center">
      <div class="w-20 h-20 rounded-full bg-slate-300 text-slate-700 grid place-items-center text-2xl font-semibold mx-auto">
        <img v-if="conversation.contactAvatar" :src="conversation.contactAvatar" class="w-full h-full rounded-full object-cover" />
        <span v-else>{{ initials(conversation.contactName) }}</span>
      </div>
      <div class="font-semibold mt-2">{{ conversation.contactName || 'Sin nombre' }}</div>
      <!-- 🆕 Sprint 7.5: Link al perfil completo del contacto -->
      <button
        v-if="conversation.contactId"
        class="mt-1 text-xs text-brand-600 hover:text-brand-700 hover:underline transition-colors"
        @click="goToContactProfile"
      >
        Ver perfil completo →
      </button>
    </div>

    <!-- Info básica -->
    <section>
      <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Contacto</h4>
      <div class="space-y-1 text-sm">
        <div v-if="conversation.contactEmail">
          <span class="text-slate-500">Email:</span>
          <a :href="`mailto:${conversation.contactEmail}`" class="text-brand-600 hover:underline ml-1 break-all">
            {{ conversation.contactEmail }}
          </a>
        </div>
        <div v-if="conversation.contactPhone">
          <span class="text-slate-500">Teléfono:</span>
          <span class="ml-1">{{ conversation.contactPhone }}</span>
        </div>
        <div v-if="!conversation.contactEmail && !conversation.contactPhone" class="text-slate-400 text-xs italic">
          Sin datos de contacto
        </div>
      </div>
    </section>

    <!-- Etiquetas -->
    <section>
      <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Etiquetas</h4>
      <div class="flex flex-wrap gap-1 mb-2">
        <span
          v-for="tag in conversation.tags"
          :key="tag"
          class="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1"
        >
          {{ tag }}
          <button class="hover:text-red-600" @click="removeTag(tag)">✕</button>
        </span>
        <span v-if="conversation.tags.length === 0" class="text-xs text-slate-400 italic">Sin etiquetas</span>
      </div>
      <div class="flex gap-1">
        <input
          v-model="newTag"
          class="flex-1 text-xs border border-surface-border rounded px-2 py-1"
          placeholder="Nueva etiqueta"
          @keyup.enter="addTag"
        />
        <button class="text-xs px-2 py-1 bg-brand-600 text-white rounded" @click="addTag">+</button>
      </div>
    </section>

    <!-- Conversación info -->
    <section>
      <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Conversación</h4>
      <div class="space-y-1 text-xs">
        <div><span class="text-slate-500">Estado:</span> <span class="ml-1 capitalize">{{ conversation.status }}</span></div>
        <div><span class="text-slate-500">Canal:</span> <span class="ml-1">{{ conversation.channelName ?? conversation.channelType }}</span></div>
        <div v-if="conversation.agentName">
          <span class="text-slate-500">Agente:</span> <span class="ml-1">{{ conversation.agentName }}</span>
        </div>
        <div v-if="conversation.handoffAt">
          <span class="text-slate-500">Handoff:</span>
          <span class="ml-1">{{ formatDateTime(conversation.handoffAt) }}</span>
        </div>
        <div><span class="text-slate-500">Creada:</span> <span class="ml-1">{{ formatDateTime(conversation.createdAt) }}</span></div>
      </div>
    </section>

    <!-- 🆕 Sprint 8 Entrega 4: Últimas conversaciones del contacto -->
    <section v-if="conversation.contactId">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400">
          📜 Últimas conversaciones
        </h4>
        <span v-if="otherConversations.length > 0" class="text-[10px] text-slate-400">
          {{ otherConversations.length }} recientes
        </span>
      </div>

      <div v-if="loadingPast" class="text-xs text-slate-400 italic text-center py-3">
        Cargando historial...
      </div>

      <div v-else-if="otherConversations.length === 0" class="text-xs text-slate-400 italic text-center py-3">
        Esta es su primera conversación con nosotros ✨
      </div>

      <div v-else class="space-y-1.5">
        <button
          v-for="pc in otherConversations"
          :key="pc.id"
          class="w-full text-left border border-surface-border rounded-lg p-2 text-xs hover:bg-slate-50 transition-colors"
          @click="goToPastConversation"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="font-medium text-slate-800 truncate">
                {{ pc.subject || pc.lastMessagePreview || 'Sin asunto' }}
              </div>
              <div class="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                <span>{{ formatRelativeTime(pc.lastMessageAt ?? pc.createdAt) }}</span>
                <span v-if="pc.agentName" class="truncate">· {{ pc.agentName }}</span>
                <span v-if="pc.csatScore != null" class="text-amber-600">· {{ pc.csatScore }} ★</span>
              </div>
            </div>
            <span
              class="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
              :style="{
                color: statusBadge(pc.status).color,
                background: statusBadge(pc.status).bg
              }"
            >
              {{ statusBadge(pc.status).label }}
            </span>
          </div>
        </button>

        <button
          v-if="pastConversations.length > 1"
          class="w-full text-center text-xs text-brand-600 hover:text-brand-700 hover:underline mt-1 py-1"
          @click="goToContactProfile"
        >
          Ver todo el historial →
        </button>
      </div>
    </section>

    <!-- Notas internas (por conversación) -->
    <section>
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400">
          📝 Notas internas
        </h4>
        <span v-if="notes.length > 0" class="text-[10px] text-slate-400">
          {{ notes.length }} {{ notes.length === 1 ? 'nota' : 'notas' }}
        </span>
      </div>

      <div class="space-y-2 mb-3">
        <textarea
          v-model="newNote"
          rows="2"
          class="w-full text-xs border border-surface-border rounded p-2 resize-none focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          placeholder="Agregar nota interna (no visible al contacto)..."
          :disabled="addingNote"
          @keydown.ctrl.enter.prevent="addNote"
          @keydown.meta.enter.prevent="addNote"
        />
        <button
          :disabled="!newNote.trim() || addingNote"
          class="w-full text-xs py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{
            'bg-brand-600 text-white hover:bg-brand-700': saveFeedback === 'idle',
            'bg-emerald-600 text-white': saveFeedback === 'saved',
            'bg-red-600 text-white': saveFeedback === 'error'
          }"
          @click="addNote"
        >
          <template v-if="addingNote">Guardando...</template>
          <template v-else-if="saveFeedback === 'saved'">✓ Guardada</template>
          <template v-else-if="saveFeedback === 'error'">✕ Error</template>
          <template v-else>+ Agregar nota <span class="opacity-60">(Ctrl+Enter)</span></template>
        </button>
      </div>

      <div class="space-y-2 max-h-80 overflow-auto">
        <div v-if="loadingNotes" class="text-xs text-slate-400 italic text-center py-4">
          Cargando notas...
        </div>

        <div v-else-if="notes.length === 0" class="text-xs text-slate-400 italic text-center py-4">
          Sin notas aún. Agrega la primera ☝️
        </div>

        <div
          v-for="note in sortedNotes"
          :key="note.id"
          class="border rounded p-2 text-xs transition-colors"
          :class="{
            'bg-amber-50 border-amber-200': !note.pinned,
            'bg-amber-100 border-amber-400 shadow-sm': note.pinned
          }"
        >
          <div class="text-slate-800 whitespace-pre-wrap leading-relaxed">{{ note.content }}</div>

          <div class="flex justify-between items-center mt-1.5 pt-1.5 border-t border-amber-200/60">
            <div class="flex items-center gap-1.5 text-[10px] text-slate-600 min-w-0">
              <div
                v-if="note.authorAvatarUrl"
                class="w-4 h-4 rounded-full bg-cover bg-center flex-shrink-0"
                :style="{ backgroundImage: `url(${note.authorAvatarUrl})` }"
              />
              <div v-else class="w-4 h-4 rounded-full bg-slate-300 text-slate-700 grid place-items-center text-[8px] font-semibold flex-shrink-0">
                {{ initials(note.authorName) }}
              </div>
              <span class="truncate">
                <strong v-if="isMyNote(note)" class="text-brand-700">Tú</strong>
                <template v-else>{{ note.authorName }}</template>
                <span class="text-slate-400"> · {{ formatDateTime(note.createdAt) }}</span>
              </span>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0 ml-2">
              <button
                class="hover:text-amber-700 transition-colors"
                :class="note.pinned ? 'text-amber-600' : 'text-slate-400'"
                :title="note.pinned ? 'Desfijar' : 'Fijar arriba'"
                @click="togglePin(note)"
              >
                📌
              </button>
              <button
                v-if="isMyNote(note)"
                class="text-red-400 hover:text-red-600 transition-colors"
                title="Eliminar"
                @click="deleteNote(note.id)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
