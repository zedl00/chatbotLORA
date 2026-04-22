<!-- Ruta: /src/modules/playground/views/PlaygroundView.vue -->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { SupabaseAiRepo } from '@/repository/supabase/ai.repo'
import { playgroundSend } from '@/services/claude.service'
import type { BotPersona } from '@/types/ai.types'
import { initials } from '@/utils/format'

const auth = useAuthStore()
const repo = new SupabaseAiRepo()

interface ChatBubble {
  id: string
  role: 'user' | 'bot'
  text: string
  meta?: {
    tokensUsed: number
    costUsd: number
    latencyMs: number
    handoffDetected: boolean
    ragUsed: boolean
  }
  timestamp: string
}

const personas = ref<BotPersona[]>([])
const selectedPersonaId = ref<string>('')
const messages = ref<ChatBubble[]>([])
const input = ref('')
const sending = ref(false)
const error = ref<string | null>(null)
const conversationId = ref<string | null>(null)
const scrollEl = ref<HTMLElement | null>(null)

const selectedPersona = computed(() => personas.value.find((p) => p.id === selectedPersonaId.value))

const totalCost = computed(() => {
  return messages.value.reduce((sum, m) => sum + (m.meta?.costUsd ?? 0), 0)
})
const totalTokens = computed(() => {
  return messages.value.reduce((sum, m) => sum + (m.meta?.tokensUsed ?? 0), 0)
})

async function load() {
  if (!auth.organizationId) return
  personas.value = (await repo.listPersonas(auth.organizationId)).filter((p) => p.active)
  const def = personas.value.find((p) => p.isDefault)
  if (def) selectedPersonaId.value = def.id
  else if (personas.value.length > 0) selectedPersonaId.value = personas.value[0].id
}

