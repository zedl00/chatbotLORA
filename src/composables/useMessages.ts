// Ruta: /src/composables/useMessages.ts
import { onUnmounted, ref } from 'vue'
import { repositories } from '@/repository'
import type { Message, CreateMessageInput } from '@/types/message.types'
import type { Unsubscribe } from '@/repository/base.repository'

/**
 * Composable para mensajes de una conversación con realtime.
 */
export function useMessages() {
  const messages = ref<Message[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let unsubscribe: Unsubscribe | null = null

  async function load(conversationId: string) {
    loading.value = true
    error.value = null
    try {
      messages.value = await repositories.messages.findByConversation(conversationId)
      subscribe(conversationId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  function subscribe(conversationId: string) {
    if (unsubscribe) unsubscribe()
    unsubscribe = repositories.messages.subscribe(
      { conversationId },
      (event) => {
        if (event.type === 'INSERT') {
          // Evitar duplicados si ya viene optimistic
          const exists = messages.value.some((m) => m.id === event.record.id)
          if (!exists) messages.value = [...messages.value, event.record]
        }
      }
    )
  }

  async function send(input: CreateMessageInput) {
    const msg = await repositories.messages.create(input)
    return msg
  }

  onUnmounted(() => { if (unsubscribe) unsubscribe() })

  return { messages, loading, error, load, send }
}
