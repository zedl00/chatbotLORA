<!-- Ruta: /src/modules/inbox/components/ContactPanel.vue -->
<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { SupabaseInboxRepo } from '@/repository/supabase/inbox.repo'
import type { InboxConversation, ConversationNote } from '@/types/inbox.types'
import { formatDateTime, initials } from '@/utils/format'

const props = defineProps<{ conversation: InboxConversation }>()
const emit = defineEmits<{ (e: 'updated'): void }>()

const auth = useAuthStore()
const repo = new SupabaseInboxRepo()

const notes = ref<ConversationNote[]>([])
const newNote = ref('')
const addingNote = ref(false)
const loadingNotes = ref(false)
const newTag = ref('')
const saveFeedback = ref<'idle' | 'saved' | 'error'>('idle')

// Ordenar notas: pinned primero, luego por fecha desc
const sortedNotes = computed(() => {
  return [...notes.value].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
})

async function loadNotes() {
  // Las notas ahora son POR CONVERSACIÓN, no por contacto
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

  // Validación defensiva de auth
  if (!auth.user?.id || !auth.organizationId) {
    alert('Sesión no válida. Por favor, recarga la página.')
    return
  }

  addingNote.value = true
  saveFeedback.value = 'idle'
  try {
    const note = await repo.addNote(
      props.conversation.id,        // conversationId (antes era contactId — BUG corregido)
      auth.organizationId,          // organizationId (requerido por NOT NULL)
      content,                      // content
      auth.user.id                  // authorId (antes era createdBy)
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
  // Optimistic update
  const target = notes.value.find((n) => n.id === note.id)
  if (target) target.pinned = newPinned

  try {
    await repo.togglePinNote(note.id, newPinned)
  } catch (e) {
    // Revert on error
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

// Recargar notas cuando cambia la conversación activa
watch(() => props.conversation.id, loadNotes)
onMounted(loadNotes)

// Helper: ¿la nota es del usuario actual?
function isMyNote(note: ConversationNote): boolean {
  return note.authorId === auth.user?.id
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

      <!-- Form de nueva nota -->
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

      <!-- Lista de notas -->
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
          <!-- Contenido de la nota -->
          <div class="text-slate-800 whitespace-pre-wrap leading-relaxed">{{ note.content }}</div>

          <!-- Footer: autor + acciones -->
          <div class="flex justify-between items-center mt-1.5 pt-1.5 border-t border-amber-200/60">
            <div class="flex items-center gap-1.5 text-[10px] text-slate-600 min-w-0">
              <!-- Avatar del autor -->
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

            <!-- Acciones -->
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