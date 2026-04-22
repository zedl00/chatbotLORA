// Ruta: /src/repository/supabase/conversation.repo.ts
import { supabase } from '@/services/supabase.client'
import type { IRepository, IRealtimeRepository, RealtimeEvent, Unsubscribe } from '../base.repository'
import type { Conversation, ConversationFilters, InboxRow } from '@/types/conversation.types'
import type { PaginatedResult } from '@/types/api.types'

type CreateConvInput = Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>
type UpdateConvInput = Partial<Conversation>

/**
 * Mapper DB → camelCase de la app.
 * Supabase retorna snake_case; aquí unificamos al estilo TS.
 */
function toConversation(row: Record<string, any>): Conversation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    contactId: row.contact_id,
    channelId: row.channel_id,
    channelType: row.channel_type,
    agentId: row.agent_id,
    teamId: row.team_id,
    status: row.status,
    aiActive: row.ai_active,
    subject: row.subject,
    priority: row.priority,
    tags: row.tags ?? [],
    unreadCount: row.unread_count,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    firstResponseAt: row.first_response_at,
    handoffAt: row.handoff_at,
    assignedAt: row.assigned_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    csatScore: row.csat_score,
    csatFeedback: row.csat_feedback,
    slaDueAt: row.sla_due_at,
    slaBreached: row.sla_breached,
    aiTokensUsed: row.ai_tokens_used,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toInboxRow(row: Record<string, any>): InboxRow {
  return {
    conversationId: row.conversation_id,
    organizationId: row.organization_id,
    status: row.status,
    channelType: row.channel_type,
    priority: row.priority,
    unreadCount: row.unread_count,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    aiActive: row.ai_active,
    conversationTags: row.conversation_tags ?? [],
    contactId: row.contact_id,
    contactName: row.contact_name,
    contactAvatar: row.contact_avatar,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    agentId: row.agent_id,
    agentName: row.agent_name,
    agentAvatar: row.agent_avatar,
    slaDueAt: row.sla_due_at,
    slaBreached: row.sla_breached,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class SupabaseConversationRepo
  implements IRepository<Conversation, CreateConvInput, UpdateConvInput>, IRealtimeRepository<Conversation>
{
  async findById(id: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data ? toConversation(data) : null
  }

  async findMany(params: {
    filters?: Record<string, unknown>
    limit?: number
    offset?: number
    orderBy?: { column: string; ascending?: boolean }
  } = {}): Promise<PaginatedResult<Conversation>> {
    const { limit = 50, offset = 0, orderBy } = params
    let q = supabase.from('conversations').select('*', { count: 'exact' })

    if (params.filters) {
      for (const [k, v] of Object.entries(params.filters)) {
        if (v !== undefined && v !== null) q = q.eq(k, v as any)
      }
    }

    if (orderBy) {
      q = q.order(orderBy.column, { ascending: orderBy.ascending ?? false })
    } else {
      q = q.order('last_message_at', { ascending: false, nullsFirst: false })
    }

    q = q.range(offset, offset + limit - 1)

    const { data, error, count } = await q
    if (error) throw error

    return {
      data: (data ?? []).map(toConversation),
      count: count ?? 0,
      hasMore: (count ?? 0) > offset + limit
    }
  }

  async create(input: CreateConvInput): Promise<Conversation> {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        organization_id: input.organizationId,
        contact_id: input.contactId,
        channel_id: input.channelId,
        channel_type: input.channelType,
        agent_id: input.agentId,
        team_id: input.teamId,
        status: input.status,
        ai_active: input.aiActive,
        subject: input.subject,
        priority: input.priority,
        tags: input.tags,
        metadata: input.metadata
      })
      .select()
      .single()

    if (error) throw error
    return toConversation(data)
  }

  async update(id: string, input: UpdateConvInput): Promise<Conversation> {
    const patch: Record<string, any> = {}
    if (input.agentId !== undefined)       patch.agent_id = input.agentId
    if (input.teamId !== undefined)        patch.team_id = input.teamId
    if (input.status !== undefined)        patch.status = input.status
    if (input.aiActive !== undefined)      patch.ai_active = input.aiActive
    if (input.subject !== undefined)       patch.subject = input.subject
    if (input.priority !== undefined)      patch.priority = input.priority
    if (input.tags !== undefined)          patch.tags = input.tags
    if (input.unreadCount !== undefined)   patch.unread_count = input.unreadCount
    if (input.csatScore !== undefined)     patch.csat_score = input.csatScore
    if (input.csatFeedback !== undefined)  patch.csat_feedback = input.csatFeedback
    if (input.metadata !== undefined)      patch.metadata = input.metadata

    const { data, error } = await supabase
      .from('conversations')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return toConversation(data)
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('conversations').delete().eq('id', id)
    if (error) throw error
  }

  // ───────── Métodos específicos de la bandeja ─────────

  /**
   * Listado enriquecido desde la vista v_inbox.
   * Usar este método en el componente de bandeja.
   */
  async findInbox(filters: ConversationFilters = {}): Promise<PaginatedResult<InboxRow>> {
    const { limit = 50, offset = 0 } = filters
    let q = supabase.from('v_inbox').select('*', { count: 'exact' })

    if (filters.status) {
      q = Array.isArray(filters.status)
        ? q.in('status', filters.status)
        : q.eq('status', filters.status)
    }
    if (filters.channelType) {
      q = Array.isArray(filters.channelType)
        ? q.in('channel_type', filters.channelType)
        : q.eq('channel_type', filters.channelType)
    }
    if (filters.agentId === null) q = q.is('agent_id', null)
    else if (filters.agentId) q = q.eq('agent_id', filters.agentId)

    if (filters.unassigned) q = q.is('agent_id', null)
    if (filters.priority !== undefined) q = q.eq('priority', filters.priority)
    if (filters.slaBreached) q = q.eq('sla_breached', true)

    if (filters.search) {
      q = q.or(
        `contact_name.ilike.%${filters.search}%,last_message_preview.ilike.%${filters.search}%`
      )
    }

    q = q.order('last_message_at', { ascending: false, nullsFirst: false })
         .range(offset, offset + limit - 1)

    const { data, error, count } = await q
    if (error) throw error

    return {
      data: (data ?? []).map(toInboxRow),
      count: count ?? 0,
      hasMore: (count ?? 0) > offset + limit
    }
  }

  /**
   * Asigna un agente a la conversación.
   * Si no se provee agentId, usa la función RPC assign_next_agent.
   */
  async assignAgent(conversationId: string, agentId?: string | null): Promise<Conversation> {
    let finalAgentId = agentId

    if (finalAgentId === undefined) {
      const conv = await this.findById(conversationId)
      if (!conv) throw new Error('Conversación no encontrada')
      const { data: assignedId, error } = await supabase.rpc('assign_next_agent', {
        p_org_id: conv.organizationId,
        p_team_id: conv.teamId
      })
      if (error) throw error
      finalAgentId = assignedId as string | null
    }

    return this.update(conversationId, { agentId: finalAgentId })
  }

  subscribe(
    filters: { organizationId?: string },
    handler: (event: RealtimeEvent<Conversation>) => void
  ): Unsubscribe {
    const channel = supabase
      .channel(`conversations:${filters.organizationId ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          ...(filters.organizationId
            ? { filter: `organization_id=eq.${filters.organizationId}` }
            : {})
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            handler({ type: 'INSERT', record: toConversation(payload.new) })
          } else if (payload.eventType === 'UPDATE') {
            handler({ type: 'UPDATE', record: toConversation(payload.new), old: payload.old as Partial<Conversation> })
          } else if (payload.eventType === 'DELETE') {
            handler({ type: 'DELETE', old: payload.old as Partial<Conversation> })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }
}
