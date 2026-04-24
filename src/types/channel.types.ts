// Ruta: /src/types/channel.types.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 11.5 · Tipos de canales (VERSIÓN MERGE — compatible con todo)
//
// Esta versión preserva TODOS los exports que tu código ya usa:
// - Contact, ChannelType con 'sms', Channel con credentials/webhookUrl/etc.
// Y agrega lo nuevo del Sprint 11.5 sin romper nada.
// ═══════════════════════════════════════════════════════════════

// ─── ChannelType con TODOS los tipos posibles ───
// Incluye 'sms' que tu constants.ts referencia
export type ChannelType =
  | 'web_widget'
  | 'whatsapp'
  | 'telegram'
  | 'instagram'
  | 'messenger'
  | 'email'
  | 'sms'

// ─── Channel completo con todos los campos ───
// Campos obligatorios: id, organizationId, type, name, active, createdAt, updatedAt
// Opcionales: todo lo demás (distintos repos llenan distintos subsets)
export interface Channel {
  id: string
  organizationId: string
  type: ChannelType
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
  // Opcionales (algunos repos los llenan, otros no)
  externalId?: string | null
  credentials?: Record<string, any>
  webhookUrl?: string | null
  webhookSecret?: string | null
  settings?: Record<string, any>
  lastError?: string | null
  lastErrorAt?: string | null
  defaultPersonaId?: string | null
}

// Input para crear canal (campos opcionales)
export interface CreateChannelInput {
  type: ChannelType
  name: string
  credentials?: Record<string, any>
  webhookUrl?: string | null
  webhookSecret?: string | null
  settings?: Record<string, any>
  defaultPersonaId?: string | null
}

// Input para actualizar canal (todo opcional)
export interface UpdateChannelInput {
  name?: string
  credentials?: Record<string, any>
  webhookUrl?: string | null
  webhookSecret?: string | null
  settings?: Record<string, any>
  active?: boolean
  defaultPersonaId?: string | null
}

// ─── Contact (tu módulo de contactos usa este tipo) ───
export interface Contact {
  id: string
  organizationId: string
  fullName: string | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  locale: string | null
  timezone: string | null
  channelIdentities: Record<string, any>
  tags: string[]
  customFields: Record<string, any>
  notes: string | null
  firstSeenAt: string | null
  lastSeenAt: string | null
  blocked: boolean
  createdAt: string
  updatedAt: string
}

// ─── Métricas por canal (Sprint 11.5) ───
export interface ChannelMetrics {
  channelId: string
  name: string
  type: ChannelType
  active: boolean
  totalConversations: number
  conversations30d: number
  lastActivityAt: string | null
  avgCsat30d: number | null
  csatCount30d: number
  createdAt: string
}

// ─── Metadata visual por tipo (Sprint 11.5) ───
export interface ChannelTypeMetadata {
  type: ChannelType
  label: string
  icon: string
  description: string
  available: boolean
  availableAt?: string
  tagline: string
  setupDifficulty: 'easy' | 'medium' | 'hard'
  color: string
}

export const CHANNEL_TYPES: ChannelTypeMetadata[] = [
  {
    type: 'web_widget',
    label: 'Widget Web',
    icon: '🌐',
    description: 'Widget embebible en tu sitio web. Tus visitantes chatean directo desde cualquier página.',
    available: true,
    tagline: 'Chat en tu sitio web',
    setupDifficulty: 'easy',
    color: '#0071E3'
  },
  {
    type: 'whatsapp',
    label: 'WhatsApp Business',
    icon: '📱',
    description: 'Recibe y responde mensajes de WhatsApp. Requiere API oficial de Meta.',
    available: false,
    availableAt: 'Sprint 15',
    tagline: 'El canal #1 en LATAM',
    setupDifficulty: 'hard',
    color: '#25D366'
  },
  {
    type: 'telegram',
    label: 'Telegram',
    icon: '✈️',
    description: 'Bot de Telegram con API gratuita. Setup rápido sin aprobaciones.',
    available: false,
    availableAt: 'Sprint 14',
    tagline: 'Setup en 5 minutos',
    setupDifficulty: 'easy',
    color: '#0088CC'
  },
  {
    type: 'instagram',
    label: 'Instagram Direct',
    icon: '📷',
    description: 'Mensajes directos de Instagram. Requiere cuenta Business + Facebook Page.',
    available: false,
    availableAt: 'Sprint 16',
    tagline: 'DMs de Instagram',
    setupDifficulty: 'medium',
    color: '#E4405F'
  },
  {
    type: 'messenger',
    label: 'Facebook Messenger',
    icon: '💬',
    description: 'Mensajes de tu página de Facebook. Requiere Facebook Page con admin access.',
    available: false,
    availableAt: 'Sprint 16',
    tagline: 'Messenger de Facebook',
    setupDifficulty: 'medium',
    color: '#006AFF'
  },
  {
    type: 'email',
    label: 'Email',
    icon: '✉️',
    description: 'Convierte emails entrantes en conversaciones. Soporta Gmail, Outlook y SMTP.',
    available: false,
    availableAt: 'Sprint 18',
    tagline: 'Emails como conversaciones',
    setupDifficulty: 'medium',
    color: '#EA4335'
  },
  {
    type: 'sms',
    label: 'SMS',
    icon: '📱',
    description: 'Mensajes de texto SMS. Requiere proveedor como Twilio.',
    available: false,
    availableAt: 'Sprint 19',
    tagline: 'Mensajes de texto',
    setupDifficulty: 'medium',
    color: '#94a3b8'
  }
]

export function getChannelMetadata(type: ChannelType): ChannelTypeMetadata {
  return CHANNEL_TYPES.find(c => c.type === type) ?? CHANNEL_TYPES[0]
}

// ─── Helper de tiempo ───
export function timeSince(iso: string | null): string {
  if (!iso) return 'Nunca'
  const d = new Date(iso).getTime()
  const now = Date.now()
  const diff = now - d
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Hace unos segundos'
  if (min < 60) return `Hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Hace ${h}h`
  const days = Math.floor(h / 24)
  if (days < 7) return `Hace ${days}d`
  if (days < 30) return `Hace ${Math.floor(days / 7)}sem`
  if (days < 365) return `Hace ${Math.floor(days / 30)}m`
  return `Hace ${Math.floor(days / 365)}a`
}
