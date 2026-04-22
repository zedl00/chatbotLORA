// Ruta: /src/repository/supabase/message.repo.ts
import { supabase } from '@/services/supabase.client'
import type { IRepository, IRealtimeRepository, RealtimeEvent, Unsubscribe } from '../base.repository'
import type { Message, CreateMessageInput } from '@/types/message.types'
import type { PaginatedResult } from '@/types/api.types'

function toMessage(row: Record<string, any>): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    organizationId: row.organization_id,
    senderType: row.sender_type,
    senderId: row.sender_id,
    content: row.content,
    contentType: row.content_type,
    mediaUrl: row.media_url,
    mediaMetadata: row.media_metadata ?? {},
    externalId: row.external_id,
    status: row.status,
    errorMessage: row.error_message,
    aiTokensUsed: row.ai_tokens_used,
    aiModel: row.ai_model,
    replyToId: row.reply_to_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class SupabaseMessageRepo
  implements IRepository<Message, CreateMessageInput>, IRealtimeRepository<Message>
{
  async findById(id: string): Promise<Message | null> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? toMessage(data) : null
  }

  async findMany(params: {
    filters?: Record<string, unknown>
    limit?: number
    offset?: number
    orderBy?: { column: string; ascending?: boolean }
  } = {}): Promise<PaginatedResult<Message>> {
    const { limit = 100, offset = 0, orderBy } = params
    let q = supabase.from('messages').select('*', { count: 'exact' })

    if (params.filters) {
      for (const [k, v] of Object.entries(params.filters)) {
        if (v !== undefined && v !== null) q = q.eq(k, v as any)
      }
    }

    if (orderBy) {
      q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true })
    } else {
      q = q.order('created_at', { ascending: true })
    }

    q = q.range(offset, offset + limit - 1)

    const { data, error, count } = await q
    if (error) throw error

    return {
      data: (data ?? []).map(toMessage),
      count: count ?? 0,
      hasMore: (count ?? 0) > offset + limit
    }
  }

  /**
   * Mensajes de una conversación (orden cronológico ascendente).
   */
  async findByConversation(conversationId: string, limit = 200): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error
    return (data ?? []).map(toMessage)
  }

  async create(input: CreateMessageInput): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: input.conversationId,
        organization_id: input.organizationId,
        sender_type: input.senderType,
        sender_id: input.senderId,
        content: input.content,
        content_type: input.contentType ?? 'text',
        media_url: input.mediaUrl,
        media_metadata: input.mediaMetadata ?? {},
        external_id: input.externalId,
        ai_tokens_used: input.aiTokensUsed,
        ai_model: input.aiModel,
        reply_to_id: input.replyToId,
        metadata: input.metadata ?? {}
      })
      .select()
      .single()

    if (error) throw error
    return toMessage(data)
  }

  async update(id: string, input: Partial<Message>): Promise<Message> {
    const patch: Record<string, any> = {}
    if (input.status)         patch.status = input.status
    if (input.errorMessage)   patch.error_message = input.errorMessage
    if (input.externalId)     patch.external_id = input.externalId
    if (input.metadata)       patch.metadata = input.metadata

    const { data, error } = await supabase
      .from('messages')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return toMessage(data)
  }

  async delete(): Promise<void> {
    throw new Error('Los mensajes son append-only y no se eliminan.')
  }

  subscribe(
    filters: { conversationId?: string },
    handler: (event: RealtimeEvent<Message>) => void
  ): Unsubscribe {
    const channel = supabase
      .channel(`messages:${filters.conversationId ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          ...(filters.conversationId
            ? { filter: `conversation_id=eq.${filters.conversationId}` }
            : {})
        },
        (payload) => {
          handler({ type: 'INSERT', record: toMessage(payload.new) })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }
}