async function scrollToBottom() {
  await nextTick()
  if (scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  }
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return

  error.value = null
  const now = new Date().toISOString()

  // Push optimista del mensaje del user
  messages.value.push({
    id: `local-${Date.now()}`,
    role: 'user',
    text,
    timestamp: now
  })
  input.value = ''
  sending.value = true
  await scrollToBottom()

  try {
    const result = await playgroundSend({
      message: text,
      personaId: selectedPersonaId.value,
      conversationId: conversationId.value ?? undefined
    })

    conversationId.value = result.conversationId

    messages.value.push({
      id: result.botMessageId,
      role: 'bot',
      text: result.botResponse,
      timestamp: new Date().toISOString(),
      meta: {
        tokensUsed: result.tokensUsed,
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
        handoffDetected: result.handoffDetected,
        ragUsed: result.ragUsed
      }
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error desconocido'
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

function reset() {
  if (messages.value.length > 0 && !confirm('¿Empezar una conversación nueva?')) return
  messages.value = []
  conversationId.value = null
  error.value = null
}

function changePersona() {
  if (messages.value.length > 0) {
    if (!confirm('Cambiar de persona inicia una nueva conversación. ¿Continuar?')) return
    reset()
  }
}

onMounted(load)
</script>

<template>
  <div class="h-full flex">
    <!-- Sidebar config -->
    <aside class="w-80 border-r border-surface-border bg-white overflow-auto p-4 space-y-4">
      <div>
        <h2 class="text-lg font-bold">🎮 Playground</h2>
        <p class="text-sm text-slate-500 mt-1">
          Prueba el bot sin conectar canales. Los mensajes no salen fuera.
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Personalidad</label>
        <select
          v-model="selectedPersonaId"
          class="input"
          :disabled="sending"
          @change="changePersona"
        >
          <option v-for="p in personas" :key="p.id" :value="p.id">
            {{ p.name }} {{ p.isDefault ? '(default)' : '' }}
          </option>
        </select>
      </div>

      <div v-if="selectedPersona" class="card p-3 text-xs space-y-2 bg-slate-50">
        <div><strong>Modelo:</strong> {{ selectedPersona.model.replace('claude-', '').replace('-20250514', '').replace('-20251001', '') }}</div>
        <div><strong>Temp:</strong> {{ selectedPersona.temperature }}</div>
        <div><strong>Tono:</strong> {{ selectedPersona.tone }}</div>
        <div>
          <strong>RAG:</strong>
          <span v-if="selectedPersona.useKnowledgeBase" class="text-emerald-700">Activo (top {{ selectedPersona.kbTopK }})</span>
          <span v-else class="text-slate-400">Desactivado</span>
        </div>
        <div>
          <strong>Handoff:</strong>
          <code class="bg-white px-1 rounded">{{ selectedPersona.handoffKeyword }}</code>
        </div>
      </div>

      <div class="pt-4 border-t border-surface-border space-y-2">
        <div class="text-xs text-slate-500">
          <div>Mensajes: {{ messages.length }}</div>
          <div>Tokens: {{ totalTokens.toLocaleString() }}</div>
          <div>Costo: ${{ totalCost.toFixed(4) }} USD</div>
        </div>
        <button class="btn-secondary w-full text-xs" :disabled="sending || messages.length === 0" @click="reset">
          🔄 Nueva conversación
        </button>
      </div>
    </aside>

    <!-- Chat -->
    <main class="flex-1 flex flex-col bg-surface-muted min-h-0">
      <!-- Header -->
      <header class="bg-white border-b border-surface-border px-6 py-3 flex items-center gap-3">
        <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-semibold">
          🤖
        </div>
        <div>
          <div class="font-medium">{{ selectedPersona?.name ?? 'Bot' }}</div>
          <div class="text-xs text-slate-500">Entorno de prueba</div>
        </div>
      </header>

      <!-- Mensajes -->
      <div ref="scrollEl" class="flex-1 overflow-auto p-6 space-y-4">
        <div v-if="messages.length === 0" class="h-full grid place-items-center text-center">
          <div class="space-y-3">
            <div class="text-5xl">💬</div>
            <p class="text-slate-500">Escribe un mensaje abajo para empezar a chatear con el bot.</p>
            <p class="text-xs text-slate-400">Esta conversación queda guardada como "test" en tu organización.</p>
          </div>
        </div>

        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex gap-3"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            v-if="msg.role === 'bot'"
            class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm shrink-0"
          >🤖</div>

          <div class="max-w-[70%] space-y-1">
            <div
              class="rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap"
              :class="msg.role === 'user'
                ? 'bg-brand-600 text-white rounded-br-md'
                : 'bg-white border border-surface-border rounded-bl-md'"
            >{{ msg.text }}</div>

            <div v-if="msg.meta" class="flex flex-wrap gap-1.5 text-[10px]">
              <span class="text-slate-400">{{ msg.meta.latencyMs }}ms</span>
              <span class="text-slate-400">· {{ msg.meta.tokensUsed }} tokens</span>
              <span class="text-slate-400">· ${{ msg.meta.costUsd.toFixed(5) }}</span>
              <span v-if="msg.meta.ragUsed" class="text-emerald-600">· 📚 RAG</span>
              <span v-if="msg.meta.handoffDetected" class="text-amber-600 font-medium">· ⚠️ Handoff</span>
            </div>
          </div>

          <div
            v-if="msg.role === 'user'"
            class="w-8 h-8 rounded-full bg-slate-300 text-slate-700 grid place-items-center text-xs font-semibold shrink-0"
          >{{ initials(auth.user?.fullName ?? auth.user?.email) }}</div>
        </div>

        <div v-if="sending" class="flex gap-3">
          <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm">🤖</div>
          <div class="bg-white border border-surface-border rounded-2xl rounded-bl-md px-4 py-3">
            <div class="flex gap-1">
              <span class="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></span>
              <span class="w-2 h-2 rounded-full bg-slate-400 animate-pulse" style="animation-delay: 0.2s"></span>
              <span class="w-2 h-2 rounded-full bg-slate-400 animate-pulse" style="animation-delay: 0.4s"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="mx-6 mb-2 bg-red-50 text-red-700 text-sm p-3 rounded-xl">
        ❌ {{ error }}
      </div>

      <!-- Input -->
      <div class="border-t border-surface-border bg-white p-4">
        <form class="flex gap-2 items-end" @submit.prevent="send">
          <textarea
            v-model="input"
            :disabled="sending || !selectedPersonaId"
            class="input flex-1 resize-none"
            rows="2"
            placeholder="Escribe un mensaje..."
            @keydown.enter.exact.prevent="send"
          />
          <button
            type="submit"
            class="btn-primary"
            :disabled="sending || !input.trim() || !selectedPersonaId"
          >
            {{ sending ? '...' : '→' }}
          </button>
        </form>
        <p class="text-xs text-slate-400 mt-1">
          Presiona <kbd class="bg-slate-100 px-1 rounded">Enter</kbd> para enviar, <kbd class="bg-slate-100 px-1 rounded">Shift+Enter</kbd> para nueva línea.
        </p>
      </div>
    </main>
  </div>
</template>
