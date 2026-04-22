// Ruta: /src/utils/constants.ts
import type { ChannelType } from '@/types/channel.types'
import type { UserRole } from '@/types/user.types'

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  whatsapp:   'WhatsApp',
  instagram:  'Instagram',
  messenger:  'Messenger',
  telegram:   'Telegram',
  web_widget: 'Widget Web',
  sms:        'SMS',
  email:      'Email'
}

export const CHANNEL_ICONS: Record<ChannelType, string> = {
  whatsapp:   '🟢',
  instagram:  '📷',
  messenger:  '💬',
  telegram:   '✈️',
  web_widget: '🌐',
  sms:        '📱',
  email:      '📧'
}

export const CHANNEL_COLORS: Record<ChannelType, string> = {
  whatsapp:   '#25D366',
  instagram:  '#E1306C',
  messenger:  '#0084FF',
  telegram:   '#26A5E4',
  web_widget: '#2b7bff',
  sms:        '#94a3b8',
  email:      '#64748b'
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin:       'Administrador',
  supervisor:  'Supervisor',
  agent:       'Agente'
}

export const CONVERSATION_STATUS_LABELS = {
  open:      'Abierta',
  pending:   'Pendiente',
  resolved:  'Resuelta',
  abandoned: 'Abandonada'
} as const

export const AGENT_STATUS_LABELS = {
  online:  'En línea',
  busy:    'Ocupado',
  away:    'Ausente',
  offline: 'Desconectado'
} as const

export const AGENT_STATUS_COLORS = {
  online:  '#10b981',
  busy:    '#ef4444',
  away:    '#f59e0b',
  offline: '#94a3b8'
} as const
