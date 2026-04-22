<!-- Ruta: /src/modules/inbox/components/ContactPanel.vue -->
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { SupabaseInboxRepo } from '@/repository/supabase/inbox.repo'
import type { InboxConversation, ContactNote } from '@/types/inbox.types'
import { formatDateTime, initials } from '@/utils/format'

const props = defineProps<{ conversation: InboxConversation }>()
const emit = defineEmits<{ (e: 'updated'): void }>()

const auth = useAuthStore()
const repo = new SupabaseInboxRepo()

const notes = ref<ContactNote[]>([])
const newNote = ref('')
const addingNote = ref(false)
const newTag = ref('')

async function loadNotes() {
  if (!props.conversation.contactId) return
  notes.value = await repo.listNotes(props.conversation.contactId)
}

async function addNote() {
  const content = newNote.value.trim()
  if (!content || !props.conversation.contactId || !auth.user?.id || !auth.organizationId) return
  addingNote.value = true
  try {
    const note = await repo.addNote(
      props.conversation.contactId,
      auth.organizationId,
      content,
      auth.user.id
    )
    notes.value.unshift({
      ...note,
      createdByName: auth.user.fullName ?? auth.user.email
    })
    newNote.value = ''
  } catch (e) {
    alert('Error: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    addingNote.value = false
  }
}

async function deleteNote(id: string) {
  if (!confirm('¿Eliminar nota?')) return
  try {
    await repo.deleteNote(id)
    notes.value = notes.value.filter((n) => n.id !== id)
  } catch (e) {
    alert('Error: ' + (e instanceof Error ? e.message : String(e)))
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

watch(() => props.conversation.id, loadNotes)
onMounted(loadNotes)
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

    <!-- Notas internas -->
    <section>
      <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
        📝 Notas internas
      </h4>
      <div class="space-y-2 mb-3">
        <textarea
          v-model="newNote"
          rows="2"
          class="w-full text-xs border border-surface-border rounded p-2 resize-none"
          placeholder="Agregar nota (no visible al contacto)..."
        />
        <button
          :disabled="!newNote.trim() || addingNote"
          class="w-full text-xs bg-brand-600 text-white py-1.5 rounded disabled:opacity-50"
          @click="addNote"
        >
          {{ addingNote ? 'Guardando...' : '+ Agregar nota' }}
        </button>
      </div>

      <div class="space-y-2 max-h-64 overflow-auto">
        <div v-if="notes.length === 0" class="text-xs text-slate-400 italic text-center">
          Sin notas aún
        </div>
        <div
          v-for="note in notes"
          :key="note.id"
          class="bg-amber-50 border border-amber-200 rounded p-2 text-xs"
        >
          <div class="text-slate-700 whitespace-pre-wrap">{{ note.content }}</div>
          <div class="flex justify-between items-center mt-1 text-[10px] text-slate-500">
            <span>{{ note.createdByName || 'Usuario' }} · {{ formatDateTime(note.createdAt) }}</span>
            <button class="text-red-500 hover:underline" @click="deleteNote(note.id)">Borrar</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
