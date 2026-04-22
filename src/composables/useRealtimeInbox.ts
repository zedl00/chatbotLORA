// Ruta: /src/composables/useRealtimeInbox.ts
// ═══════════════════════════════════════════════════════════════
// Composable para suscribirse a cambios realtime en el Inbox.
// Escucha INSERT/UPDATE de conversations y messages.
// ═══════════════════════════════════════════════════════════════
import { onMounted, onUnmounted } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase.client'

interface Options {
  organizationId: string
  onConversationInsert?: (conv: any) => void
  onConversationUpdate?: (conv: any) => void
  onMessageInsert?: (msg: any) => void
}

export function useRealtimeInbox(opts: Options) {
  let channel: RealtimeChannel | null = null

  onMounted(() => {
    if (!opts.organizationId) return

    channel = supabase
      .channel(`inbox-${opts.organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `organization_id=eq.${opts.organizationId}`
        },
        (payload) => opts.onConversationInsert?.(payload.new)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `organization_id=eq.${opts.organizationId}`
        },
        (payload) => opts.onConversationUpdate?.(payload.new)
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `organization_id=eq.${opts.organizationId}`
        },
        (payload) => opts.onMessageInsert?.(payload.new)
      )
      .subscribe()
  })

  onUnmounted(() => {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  })
}

// Variante para suscribirse solo a una conversación específica
export function useRealtimeConversation(conversationId: string, onMessage: (msg: any) => void) {
  let channel: RealtimeChannel | null = null

  onMounted(() => {
    if (!conversationId) return
    channel = supabase
      .channel(`conv-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => onMessage(payload.new)
      )
      .subscribe()
  })

  onUnmounted(() => {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  })
}
