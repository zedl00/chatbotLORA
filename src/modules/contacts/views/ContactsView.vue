<!-- Ruta: /src/modules/contacts/views/ContactsView.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 7.5 · Vista principal de contactos.
     Features:
       - Stats header (total, nuevos semana, bloqueados)
       - Búsqueda por nombre/email/teléfono
       - Filtros por canal + tag
       - Tabla con navegación al detalle
       - Modal para crear contactos manualmente
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { useUiStore } from '@/stores/ui.store'
import { SupabaseContactRepo, type ContactFilters, type ContactStats } from '@/repository/supabase/contact.repo'
import type { Contact, ChannelType } from '@/types/channel.types'
import { initials, timeAgo } from '@/utils/format'
import ContactFormModal from '../components/ContactFormModal.vue'

const router = useRouter()
const activeOrgId = useActiveOrganizationId()
const ui = useUiStore()
const repo = new SupabaseContactRepo()

const contacts = ref<Contact[]>([])
const stats = ref<ContactStats>({ total: 0, newThisWeek: 0, blocked: 0 })
const allTags = ref<string[]>([])
const loading = ref(false)

const filters = ref<ContactFilters>({
  search: '',
  channelType: undefined,
  tag: undefined,
  limit: 50,
  offset: 0
})

const showCreateModal = ref(false)
const editingContact = ref<Contact | null>(null)

const searchDebounce = ref<number | null>(null)

async function load() {
  if (!activeOrgId.value) return
  loading.value = true
  try {
    const [result, statsResult] = await Promise.all([
      repo.listContacts(activeOrgId.value, filters.value),
      repo.getStats(activeOrgId.value)
    ])
    contacts.value = result.data
    stats.value = statsResult
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error cargando contactos')
  } finally {
    loading.value = false
  }
}

async function loadTags() {
  if (!activeOrgId.value) return
  try {
    allTags.value = await repo.listAllTags(activeOrgId.value)
  } catch {
    // No crítico, tags son opcionales
  }
}

function goToDetail(contact: Contact) {
  router.push({ name: 'admin.contact-detail', params: { id: contact.id } })
}

function onContactSaved() {
  showCreateModal.value = false
  editingContact.value = null
  load()
  loadTags()
}

// Debounce para búsqueda
watch(() => filters.value.search, () => {
  if (searchDebounce.value) clearTimeout(searchDebounce.value)
  searchDebounce.value = window.setTimeout(() => load(), 400)
})

// Filtros que son click inmediato
watch(() => [filters.value.channelType, filters.value.tag], () => load())

// Recargar al cambiar de tenant
watch(activeOrgId, () => {
  load()
  loadTags()
})

onMounted(() => {
  load()
  loadTags()
})

// ─── Helpers de visualización ─────
function firstChannelType(contact: Contact): ChannelType | null {
  const keys = Object.keys(contact.channelIdentities ?? {}) as ChannelType[]
  return keys[0] ?? null
}

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

