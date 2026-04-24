<!-- Ruta: /src/modules/contacts/views/ContactDetailView.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 7.5 · Vista detalle del contacto.
     Features:
       - Panel izq: info personal, tags (editables inline), notas
       - Panel der: historial de conversaciones (con CSAT y agente)
       - Botón Editar abre ContactFormModal
       - Botón Bloquear/Desbloquear
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui.store'
import {
  SupabaseContactRepo,
  type ContactConversationSummary
} from '@/repository/supabase/contact.repo'
import type { Contact, ChannelType } from '@/types/channel.types'
import { initials, formatRelativeTime, formatDateFull, timeAgo } from '@/utils/format'
import ContactFormModal from '../components/ContactFormModal.vue'
import TagInput from '../components/TagInput.vue'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const repo = new SupabaseContactRepo()

const contactId = computed(() => String(route.params.id))

const contact = ref<Contact | null>(null)
const conversations = ref<ContactConversationSummary[]>([])
const allTags = ref<string[]>([])
const loading = ref(false)
const showEditModal = ref(false)

async function load() {
  loading.value = true
  try {
    const c = await repo.findById(contactId.value)
    if (!c) {
      ui.showToast('error', 'Contacto no encontrado')
      router.push({ name: 'admin.contacts' })
      return
    }
    contact.value = c

    // Cargar historial de conversaciones en paralelo
    const [convs] = await Promise.all([
      repo.listConversationsByContact(contactId.value, 30)
    ])
    conversations.value = convs

    // Tags para autocompletado en la edición inline
    if (c.organizationId) {
      try {
        allTags.value = await repo.listAllTags(c.organizationId)
      } catch { /* no crítico */ }
    }
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error cargando contacto')
  } finally {
    loading.value = false
  }
}

async function saveTagsInline(newTags: string[]) {
  if (!contact.value) return
  try {
    const updated = await repo.update(contact.value.id, { tags: newTags })
    contact.value = updated
    ui.showToast('success', 'Tags actualizadas')
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error al guardar tags')
  }
}

async function toggleBlocked() {
  if (!contact.value) return
  const newVal = !contact.value.blocked
  try {
    const updated = await repo.update(contact.value.id, { blocked: newVal })
    contact.value = updated
    ui.showToast(
      newVal ? 'warning' : 'success',
      newVal ? 'Contacto bloqueado' : 'Contacto desbloqueado'
    )
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error')
  }
}

function onContactSaved(c: Contact) {
  contact.value = c
  showEditModal.value = false
}

function openConversation(c: ContactConversationSummary) {
  // Ir al Inbox y (en el futuro) abrir la conversación específica
  router.push({ name: 'admin.inbox' })
  ui.showToast('info', `Abriendo conversación "${c.subject ?? 'sin asunto'}"`)
}

onMounted(load)

// ─── Helpers ─────
const channelEntries = computed(() => {
  if (!contact.value) return []
  return Object.entries(contact.value.channelIdentities ?? {}) as [ChannelType, string][]
})

const CHANNEL_EMOJI: Record<string, string> = {
  web_widget: '🌐',
  whatsapp: '📱',
  telegram: '✈️',
  instagram: '📷',
  messenger: '💬',
  email: '✉️',
  sms: '📨'
}

const CHANNEL_LABEL: Record<string, string> = {
  web_widget: 'Web widget',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  instagram: 'Instagram',
  messenger: 'Messenger',
  email: 'Email',
  sms: 'SMS'
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:     { label: 'Abierta',    color: '#2563eb', bg: '#dbeafe' },
  pending:  { label: 'Pendiente',  color: '#d97706', bg: '#fef3c7' },
  resolved: { label: 'Resuelta',   color: '#059669', bg: '#d1fae5' },
  closed:   { label: 'Cerrada',    color: '#475569', bg: '#e2e8f0' }
}

function statusBadge(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, color: '#475569', bg: '#e2e8f0' }
}

