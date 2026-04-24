// Ruta: /src/types/widget.types.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 11 · Tipos de configuración del widget web
// ═══════════════════════════════════════════════════════════════

export type PreChatMode = 'required' | 'optional'
export type WidgetPosition = 'right' | 'left'
export type PreChatFieldKey = 'name' | 'email' | 'phone' | 'reason'

export interface WidgetBrandingConfig {
  primary_color: string       // hex
  position: WidgetPosition
  offset_x: number            // px desde el borde
  offset_y: number            // px desde abajo
  logo_url: string | null
  brand_name: string          // texto que aparece como "marca" del chat
  welcome_message: string
  placeholder: string
}

export interface PreChatField {
  key: PreChatFieldKey
  visible: boolean
  required: boolean
  order: number
  label: string
  placeholder?: string
  options?: string[]          // solo para 'reason' (select)
}

export interface PreChatConfig {
  enabled: boolean
  mode: PreChatMode
  title: string
  subtitle: string
  submit_label: string
  skip_label: string
  fields: PreChatField[]
}

export interface PostChatConfig {
  enabled: boolean
  ask_csat: boolean
  title: string
  subtitle: string
  thank_you_message: string
  comment_enabled: boolean
  comment_placeholder: string
}

export interface WidgetSettings {
  branding: WidgetBrandingConfig
  pre_chat: PreChatConfig
  post_chat: PostChatConfig
}

export interface WidgetChannel {
  id: string
  organizationId: string
  name: string
  active: boolean
  settings: WidgetSettings
  createdAt: string
  updatedAt: string
}

// ─── Defaults para formularios nuevos ───

export const DEFAULT_BRANDING: WidgetBrandingConfig = {
  primary_color: '#0071E3',
  position: 'right',
  offset_x: 20,
  offset_y: 20,
  logo_url: null,
  brand_name: 'Asistente',
  welcome_message: '¡Hola! ¿En qué puedo ayudarte?',
  placeholder: 'Escribe tu mensaje...'
}

export const DEFAULT_PRE_CHAT: PreChatConfig = {
  enabled: false,
  mode: 'required',
  title: 'Antes de empezar',
  subtitle: 'Ayúdanos a atenderte mejor',
  submit_label: 'Iniciar conversación',
  skip_label: 'Chatear como invitado',
  fields: [
    { key: 'name',   visible: true,  required: true,  order: 1, label: 'Nombre',    placeholder: 'Tu nombre' },
    { key: 'email',  visible: true,  required: true,  order: 2, label: 'Email',     placeholder: 'tu@email.com' },
    { key: 'phone',  visible: false, required: false, order: 3, label: 'Teléfono',  placeholder: '+1 809 555 0000' },
    { key: 'reason', visible: false, required: false, order: 4, label: 'Motivo',    options: ['Ventas', 'Soporte', 'Facturación', 'Otro'] }
  ]
}

export const DEFAULT_POST_CHAT: PostChatConfig = {
  enabled: false,
  ask_csat: true,
  title: '¿Cómo fue tu atención?',
  subtitle: 'Tu opinión nos ayuda a mejorar',
  thank_you_message: '¡Gracias por tu tiempo!',
  comment_enabled: false,
  comment_placeholder: 'Cuéntanos más (opcional)'
}

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  branding: DEFAULT_BRANDING,
  pre_chat: DEFAULT_PRE_CHAT,
  post_chat: DEFAULT_POST_CHAT
}

/**
 * Merge seguro de settings (por si tenant tiene config parcial).
 * Sprint 11 + futuros: cuando agreguemos campos, este merge previene errores.
 */
export function mergeWidgetSettings(partial: Partial<WidgetSettings> | null | undefined): WidgetSettings {
  if (!partial) return { ...DEFAULT_WIDGET_SETTINGS }
  return {
    branding:  { ...DEFAULT_BRANDING,  ...(partial.branding  ?? {}) },
    pre_chat:  { ...DEFAULT_PRE_CHAT,  ...(partial.pre_chat  ?? {}),
                 fields: partial.pre_chat?.fields && partial.pre_chat.fields.length > 0
                   ? partial.pre_chat.fields
                   : DEFAULT_PRE_CHAT.fields },
    post_chat: { ...DEFAULT_POST_CHAT, ...(partial.post_chat ?? {}) }
  }
}

/**
 * Metadata visual por tipo de campo.
 */
export const FIELD_METADATA: Record<PreChatFieldKey, { icon: string; description: string }> = {
  name:   { icon: '👤', description: 'Nombre del cliente'    },
  email:  { icon: '📧', description: 'Email para seguimiento' },
  phone:  { icon: '📱', description: 'Teléfono (WhatsApp)'    },
  reason: { icon: '🏷️', description: 'Motivo de contacto'    }
}
