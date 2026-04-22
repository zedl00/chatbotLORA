<!-- Ruta: /src/modules/inbox/components/ConversationThread.vue -->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { SupabaseInboxRepo } from '@/repository/supabase/inbox.repo'
import { useRealtimeConversation } from '@/composables/useRealtimeInbox'
import { suggestReply, summarizeConversation } from '@/services/claude.service'
import type { InboxConversation, InboxMessage } from '@/types/inbox.types'
import { CHANNEL_ICONS } from '@/types/inbox.types'
import { formatDateTime, initials } from '@/utils/format'

const props = defineProps<{ conversation: InboxConversation }>()
const emit = defineEmits<{ (e: 'updated'): void }>()

const auth = useAuthStore()
const repo = new SupabaseInboxRepo()

const messages = ref<InboxMessage[]>([])
const loading = ref(false)
const input = ref('')
const sending = ref(false)
const scrollEl = ref<HTMLElement | null>(null)

const showSummary = ref(false)
const summary = ref<string | null>(null)
const summaryLoading = ref(false)

const suggesting = ref(false)

const isAssignedToMe = computed(() => props.conversation.agentId && props.conversation.agentId === auth.user?.id)
const canSend = computed(() => isAssignedToMe.value || !props.conversation.agentId)

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

// Realtime: recibir mensajes en vivo
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
    })
    scrollToBottom()
  }
})

async function sendMessage() {
  const text = input.value.trim()
  if (!text || !auth.user?.id || !auth.organizationId) return

  input.value = ''
  sending.value = true

  // Optimistic
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
  }
  messages.value.push(optimistic)
  await scrollToBottom()

  try {
    const real = await repo.sendAgentMessage(props.conversation.id, text, auth.user.id, auth.organizationId)
    const idx = messages.value.findIndex((m) => m.id === optimistic.id)
    if (idx >= 0) messages.value[idx] = real
  } catch (e) {
    const idx = messages.value.findIndex((m) => m.id === optimistic.id)
    if (idx >= 0) messages.value[idx].status = 'failed'
    alert('Error enviando: ' + (e instanceof Error ? e.message : String(e)))
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
    alert('Error: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    suggesting.value = false
  }
}

watch(() => props.conversation.id, () => {
  summary.value = null
  showSummary.value = false
  loadMessages()
}, { immediate: false })

onMounted(loadMessages)
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

      <!-- Acciones -->
      <div class="flex gap-1">
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

      <div
        v-for="msg in messages"
        :key="msg.id"
        class="flex gap-2"
        :class="msg.senderType === 'agent' ? 'justify-end' : 'justify-start'"
      >
        <!-- Avatar bot/contact -->
        <div
          v-if="msg.senderType === 'contact'"
          class="w-7 h-7 rounded-full bg-slate-300 text-slate-700 grid place-items-center text-[10px] font-semibold shrink-0"
        >{{ initials(conversation.contactName) }}</div>

        <div
          v-else-if="msg.senderType === 'bot'"
          class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm shrink-0"
        >🤖</div>

        <!-- Bubble -->
        <div class="max-w-[70%]">
          <div
            class="rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words"
            :class="msg.senderType === 'agent'
              ? 'bg-brand-600 text-white rounded-br-md'
              : msg.senderType === 'system'
                ? 'bg-amber-100 text-amber-900'
                : msg.senderType === 'bot'
                  ? 'bg-brand-50 text-slate-800 border border-brand-100 rounded-bl-md'
                  : 'bg-white text-slate-800 border border-surface-border rounded-bl-md'"
          >{{ msg.content }}</div>
          <div class="flex gap-2 mt-0.5 text-[10px] text-slate-400 px-2" :class="msg.senderType === 'agent' && 'justify-end'">
            <span>{{ formatDateTime(msg.createdAt) }}</span>
            <span v-if="msg.senderType === 'bot'">· Bot</span>
            <span v-if="msg.status === 'failed'" class="text-red-500">· ⚠ Falló</span>
            <span v-if="msg.status === 'sending'">· enviando...</span>
            <!-- Classification badges -->
            <span v-if="msg.classification?.urgency === 'urgent'" class="text-red-600">· 🔴 urgente</span>
            <span v-else-if="msg.classification?.urgency === 'high'" class="text-amber-600">· 🟠 alta</span>
          </div>
        </div>

        <div v-if="msg.senderType === 'agent'" class="w-7 h-7 rounded-full bg-emerald-500 text-white grid place-items-center text-[10px] font-semibold shrink-0">
          {{ initials(auth.user?.fullName ?? auth.user?.email) }}
        </div>
      </div>
    </div>

    <!-- Input -->
    <div v-if="canSend" class="border-t border-surface-border bg-white p-3">
      <div class="flex gap-2 items-end">
        <textarea
          v-model="input"
          :disabled="sending"
          rows="2"
          class="flex-1 border border-surface-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          placeholder="Escribe una respuesta..."
          @keydown.enter.exact.prevent="sendMessage"
        />
        <div class="flex flex-col gap-1">
          <button
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50"
            :disabled="suggesting || sending"
            @click="getSuggestion"
          >
            {{ suggesting ? '...' : '✨ Sugerir' }}
          </button>
          <button
            class="px-4 py-1.5 font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            :disabled="sending || !input.trim()"
            @click="sendMessage"
          >
            {{ sending ? '...' : '→' }}
          </button>
        </div>
      </div>
      <p class="text-[11px] text-slate-400 mt-1">
        <kbd class="bg-slate-100 px-1 rounded">Enter</kbd> para enviar ·
        <kbd class="bg-slate-100 px-1 rounded">Shift+Enter</kbd> nueva línea
      </p>
    </div>

    <div v-else class="bg-slate-100 border-t border-surface-border p-3 text-center text-sm text-slate-600">
      <span v-if="conversation.agentId && !isAssignedToMe">
        Esta conversación está asignada a {{ conversation.agentName }}. No puedes enviar mensajes.
      </span>
    </div>
  </div>
</template>
