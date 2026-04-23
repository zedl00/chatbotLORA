// Ruta: /src/repository/supabase/inbox.repo.ts
import { supabase } from '@/services/supabase.client'
import type {
  InboxConversation,
  InboxMessage,
  InboxFilters,
  ConversationNote,
  ConversationStatus
} from '@/types/inbox.types'

function toInboxConv(r: any): InboxConversation {
  return {
    id: r.id,
    organizationId: r.organization_id,
    channelId: r.channel_id,
    channelType: r.channel_type,
    channelName: r.channel_name,
    status: r.status,
    agentId: r.agent_id,
    agentName: r.agent_name,
    agentEmail: r.agent_email,
    botPersonaId: r.bot_persona_id,
    aiActive: r.ai_active,
    subject: r.subject,
    tags: r.tags ?? [],
    priority: r.priority ?? 0,
    unreadCount: r.unread_count ?? 0,
    lastMessagePreview: r.last_message_preview,
    lastMessageAt: r.last_message_at,
    handoffAt: r.handoff_at,
    csatScore: r.csat_score,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    contactId: r.contact_id,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    contactAvatar: r.contact_avatar,
    contactTags: r.contact_tags ?? [],
    lastUrgency: r.last_urgency,
    lastSentiment: r.last_sentiment
  }
}

function toMessage(r: any): InboxMessage {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderType: r.sender_type,
    senderAgentId: r.sender_id,
    content: r.content,
    contentType: r.content_type,
    metadata: r.metadata ?? {},
    status: r.status,
    createdAt: r.created_at,
    classification: r.message_classifications?.[0] ? {
      intent: r.message_classifications[0].intent,
      sentiment: r.message_classifications[0].sentiment,
      urgency: r.message_classifications[0].urgency
    } : undefined
  }
}

/**
 * Mapea un row crudo de la tabla `notes` (con join a users) al tipo del frontend.
 */
function toConversationNote(r: any): ConversationNote {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    organizationId: r.organization_id,
    authorId: r.author_id,
    authorName: r.author?.full_name ?? 'Usuario',
    authorAvatarUrl: r.author?.avatar_url ?? null,
    content: r.content,
    pinned: r.pinned ?? false,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export class SupabaseInboxRepo {
  // ───── Listar conversaciones del inbox ─────
  async listConversations(
    organizationId: string,
    filters: InboxFilters = {},
    currentAgentId?: string
  ): Promise<InboxConversation[]> {
    let query = supabase
      .from('v_inbox_conversations')
      .select('*')
      .eq('organization_id', organizationId)

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    } else {
      query = query.neq('status', 'closed')
    }

    if (filters.assignedTo === 'me' && currentAgentId) {
      query = query.eq('assigned_agent_id', currentAgentId)
    } else if (filters.assignedTo === 'unassigned') {
      query = query.is('assigned_agent_id', null)
    } else if (filters.assignedTo && filters.assignedTo !== 'all') {
      query = query.eq('assigned_agent_id', filters.assignedTo)
    }

    if (filters.unreadOnly) {
      query = query.gt('unread_count', 0)
    }

    if (filters.search) {
      query = query.or(`contact_name.ilike.%${filters.search}%,last_message_preview.ilike.%${filters.search}%`)
    }

    if (filters.tag) {
      query = query.contains('tags', [filters.tag])
    }

    query = query.order('priority', { ascending: false })
                 .order('last_message_at', { ascending: false })
                 .limit(100)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map(toInboxConv)
  }

  async getConversation(id: string): Promise<InboxConversation | null> {
    const { data, error } = await supabase
      .from('v_inbox_conversations').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? toInboxConv(data) : null
  }

  // ───── Mensajes ─────
  async listMessages(conversationId: string, limit = 100): Promise<InboxMessage[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*, message_classifications(intent, sentiment, urgency)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map(toMessage)
  }

  async sendAgentMessage(
    conversationId: string,
    content: string,
    agentId: string,
    organizationId: string
  ): Promise<InboxMessage> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        organization_id: organizationId,
        sender_type: 'agent',
        sender_id: agentId,
        content,
        content_type: 'text',
        status: 'sent'
      })
      .select().single()
    if (error) throw error
    return toMessage(data)
  }

  // ───── Acciones ─────
  async assignConversation(conversationId: string, agentId: string): Promise<void> {
    const { error } = await supabase.rpc('assign_conversation', {
      p_conversation_id: conversationId,
      p_agent_id: agentId
    })
    if (error) throw error
  }

  async unassignConversation(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .update({ agent_id: null })
      .eq('id', conversationId)
    if (error) throw error
  }

  async toggleAi(conversationId: string, active: boolean): Promise<void> {
    const { error } = await supabase.rpc('toggle_conversation_ai', {
      p_conversation_id: conversationId,
      p_active: active
    })
    if (error) throw error
  }

  async setStatus(conversationId: string, status: ConversationStatus): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .update({ status })
      .eq('id', conversationId)
    if (error) throw error
  }

  async markAsRead(conversationId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_conversation_read', {
      p_conversation_id: conversationId
    })
    if (error) throw error
  }

  async updateTags(conversationId: string, tags: string[]): Promise<void> {
    const { error } = await supabase
      .from('conversations').update({ tags }).eq('id', conversationId)
    if (error) throw error
  }

  // ───── Notas de la conversación ─────
  // La tabla `notes` tiene: conversation_id, organization_id, author_id,
  // content, pinned, created_at, updated_at.
  // Las notas son internas del equipo, invisibles para el contacto.

  /**
   * Lista notas de una conversación, pinned primero, luego por fecha descendente.
   */
  async listNotes(conversationId: string): Promise<ConversationNote[]> {
    const { data, error } = await supabase
      .from('notes')
      .select(`
        id,
        conversation_id,
        organization_id,
        author_id,
        content,
        pinned,
        created_at,
        updated_at,
        author:users!notes_author_id_fkey(id, full_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(toConversationNote)
  }

  /**
   * Crea una nueva nota en una conversación.
   * @param conversationId UUID de la conversación donde vive la nota.
   * @param organizationId UUID de la org (requerido por RLS y por NOT NULL).
   * @param content Texto plano de la nota.
   * @param authorId UUID del usuario que escribe la nota.
   */
  async addNote(
    conversationId: string,
    organizationId: string,
    content: string,
    authorId: string
  ): Promise<ConversationNote> {
    const { data, error } = await supabase
      .from('notes')
      .insert({
        conversation_id: conversationId,
        organization_id: organizationId,
        author_id: authorId,
        content,
        pinned: false
      })
      .select(`
        id,
        conversation_id,
        organization_id,
        author_id,
        content,
        pinned,
        created_at,
        updated_at,
        author:users!notes_author_id_fkey(id, full_name, avatar_url)
      `)
      .single()

    if (error) throw error
    return toConversationNote(data)
  }

  /**
   * Elimina una nota por ID. La RLS asegura que solo el autor
   * o roles con permiso puedan borrar.
   */
  async deleteNote(id: string): Promise<void> {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) throw error
  }

  /**
   * Togglea el flag pinned de una nota. Las notas pinned se listan arriba.
   */
  async togglePinNote(id: string, pinned: boolean): Promise<void> {
    const { error } = await supabase
      .from('notes')
      .update({ pinned, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }
}