const visibleCount = computed(() => contacts.value.length)
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h2 class="text-2xl font-bold">Contactos</h2>
        <p class="text-slate-500 mt-1 text-sm">
          {{ stats.total }} contactos · {{ stats.newThisWeek }} nuevos esta semana
          <span v-if="stats.blocked > 0" class="text-red-500"> · {{ stats.blocked }} bloqueados</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn-primary" @click="showCreateModal = true">
          + Nuevo contacto
        </button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card p-4 flex flex-wrap gap-3 items-center">
      <input
        v-model="filters.search"
        type="text"
        class="input flex-1 min-w-[220px]"
        placeholder="Buscar por nombre, email o teléfono..."
      />

      <select v-model="filters.channelType" class="input w-48">
        <option :value="undefined">Todos los canales</option>
        <option value="web_widget">🌐 Web widget</option>
        <option value="whatsapp">📱 WhatsApp</option>
        <option value="telegram">✈️ Telegram</option>
        <option value="instagram">📷 Instagram</option>
        <option value="messenger">💬 Messenger</option>
        <option value="email">✉️ Email</option>
      </select>

      <select v-model="filters.tag" class="input w-40">
        <option :value="undefined">Todas las tags</option>
        <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
      </select>
    </div>

    <!-- Tabla -->
    <div class="card overflow-hidden">
      <!-- Header de tabla -->
      <div
        class="grid grid-cols-[2fr,1.5fr,1fr,1.2fr,0.8fr,auto] gap-3 px-5 py-3 border-b border-surface-border text-xs font-semibold text-slate-500 uppercase tracking-wide"
      >
        <div>Contacto</div>
        <div>Email</div>
        <div>Teléfono</div>
        <div>Tags</div>
        <div>Último contacto</div>
        <div class="w-6"></div>
      </div>

      <!-- Loading -->
      <div v-if="loading && contacts.length === 0" class="p-8 text-center text-slate-400 text-sm">
        Cargando contactos...
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!loading && contacts.length === 0"
        class="p-12 text-center"
      >
        <div class="text-5xl mb-3">👥</div>
        <p class="text-slate-600 font-medium mb-1">No hay contactos aún</p>
        <p class="text-slate-400 text-sm mb-5">
          Los contactos se crean automáticamente cuando alguien escribe al widget,<br />
          o puedes crearlos manualmente.
        </p>
        <button class="btn-primary" @click="showCreateModal = true">
          + Crear primer contacto
        </button>
      </div>

      <!-- Filas -->
      <div v-else>
        <button
          v-for="contact in contacts"
          :key="contact.id"
          class="w-full grid grid-cols-[2fr,1.5fr,1fr,1.2fr,0.8fr,auto] gap-3 px-5 py-3 border-b border-surface-border items-center text-sm hover:bg-surface-muted transition-colors text-left"
          @click="goToDetail(contact)"
        >
          <!-- Nombre + canal de origen -->
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-medium flex-shrink-0"
            >
              {{ initials(contact.fullName ?? '?') }}
            </div>
            <div class="min-w-0">
              <div class="font-medium text-slate-800 truncate">
                {{ contact.fullName || 'Sin nombre' }}
                <span v-if="contact.blocked" class="ml-1 text-xs text-red-500">🚫</span>
              </div>
              <div class="text-xs text-slate-400 truncate">
                {{
                  firstChannelType(contact)
                    ? `${CHANNEL_EMOJI[firstChannelType(contact) as string] ?? ''} ${CHANNEL_LABEL[firstChannelType(contact) as string] ?? firstChannelType(contact)}`
                    : 'Creado manual'
                }}
              </div>
            </div>
          </div>

          <!-- Email -->
          <div class="text-slate-600 truncate">
            <span v-if="contact.email">{{ contact.email }}</span>
            <span v-else class="text-slate-300">—</span>
          </div>

          <!-- Teléfono -->
          <div class="text-slate-600 truncate">
            <span v-if="contact.phone">{{ contact.phone }}</span>
            <span v-else class="text-slate-300">—</span>
          </div>

          <!-- Tags -->
          <div class="flex gap-1 flex-wrap min-w-0">
            <span
              v-for="tag in contact.tags.slice(0, 2)"
              :key="tag"
              class="px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-xs font-medium"
            >
              {{ tag }}
            </span>
            <span
              v-if="contact.tags.length > 2"
              class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs"
            >
              +{{ contact.tags.length - 2 }}
            </span>
            <span v-if="contact.tags.length === 0" class="text-slate-300 text-xs">—</span>
          </div>

          <!-- Último contacto -->
          <div class="text-slate-500 text-xs">
            {{ timeAgo(contact.lastSeenAt) }}
          </div>

          <div class="text-slate-300">›</div>
        </button>
      </div>

      <!-- Footer con paginación simple -->
      <div
        v-if="contacts.length > 0"
        class="px-5 py-3 border-t border-surface-border flex items-center justify-between text-xs text-slate-500"
      >
        <span>Mostrando {{ visibleCount }} de {{ stats.total }}</span>
      </div>
    </div>

    <!-- Modal de crear/editar -->
    <ContactFormModal
      v-if="showCreateModal || editingContact"
      :contact="editingContact"
      :suggestions-tags="allTags"
      @close="() => { showCreateModal = false; editingContact = null }"
      @saved="onContactSaved"
    />
  </div>
</template>
