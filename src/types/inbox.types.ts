// Ruta: /src/types/inbox.types.ts

import type { Sentiment, UrgencyLevel } from './ai.types'

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'closed'
export type ChannelType = 'web_widget' | 'whatsapp' | 'telegram' | 'instagram' | 'messenger' | 'email'
// 🆕 Sprint 9: añadidos 'whisper' (mensaje privado al equipo) y 'system' (eventos automáticos)
export type MessageSenderType = 'contact' | 'bot' | 'agent' | 'system' | 'whisper'

export interface InboxConversation {
  id: string
  organizationId: string
  channelId: string
  channelType: ChannelType
  channelName: string | null
  status: ConversationStatus
  agentId: string | null
  agentName: string | null
  agentEmail: string | null
  botPersonaId: string | null
  aiActive: boolean
  subject: string | null
  tags: string[]
  priority: number
  unreadCount: number
  lastMessagePreview: string | null
  lastMessageAt: string | null
  handoffAt: string | null
  csatScore: number | null
  createdAt: string
  updatedAt: string
  // Contact
  contactId: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  contactAvatar: string | null
  contactTags: string[]
  // Last classification
  lastUrgency: UrgencyLevel | null
  lastSentiment: Sentiment | null
}

export interface InboxMessage {
  id: string
  conversationId: string
  senderType: MessageSenderType
  senderAgentId: string | null
  senderAgentName?: string
  content: string | null
  contentType: string
  metadata: Record<string, any>
  status: string
  createdAt: string
  // Classification (si existe)
  classification?: {
    intent: string | null
    sentiment: Sentiment | null
    urgency: UrgencyLevel | null
  }
}

export interface InboxFilters {
  status?: ConversationStatus | 'all'
  assignedTo?: 'me' | 'unassigned' | 'all' | string
  unreadOnly?: boolean
  urgencyMin?: UrgencyLevel
  search?: string
  tag?: string
}

/**
 * Notas internas vinculadas a una conversación específica.
 * Antes llamadas ContactNote cuando se creía que pertenecían al contacto.
 * La tabla `notes` en la DB tiene: conversation_id, organization_id, author_id, content, pinned.
 */
export interface ConversationNote {
  id: string
  conversationId: string
  organizationId: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  content: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

/**
 * @deprecated Usar ConversationNote. Se mantiene como alias temporal
 * para no romper componentes que aún no se han migrado.
 */
export type ContactNote = ConversationNote

export const STATUS_LABELS: Record<ConversationStatus, { label: string; color: string }> = {
  open:     { label: 'Abierta',    color: '#3b82f6' },
  pending:  { label: 'Pendiente',  color: '#f59e0b' },
  resolved: { label: 'Resuelta',   color: '#10b981' },
  closed:   { label: 'Cerrada',    color: '#94a3b8' }
}

export const CHANNEL_ICONS: Record<ChannelType, string> = {
  web_widget: '🌐',
  whatsapp:   '📱',
  telegram:   '✈️',
  instagram:  '📷',
  messenger:  '💬',
  email:      '✉️'
}
