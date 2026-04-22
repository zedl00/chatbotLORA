// Ruta: /src/stores/conversations.store.ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { repositories } from '@/repository'
import type { Conversation, ConversationFilters, InboxRow } from '@/types/conversation.types'
import type { Message } from '@/types/message.types'
import type { Unsubscribe } from '@/repository/base.repository'

export const useConversationsStore = defineStore('conversations', () => {
  const inbox = ref<InboxRow[]>([])
  const selectedId = ref<string | null>(null)
  const messages = ref<Message[]>([])
  const loading = ref(false)

  let conversationsUnsubscribe: Unsubscribe | null = null
  let messagesUnsubscribe: Unsubscribe | null = null

  const selectedConversation = computed<InboxRow | null>(() =>
    inbox.value.find((c) => c.conversationId === selectedId.value) ?? null
  )

  async function loadInbox(filters: ConversationFilters = {}) {
    loading.value = true
    try {
      const result = await repositories.conversations.findInbox(filters)
      inbox.value = result.data
    } finally {
      loading.value = false
    }
  }

  async function selectConversation(conversationId: string) {
    selectedId.value = conversationId
    messages.value = await repositories.messages.findByConversation(conversationId)

    // Suscripción a nuevos mensajes en vivo
    if (messagesUnsubscribe) messagesUnsubscribe()
    messagesUnsubscribe = repositories.messages.subscribe(
      { conversationId },
      (event) => {
        if (event.type === 'INSERT') {
          messages.value = [...messages.value, event.record]
        }
      }
    )
  }

  function subscribeToInbox(organizationId: string) {
    if (conversationsUnsubscribe) conversationsUnsubscribe()
    conversationsUnsubscribe = repositories.conversations.subscribe(
      { organizationId },
      (event) => {
        if (event.type === 'INSERT' || event.type === 'UPDATE') {
          // Re-fetch del inbox para refrescar con join actualizado
          loadInbox()
        }
      }
    )
  }

  async function updateConversation(id: string, patch: Partial<Conversation>) {
    await repositories.conversations.update(id, patch)
    await loadInbox()
  }

  async function assignAgent(conversationId: string, agentId?: string | null) {
    await repositories.conversations.assignAgent(conversationId, agentId)
    await loadInbox()
  }

  function cleanup() {
    if (conversationsUnsubscribe) conversationsUnsubscribe()
    if (messagesUnsubscribe) messagesUnsubscribe()
    conversationsUnsubscribe = null
    messagesUnsubscribe = null
    inbox.value = []
    messages.value = []
    selectedId.value = null
  }

  return {
    inbox,
    selectedId,
    selectedConversation,
    messages,
    loading,
    loadInbox,
    selectConversation,
    subscribeToInbox,
    updateConversation,
    assignAgent,
    cleanup
  }
})
