<!-- Ruta: /src/modules/inbox/components/ConversationThread.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     MODIFICADO en Sprint 8 Entrega 4: Quick Replies
     MODIFICADO en Sprint 9 · Supervisor Tools:
       - EscalationBanner arriba si la conv está escalada
       - Botones: TakeoverButton + ReassignDropdown en header
       - Toggle "🤫 Whisper mode" en el editor
       - Bubbles diferenciados para mensajes tipo 'whisper' y 'system'
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { useCan } from '@/composables/useCan'
import { SupabaseInboxRepo } from '@/repository/supabase/inbox.repo'
import { SupabaseSupervisorRepo } from '@/repository/supabase/supervisor.repo'
import { useRealtimeConversation } from '@/composables/useRealtimeInbox'
import { suggestReply, summarizeConversation } from '@/services/claude.service'
import { useQuickReplyStore } from '@/stores/quick-reply.store'
import { useUiStore } from '@/stores/ui.store'
import type { InboxConversation, InboxMessage } from '@/types/inbox.types'
import type { QuickReply } from '@/types/agent.types'
import { CHANNEL_ICONS } from '@/types/inbox.types'
import { formatDateTime, initials } from '@/utils/format'
import QuickReplyDropdown from './QuickReplyDropdown.vue'
import QuickReplyButton from './QuickReplyButton.vue'
import TakeoverButton from './TakeoverButton.vue'
import ReassignDropdown from './ReassignDropdown.vue'
import EscalationBanner from './EscalationBanner.vue'

const props = defineProps<{ conversation: InboxConversation }>()
const emit = defineEmits<{ (e: 'updated'): void }>()

const auth = useAuthStore()
const activeOrgId = useActiveOrganizationId()
const { can } = useCan()
const ui = useUiStore()
const repo = new SupabaseInboxRepo()
const supervisorRepo = new SupabaseSupervisorRepo()
const quickReplyStore = useQuickReplyStore()

const messages = ref<InboxMessage[]>([])
const loading = ref(false)
const input = ref('')
const sending = ref(false)
const scrollEl = ref<HTMLElement | null>(null)
const textareaEl = ref<HTMLTextAreaElement | null>(null)

const showSummary = ref(false)
const summary = ref<string | null>(null)
const summaryLoading = ref(false)

const suggesting = ref(false)

// ── Quick Replies: dropdown "/" ──
const dropdownVisible = ref(false)
const dropdownPrefix = ref('')

// ── Sprint 9: Whisper mode ──
const whisperMode = ref(false)
const canWhisper = computed(() => can('conversations.whisper'))

const isAssignedToMe = computed(() => props.conversation.agentId && props.conversation.agentId === auth.user?.id)
const canSend = computed(() => isAssignedToMe.value || !props.conversation.agentId)

// ── loaders ──
async function loadMessages() {
  loading.value = true
  try {
    messages.value = await repo.listMessages(props.conversation.id)
    await scrollToBottom()
  } finally {
    loading.value = false
  }
}

async function scrollToBottom() {
  await nextTick()
  if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
}

useRealtimeConversation(props.conversation.id, (msg) => {
  if (!messages.value.find((m) => m.id === msg.id)) {
    messages.value.push({
      id: msg.id,
      conversationId: msg.conversation_id,
      senderType: msg.sender_type,
      senderAgentId: msg.sender_agent_id,
      content: msg.content,
      contentType: msg.content_type,
      metadata: msg.metadata ?? {},
      status: msg.status,
      createdAt: msg.created_at
    } as InboxMessage)
    scrollToBottom()
  }
})