const stats = computed(() => {
  const total = conversations.value.length
  const open = conversations.value.filter((c) => c.status === 'open').length
  const resolved = conversations.value.filter((c) => c.status === 'resolved').length
  const withCsat = conversations.value.filter((c) => c.csatScore != null)
  const avgCsat = withCsat.length > 0
    ? (withCsat.reduce((sum, c) => sum + (c.csatScore ?? 0), 0) / withCsat.length).toFixed(1)
    : null
  return { total, open, resolved, avgCsat }
})
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Volver -->
    <button
      class="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
      @click="router.push({ name: 'admin.contacts' })"
    >
      ← Volver a contactos
    </button>

    <!-- Loading -->
    <div v-if="loading && !contact" class="card p-8 text-center text-slate-400 text-sm">
      Cargando contacto...
    </div>

    <!-- Detalle -->
    <div v-else-if="contact" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Panel izquierdo: info personal -->
      <div class="card p-5 space-y-5">
        <div class="flex items-start gap-4">
          <div
            class="w-14 h-14 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-semibold text-lg flex-shrink-0"
          >
            {{ initials(contact.fullName ?? '?') }}
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="text-xl font-bold truncate">
              {{ contact.fullName || 'Sin nombre' }}
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Primer contacto {{ formatRelativeTime(contact.firstSeenAt) }}
              · visto {{ timeAgo(contact.lastSeenAt) }}
            </p>
          </div>
          <button class="btn-secondary !px-3 !py-1.5 text-sm" @click="showEditModal = true">
            Editar
          </button>
        </div>

        <!-- Tags editables inline -->
        <div>
          <div class="text-xs text-slate-500 font-medium mb-1.5">Tags</div>
          <TagInput
            :model-value="contact.tags"
            :suggestions="allTags"
            @update:model-value="saveTagsInline"
          />
        </div>

        <!-- Info de contacto -->
        <div class="border-t border-surface-border pt-4 space-y-2.5 text-sm">
          <div class="flex justify-between gap-3">
            <span class="text-slate-500">Email</span>
            <span class="text-slate-800 truncate" :class="{ 'text-slate-300': !contact.email }">
              {{ contact.email || '—' }}
            </span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-slate-500">Teléfono</span>
            <span class="text-slate-800" :class="{ 'text-slate-300': !contact.phone }">
              {{ contact.phone || '—' }}
            </span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-slate-500">Idioma</span>
            <span class="text-slate-800" :class="{ 'text-slate-300': !contact.locale }">
              {{ contact.locale || '—' }}
            </span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-slate-500">Zona horaria</span>
            <span class="text-slate-800" :class="{ 'text-slate-300': !contact.timezone }">
              {{ contact.timezone || '—' }}
            </span>
          </div>
        </div>

        <!-- Canales -->
        <div v-if="channelEntries.length > 0" class="border-t border-surface-border pt-4">
          <div class="text-xs text-slate-500 font-medium mb-2">Canales</div>
          <div class="space-y-1.5">
            <div
              v-for="[type, extId] in channelEntries"
              :key="type"
              class="flex items-center justify-between text-sm"
            >
              <span class="text-slate-700">
                {{ CHANNEL_EMOJI[type] }} {{ CHANNEL_LABEL[type] ?? type }}
              </span>
              <span class="text-slate-400 text-xs font-mono truncate max-w-[180px]">
                {{ extId }}
              </span>
            </div>
          </div>
        </div>

        <!-- Notas internas -->
        <div v-if="contact.notes" class="border-t border-surface-border pt-4">
          <div class="text-xs text-slate-500 font-medium mb-1">Notas internas</div>
          <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ contact.notes }}</p>
        </div>

        <!-- Footer acciones -->
        <div class="border-t border-surface-border pt-4 flex justify-between items-center">
          <button
            class="text-sm"
            :class="contact.blocked ? 'text-emerald-600 hover:text-emerald-700' : 'text-red-500 hover:text-red-600'"
            @click="toggleBlocked"
          >
            {{ contact.blocked ? '✓ Desbloquear contacto' : '🚫 Bloquear contacto' }}
          </button>
          <span class="text-xs text-slate-400">
            Creado {{ formatDateFull(contact.createdAt) }}
          </span>
        </div>
      </div>

      <!-- Panel derecho: historial -->
      <div class="card p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">Historial de conversaciones</h3>
          <span class="text-xs text-slate-400">{{ stats.total }} totales</span>
        </div>

        <!-- Mini stats -->
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-surface-muted rounded-lg p-2">
            <div class="text-xs text-slate-500">Abiertas</div>
            <div class="text-lg font-semibold text-blue-600">{{ stats.open }}</div>
          </div>
          <div class="bg-surface-muted rounded-lg p-2">
            <div class="text-xs text-slate-500">Resueltas</div>
            <div class="text-lg font-semibold text-emerald-600">{{ stats.resolved }}</div>
          </div>
          <div class="bg-surface-muted rounded-lg p-2">
            <div class="text-xs text-slate-500">CSAT promedio</div>
            <div class="text-lg font-semibold" :class="stats.avgCsat ? 'text-amber-600' : 'text-slate-300'">
              {{ stats.avgCsat ? `${stats.avgCsat} ★` : '—' }}
            </div>
          </div>
        </div>

        <!-- Listado -->
        <div v-if="conversations.length === 0" class="text-center py-8 text-slate-400 text-sm">
          Este contacto aún no tiene conversaciones.
        </div>

        <div v-else class="space-y-2 max-h-[500px] overflow-auto pr-1">
          <button
            v-for="conv in conversations"
            :key="conv.id"
            class="w-full text-left border border-surface-border rounded-xl p-3 hover:bg-surface-muted transition-colors"
            @click="openConversation(conv)"
          >
            <div class="flex items-start justify-between gap-2 mb-1">
              <div class="font-medium text-sm text-slate-800 truncate">
                {{ conv.subject || conv.lastMessagePreview || 'Sin asunto' }}
              </div>
              <span
                class="text-xs px-2 py-0.5 rounded-md font-medium flex-shrink-0"
                :style="{
                  color: statusBadge(conv.status).color,
                  background: statusBadge(conv.status).bg
                }"
              >
                {{ statusBadge(conv.status).label }}
              </span>
            </div>

            <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span v-if="conv.channelType">
                {{ CHANNEL_EMOJI[conv.channelType] ?? '' }} {{ CHANNEL_LABEL[conv.channelType] ?? conv.channelType }}
              </span>
              <span v-if="conv.agentName">· {{ conv.agentName }}</span>
              <span v-if="conv.csatScore != null" class="text-amber-600">· {{ conv.csatScore }} ★</span>
            </div>

            <div class="text-xs text-slate-400">
              {{ formatRelativeTime(conv.lastMessageAt ?? conv.createdAt) }}
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal edición -->
    <ContactFormModal
      v-if="showEditModal && contact"
      :contact="contact"
      :suggestions-tags="allTags"
      @close="showEditModal = false"
      @saved="onContactSaved"
    />
  </div>
</template>
