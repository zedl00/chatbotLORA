<!-- Ruta: /src/modules/inbox/views/InboxView.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     MODIFICADO en Sprint 6.5:
       - Usa useActiveOrganizationId() en lugar de auth.organizationId
       - Esto permite que super_admin en modo soporte vea las
         conversaciones de la empresa que está visitando (no las suyas)
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { SupabaseInboxRepo } from '@/repository/supabase/inbox.repo'
import { useRealtimeInbox } from '@/composables/useRealtimeInbox'
import type { InboxConversation, InboxFilters } from '@/types/inbox.types'

import ConversationList from '../components/ConversationList.vue'
import ConversationThread from '../components/ConversationThread.vue'
import ContactPanel from '../components/ContactPanel.vue'

const auth = useAuthStore()
const activeOrgId = useActiveOrganizationId()
const repo = new SupabaseInboxRepo()

const conversations = ref<InboxConversation[]>([])
const selectedId = ref<string | null>(null)
const loading = ref(false)
const filters = ref<InboxFilters>({
  status: 'open',
  assignedTo: 'all'
})

const selected = computed(() => conversations.value.find((c) => c.id === selectedId.value) ?? null)

async function loadConversations() {
  if (!activeOrgId.value) return
  loading.value = true
  try {
    conversations.value = await repo.listConversations(
      activeOrgId.value,
      filters.value,
      auth.user?.id
    )
  } finally {
    loading.value = false
  }
}

async function handleSelect(id: string) {
  selectedId.value = id
  try {
    await repo.markAsRead(id)
    const idx = conversations.value.findIndex((c) => c.id === id)
    if (idx >= 0) conversations.value[idx].unreadCount = 0
  } catch (e) {
    console.warn('markAsRead failed:', e)
  }
}

async function handleConversationUpdate() {
  await loadConversations()
  if (selectedId.value) {
    const updated = await repo.getConversation(selectedId.value)
    if (updated) {
      const idx = conversations.value.findIndex((c) => c.id === updated.id)
      if (idx >= 0) conversations.value[idx] = updated
    }
  }
}

useRealtimeInbox({
  organizationId: activeOrgId.value ?? '',
  onConversationInsert: () => loadConversations(),
  onConversationUpdate: (conv) => {
    const idx = conversations.value.findIndex((c) => c.id === conv.id)
    if (idx >= 0) {
      repo.getConversation(conv.id).then((updated) => {
        if (updated) conversations.value[idx] = updated
      })
    } else {
      loadConversations()
    }
  },
  onMessageInsert: (msg) => {
    const idx = conversations.value.findIndex((c) => c.id === msg.conversation_id)
    if (idx >= 0) {
      conversations.value[idx].lastMessagePreview = (msg.content ?? '').slice(0, 200)
      conversations.value[idx].lastMessageAt = msg.created_at
      if (msg.sender_type !== 'agent' && msg.conversation_id !== selectedId.value) {
        conversations.value[idx].unreadCount++
      }
      conversations.value.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority
        return (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')
      })
    }
  }
})

watch(filters, () => loadConversations(), { deep: true })
watch(activeOrgId, () => loadConversations())

onMounted(loadConversations)
</script>

<template>
  <div class="h-full flex bg-surface-muted">
    <aside class="w-80 border-r border-surface-border bg-white flex flex-col min-w-0">
      <ConversationList
        :conversations="conversations"
        :selected-id="selectedId"
        :loading="loading"
        :filters="filters"
        @select="handleSelect"
        @filter-change="(f) => filters = { ...filters, ...f }"
      />
    </aside>

    <main class="flex-1 flex flex-col min-w-0">
      <ConversationThread
        v-if="selected"
        :key="selected.id"
        :conversation="selected"
        @updated="handleConversationUpdate"
      />
      <div v-else class="flex-1 grid place-items-center text-slate-400 p-8 text-center">
        <div>
          <div class="text-6xl mb-4">💬</div>
          <p class="text-lg">Selecciona una conversación</p>
          <p class="text-sm mt-1">Los mensajes nuevos aparecerán aquí en tiempo real.</p>
        </div>
      </div>
    </main>

    <aside
      v-if="selected"
      class="w-80 border-l border-surface-border bg-white overflow-auto min-w-0"
    >
      <ContactPanel
        :conversation="selected"
        @updated="handleConversationUpdate"
      />
    </aside>
  </div>
</template>
