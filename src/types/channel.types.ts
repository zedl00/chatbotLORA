// Ruta: /src/types/channel.types.ts

export type ChannelType =
  | 'whatsapp'
  | 'instagram'
  | 'messenger'
  | 'telegram'
  | 'web_widget'
  | 'sms'
  | 'email'

export interface Channel {
  id: string
  organizationId: string
  type: ChannelType
  name: string
  externalId: string | null
  credentials: Record<string, unknown>
  webhookUrl: string | null
  webhookSecret: string | null
  settings: Record<string, unknown>
  active: boolean
  lastError: string | null
  lastErrorAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Contact {
  id: string
  organizationId: string
  fullName: string | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  locale: string | null
  timezone: string | null
  channelIdentities: Record<string, string>
  tags: string[]
  customFields: Record<string, unknown>
  notes: string | null
  firstSeenAt: string
  lastSeenAt: string
  blocked: boolean
  createdAt: string
  updatedAt: string
}

// ═══════════════════════════════════════════════════════════════
// CHANNEL ADAPTER — Interfaz común para cada canal
// Todo canal nuevo debe implementar esta interfaz
// ═══════════════════════════════════════════════════════════════
export interface NormalizedMessage {
  externalId: string
  channelType: ChannelType
  from: {
    externalId: string
    name?: string
    phone?: string
    email?: string
  }
  content: string | null
  contentType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'sticker'
  mediaUrl?: string
  mediaMetadata?: Record<string, unknown>
  timestamp: string
  raw: unknown
}

export interface OutgoingMessage {
  to: string
  contentType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'template'
  text?: string
  mediaUrl?: string
  caption?: string
  template?: {
    name: string
    language: string
    variables?: Record<string, string>
  }
}

export interface ChannelAdapter {
  readonly type: ChannelType
  sendMessage(msg: OutgoingMessage): Promise<{ externalId: string }>
  parseWebhook(payload: unknown): NormalizedMessage[]
  validateWebhook(headers: Record<string, string>, rawBody: string): boolean
}
