// Ruta: /src/types/conversation.types.ts
import type { ChannelType } from './channel.types'

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'abandoned'

export interface Conversation {
  id: string
  organizationId: string
  contactId: string
  channelId: string
  channelType: ChannelType
  agentId: string | null
  teamId: string | null
  status: ConversationStatus
  aiActive: boolean
  subject: string | null
  priority: 0 | 1 | 2
  tags: string[]
  unreadCount: number
  lastMessageAt: string | null
  lastMessagePreview: string | null
  firstResponseAt: string | null
  handoffAt: string | null
  assignedAt: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  csatScore: number | null
  csatFeedback: string | null
  slaDueAt: string | null
  slaBreached: boolean
  aiTokensUsed: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// Fila de la vista v_inbox (ya hace join con contact + agent)
export interface InboxRow {
  conversationId: string
  organizationId: string
  status: ConversationStatus
  channelType: ChannelType
  priority: number
  unreadCount: number
  lastMessageAt: string | null
  lastMessagePreview: string | null
  aiActive: boolean
  conversationTags: string[]
  contactId: string
  contactName: string | null
  contactAvatar: string | null
  contactPhone: string | null
  contactEmail: string | null
  agentId: string | null
  agentName: string | null
  agentAvatar: string | null
  slaDueAt: string | null
  slaBreached: boolean
  createdAt: string
  updatedAt: string
}

export interface ConversationFilters {
  status?: ConversationStatus | ConversationStatus[]
  channelType?: ChannelType | ChannelType[]
  agentId?: string | null
  teamId?: string
  tags?: string[]
  search?: string
  priority?: number
  unassigned?: boolean
  slaBreached?: boolean
  limit?: number
  offset?: number
}
