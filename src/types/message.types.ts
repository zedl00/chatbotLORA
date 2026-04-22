// Ruta: /src/types/message.types.ts

export type SenderType = 'contact' | 'agent' | 'bot' | 'system'
export type ContentType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'sticker' | 'template'
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface Message {
  id: string
  conversationId: string
  organizationId: string
  senderType: SenderType
  senderId: string | null
  content: string | null
  contentType: ContentType
  mediaUrl: string | null
  mediaMetadata: Record<string, unknown>
  externalId: string | null
  status: MessageStatus
  errorMessage: string | null
  aiTokensUsed: number | null
  aiModel: string | null
  replyToId: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreateMessageInput {
  conversationId: string
  organizationId: string
  senderType: SenderType
  senderId?: string | null
  content?: string | null
  contentType?: ContentType
  mediaUrl?: string | null
  mediaMetadata?: Record<string, unknown>
  externalId?: string | null
  aiTokensUsed?: number | null
  aiModel?: string | null
  replyToId?: string | null
  metadata?: Record<string, unknown>
}