async function sendMessage() {
  if (dropdownVisible.value) return

  const text = input.value.trim()
  if (!text || !auth.user?.id || !activeOrgId.value) return

  input.value = ''
  dropdownVisible.value = false
  sending.value = true

  // ── Whisper mode: usar RPC ──
  if (whisperMode.value) {
    try {
      await supervisorRepo.sendWhisper(props.conversation.id, text)
      ui.showToast('info', 'Whisper enviado al equipo')
    } catch (e: any) {
      ui.showToast('error', e?.message ?? 'Error al enviar whisper')
      input.value = text  // recuperar el texto si falló
    } finally {
      sending.value = false
    }
    return
  }

  // ── Mensaje normal al cliente ──
  const optimistic: InboxMessage = {
    id: `local-${Date.now()}`,
    conversationId: props.conversation.id,
    senderType: 'agent',
    senderAgentId: auth.user.id,
    content: text,
    contentType: 'text',
    metadata: {},
    status: 'sending',
    createdAt: new Date().toISOString()
  } as InboxMessage
  messages.value.push(optimistic)
  await scrollToBottom()

  try {
    const real = await repo.sendAgentMessage(
      props.conversation.id,
      text,
      auth.user.id,
      activeOrgId.value
    )
    const idx = messages.value.findIndex((m) => m.id === optimistic.id)
    if (idx >= 0) messages.value[idx] = real
  } catch (e) {
    const idx = messages.value.findIndex((m) => m.id === optimistic.id)
    if (idx >= 0) messages.value[idx].status = 'failed'
    ui.showToast('error', 'Error enviando: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    sending.value = false
  }
}

async function handleAssignToMe() {
  if (!auth.user?.id) return
  await repo.assignConversation(props.conversation.id, auth.user.id)
  emit('updated')
}

async function handleToggleAi() {
  await repo.toggleAi(props.conversation.id, !props.conversation.aiActive)
  emit('updated')
}

async function handleResolve() {
  if (!confirm('¿Marcar como resuelta?')) return
  await repo.setStatus(props.conversation.id, 'resolved')
  emit('updated')
}

async function loadSummary() {
  if (summary.value) { showSummary.value = !showSummary.value; return }
  summaryLoading.value = true
  showSummary.value = true
  try {
    summary.value = await summarizeConversation(props.conversation.id)
  } catch (e) {
    summary.value = '❌ Error: ' + (e instanceof Error ? e.message : String(e))
  } finally {
    summaryLoading.value = false
  }
}

async function getSuggestion() {
  suggesting.value = true
  try {
    const suggestion = await suggestReply(props.conversation.id)
    input.value = suggestion
  } catch (e) {
    ui.showToast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    suggesting.value = false
  }
}

// ── Quick Replies ──
onMounted(async () => {
  await loadMessages()
  if (activeOrgId.value) {
    quickReplyStore.load(activeOrgId.value)
  }
})

function handleInputChange() {
  const ta = textareaEl.value
  if (!ta) return
  const cursorPos = ta.selectionStart ?? input.value.length
  const textBeforeCursor = input.value.slice(0, cursorPos)
  const match = /(?:^|\s)\/([a-zA-Z0-9_-]*)$/.exec(textBeforeCursor)

  if (match) {
    dropdownPrefix.value = match[1]
    dropdownVisible.value = true
  } else {
    dropdownVisible.value = false
  }
}

async function insertQuickReply(qr: QuickReply) {
  const ta = textareaEl.value
  if (!ta) {
    input.value = qr.content
  } else {
    const cursorPos = ta.selectionStart ?? input.value.length
    const textBeforeCursor = input.value.slice(0, cursorPos)
    const textAfterCursor = input.value.slice(cursorPos)
    const match = /(?:^|\s)(\/[a-zA-Z0-9_-]*)$/.exec(textBeforeCursor)
    if (match) {
      const startOfShortcut = textBeforeCursor.length - match[1].length
      const newText = input.value.slice(0, startOfShortcut) + qr.content + textAfterCursor
      input.value = newText
      await nextTick()
      const newCursor = startOfShortcut + qr.content.length
      ta.focus()
      ta.setSelectionRange(newCursor, newCursor)
    } else {
      input.value = textBeforeCursor + qr.content + textAfterCursor
      await nextTick()
      const newCursor = cursorPos + qr.content.length
      ta.focus()
      ta.setSelectionRange(newCursor, newCursor)
    }
  }
  dropdownVisible.value = false
  quickReplyStore.recordUsage(qr.id)
}

function handleDropdownClose() {
  dropdownVisible.value = false
}

function toggleWhisperMode() {
  if (!canWhisper.value) return
  whisperMode.value = !whisperMode.value
}

watch(() => props.conversation.id, () => {
  summary.value = null
  showSummary.value = false
  dropdownVisible.value = false
  whisperMode.value = false
  loadMessages()
}, { immediate: false })
</script>

<template>
  <div class="flex flex-col h-full bg-surface-muted min-h-0">
    <!-- Header -->
    <header class="bg-white border-b border-surface-border px-4 py-3 flex items-center gap-3">
      <div class="w-10 h-10 rounded-full bg-slate-300 text-slate-700 grid place-items-center font-semibold">
        <img v-if="conversation.contactAvatar" :src="conversation.contactAvatar" class="w-full h-full rounded-full object-cover" />
        <span v-else>{{ initials(conversation.contactName) }}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold truncate">{{ conversation.contactName || 'Sin nombre' }}</div>
        <div class="text-xs text-slate-500">
          {{ CHANNEL_ICONS[conversation.channelType] }} {{ conversation.channelName ?? conversation.channelType }}
          <span v-if="conversation.agentId && !isAssignedToMe"> · Atendida por {{ conversation.agentName }}</span>
          <span v-else-if="conversation.aiActive && !conversation.agentId"> · 🤖 Bot activo</span>
        </div>
      </div>

      <div class="flex gap-1 flex-wrap justify-end">
        <button
          v-if="conversation.handoffAt && !conversation.agentId"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100"
          @click="loadSummary"
        >
          {{ showSummary ? '▲' : '📋' }} Resumen IA
        </button>
        <button
          v-if="!isAssignedToMe && !conversation.agentId"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          @click="handleAssignToMe"
        >
          🙋 Tomar
        </button>

        <!-- 🆕 Sprint 9: Supervisor tools -->
        <TakeoverButton
          :conversation-id="conversation.id"
          :current-agent-id="conversation.agentId"
          :current-agent-name="conversation.agentName"
          @done="emit('updated')"
        />
        <ReassignDropdown
          :conversation-id="conversation.id"
          :current-agent-id="conversation.agentId"
          @done="emit('updated')"
        />

        <button
          class="px-3 py-1.5 text-xs font-medium rounded-lg"
          :class="conversation.aiActive
            ? 'bg-brand-100 text-brand-700 hover:bg-brand-200'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
          @click="handleToggleAi"
        >
          🤖 {{ conversation.aiActive ? 'IA ON' : 'IA OFF' }}
        </button>
        <button
          v-if="conversation.status !== 'resolved' && conversation.status !== 'closed'"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
          @click="handleResolve"
        >
          ✓ Resolver
        </button>
      </div>
    </header>

    <!-- 🆕 Sprint 9: Banner de escalamiento si aplica -->
    <EscalationBanner :conversation-id="conversation.id" />

    <!-- Resumen IA -->
    <div v-if="showSummary" class="bg-brand-50 border-b border-brand-200 px-4 py-3">
      <div class="flex items-start justify-between mb-1">
        <div class="font-medium text-xs text-brand-700">📋 Resumen IA</div>
        <button class="text-xs text-brand-600" @click="showSummary = false">Ocultar</button>
      </div>
      <div v-if="summaryLoading" class="text-sm text-brand-700">Generando resumen...</div>
      <div v-else class="text-sm text-slate-700 whitespace-pre-wrap">{{ summary }}</div>
    </div>

    <!-- Mensajes -->
    <div ref="scrollEl" class="flex-1 overflow-auto p-4 space-y-3">
      <div v-if="loading" class="text-center text-slate-400 text-sm">Cargando mensajes...</div>
      <div v-else-if="messages.length === 0" class="text-center text-slate-400 py-8 text-sm">
        Sin mensajes todavía
      </div>

      <!-- 🆕 Sprint 9: mensaje de sistema (takeover, reassign, etc.) -->
      <template v-for="msg in messages" :key="msg.id">
        <div
          v-if="msg.senderType === 'system'"
          class="flex justify-center"
        >
          <div class="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs italic max-w-[75%] text-center">
            {{ msg.content }}
            <span class="text-[10px] text-slate-400 ml-1">· {{ formatDateTime(msg.createdAt) }}</span>
          </div>
        </div>

        <!-- 🆕 Sprint 9: mensaje whisper (visible solo al team) -->
        <div
          v-else-if="msg.senderType === 'whisper'"
          class="flex justify-end gap-2"
        >
          <div class="max-w-[70%]">
            <div class="rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words bg-amber-50 text-amber-900 border-2 border-dashed border-amber-300 rounded-br-md">
              <div class="flex items-center gap-1 text-[10px] font-semibold text-amber-700 mb-1 uppercase tracking-wide">
                🤫 Whisper · visible solo al equipo
              </div>
              {{ msg.content }}
            </div>
            <div class="flex gap-2 mt-0.5 text-[10px] text-amber-600 px-2 justify-end">
              <span>{{ formatDateTime(msg.createdAt) }}</span>
            </div>
          </div>
          <div class="w-7 h-7 rounded-full bg-amber-500 text-white grid place-items-center text-sm shrink-0">
            🤫
          </div>
        </div>

        <!-- Mensajes normales (contact / agent / bot) -->
        <div
          v-else
          class="flex gap-2"
          :class="msg.senderType === 'agent' ? 'justify-end' : 'justify-start'"
        >
          <div
            v-if="msg.senderType === 'contact'"
            class="w-7 h-7 rounded-full bg-slate-300 text-slate-700 grid place-items-center text-[10px] font-semibold shrink-0"
          >{{ initials(conversation.contactName) }}</div>

          <div
            v-else-if="msg.senderType === 'bot'"
            class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm shrink-0"
          >🤖</div>

          <div class="max-w-[70%]">
            <div
              class="rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words"
              :class="msg.senderType === 'agent'
                ? 'bg-brand-600 text-white rounded-br-md'
                : msg.senderType === 'bot'
                  ? 'bg-brand-50 text-slate-800 border border-brand-100 rounded-bl-md'
                  : 'bg-white text-slate-800 border border-surface-border rounded-bl-md'"
            >{{ msg.content }}</div>
            <div class="flex gap-2 mt-0.5 text-[10px] text-slate-400 px-2" :class="msg.senderType === 'agent' && 'justify-end'">
              <span>{{ formatDateTime(msg.createdAt) }}</span>
              <span v-if="msg.senderType === 'bot'">· Bot</span>
              <span v-if="msg.status === 'failed'" class="text-red-500">· ⚠ Falló</span>
              <span v-if="msg.status === 'sending'">· enviando...</span>
              <span v-if="msg.classification?.urgency === 'urgent'" class="text-red-600">· 🔴 urgente</span>
              <span v-else-if="msg.classification?.urgency === 'high'" class="text-amber-600">· 🟠 alta</span>
            </div>
          </div>

          <div v-if="msg.senderType === 'agent'" class="w-7 h-7 rounded-full bg-emerald-500 text-white grid place-items-center text-[10px] font-semibold shrink-0">
            {{ initials(auth.user?.fullName ?? auth.user?.email) }}
          </div>
        </div>
      </template>
    </div>

    <!-- Input -->
    <div v-if="canSend" class="border-t border-surface-border bg-white p-3">
      <!-- 🆕 Sprint 9: Toggle whisper mode -->
      <div v-if="canWhisper" class="flex items-center justify-between mb-2 px-1">
        <label class="flex items-center gap-2 cursor-pointer select-none text-xs">
          <div
            class="relative w-9 h-5 rounded-full transition-colors"
            :class="whisperMode ? 'bg-amber-500' : 'bg-slate-300'"
            @click="toggleWhisperMode"
          >
            <div
              class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all"
              :class="whisperMode ? 'left-[18px]' : 'left-0.5'"
            />
          </div>
          <span :class="whisperMode ? 'text-amber-700 font-semibold' : 'text-slate-600'">
            {{ whisperMode ? '🤫 Modo whisper activo' : '🤫 Whisper' }}
          </span>
        </label>
        <span v-if="whisperMode" class="text-[10px] text-amber-600 italic">
          El cliente NO verá este mensaje
        </span>
      </div>

      <div class="flex gap-2 items-end relative">
        <div class="flex-1 relative">
          <textarea
            ref="textareaEl"
            v-model="input"
            :disabled="sending"
            rows="2"
            class="w-full border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none transition-colors"
            :class="whisperMode
              ? 'border-amber-400 bg-amber-50/40 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
              : 'border-surface-border focus:border-brand-500 focus:ring-1 focus:ring-brand-500'"
            :placeholder="whisperMode
              ? '🤫 Mensaje privado al equipo (no visible al cliente)...'
              : 'Escribe una respuesta... (tip: / para snippets)'"
            @input="handleInputChange"
            @keydown.enter.exact.prevent="sendMessage"
          />
          <QuickReplyDropdown
            :prefix="dropdownPrefix"
            :visible="dropdownVisible"
            @select="insertQuickReply"
            @close="handleDropdownClose"
          />
        </div>

        <div class="flex flex-col gap-1">
          <QuickReplyButton @select="insertQuickReply" />
          <button
            v-if="!whisperMode"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50"
            :disabled="suggesting || sending"
            @click="getSuggestion"
          >
            {{ suggesting ? '...' : '✨ Sugerir' }}
          </button>
          <button
            class="px-4 py-1.5 font-medium rounded-lg text-white disabled:opacity-50"
            :class="whisperMode
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-brand-600 hover:bg-brand-700'"
            :disabled="sending || !input.trim()"
            @click="sendMessage"
          >
            {{ sending ? '...' : (whisperMode ? '🤫' : '→') }}
          </button>
        </div>
      </div>
      <p class="text-[11px] text-slate-400 mt-1">
        <kbd class="bg-slate-100 px-1 rounded">Enter</kbd> para enviar ·
        <kbd class="bg-slate-100 px-1 rounded">Shift+Enter</kbd> nueva línea ·
        <kbd class="bg-slate-100 px-1 rounded">/</kbd> para snippets
      </p>
    </div>

    <div v-else class="bg-slate-100 border-t border-surface-border p-3 text-center text-sm text-slate-600">
      <span v-if="conversation.agentId && !isAssignedToMe">
        Esta conversación está asignada a {{ conversation.agentName }}. No puedes enviar mensajes.
      </span>
    </div>
  </div>
</template>
