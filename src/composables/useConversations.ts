// Ruta: /src/composables/useConversations.ts
import { onUnmounted, ref } from 'vue'
import { repositories } from '@/repository'
import type { Conversation, ConversationFilters, InboxRow } from '@/types/conversation.types'
import type { Unsubscribe } from '@/repository/base.repository'

/**
 * Composable para trabajar con conversaciones con realtime integrado.
 * Úsalo en componentes de bandeja.
 */
export function useConversations() {
  const inbox = ref<InboxRow[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let unsubscribe: Unsubscribe | null = null

  async function load(filters: ConversationFilters = {}) {
    loading.value = true
    error.value = null
    try {
      const result = await repositories.conversations.findInbox(filters)
      inbox.value = result.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  function subscribe(organizationId: string, onChange?: () => void) {
    if (unsubscribe) unsubscribe()
    unsubscribe = repositories.conversations.subscribe(
      { organizationId },
      () => { onChange?.() }
    )
  }

  async function assignAgent(conversationId: string, agentId?: string | null) {
    return repositories.conversations.assignAgent(conversationId, agentId)
  }

  async function update(id: string, patch: Partial<Conversation>) {
    return repositories.conversations.update(id, patch)
  }

  onUnmounted(() => { if (unsubscribe) unsubscribe() })

  return { inbox, loading, error, load, subscribe, assignAgent, update }
}
