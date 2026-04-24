// Ruta: /src/types/agent.types.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 7.5 + 8 · Tipos de agentes y quick replies
// ═══════════════════════════════════════════════════════════════

export type AgentStatus = 'online' | 'busy' | 'away' | 'offline'

/**
 * Registro base de un agente.
 * Refleja la tabla `agents` en Postgres.
 */
export interface Agent {
  id: string
  userId: string
  organizationId: string
  teamId: string | null
  status: AgentStatus
  statusMessage: string | null
  maxConcurrentChats: number
  autoAssign: boolean
  skills: string[]
  workingHours: Record<string, unknown>
  slaTier: string
  statusChangedAt: string
  lastActivityAt: string
  createdAt: string
  updatedAt: string
}

/**
 * Agente enriquecido con datos del user y del team.
 * Refleja la vista `v_agents_live`.
 */
export interface AgentLive {
  agentId: string
  userId: string
  organizationId: string
  teamId: string | null
  status: AgentStatus
  statusMessage: string | null
  statusChangedAt: string
  lastActivityAt: string
  maxConcurrentChats: number
  autoAssign: boolean
  skills: string[]
  // From users
  email: string
  fullName: string | null
  avatarUrl: string | null
  userActive: boolean
  // From teams
  teamName: string | null
  teamColor: string | null
  // Computed
  activeConversations: number
  atCapacity: boolean
}

/**
 * Labels visuales de cada estado.
 */
export const AGENT_STATUS_LABELS: Record<AgentStatus, { label: string; color: string; emoji: string }> = {
  online:  { label: 'En línea',  color: '#10b981', emoji: '🟢' },
  busy:    { label: 'Ocupado',   color: '#f59e0b', emoji: '🟡' },
  away:    { label: 'Ausente',   color: '#94a3b8', emoji: '⚪' },
  offline: { label: 'Desconectado', color: '#64748b', emoji: '⚫' }
}

// ═══════════════════════════════════════════════════════════════
// Quick Replies
// ═══════════════════════════════════════════════════════════════

export interface QuickReply {
  id: string
  organizationId: string
  ownerId: string
  shortcut: string          // "saludo" → se invoca con /saludo
  title: string             // "Saludo inicial"
  content: string           // "Hola, ¿en qué puedo ayudarte?"
  category: string | null   // "saludo", "despedida", "pago", "técnico"
  isShared: boolean         // false = personal, true = compartida con el equipo
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateQuickReplyInput {
  organizationId: string
  ownerId: string
  shortcut: string
  title: string
  content: string
  category?: string | null
  isShared?: boolean
}

export interface UpdateQuickReplyInput {
  shortcut?: string
  title?: string
  content?: string
  category?: string | null
  isShared?: boolean
}

export const QUICK_REPLY_CATEGORIES = [
  { value: 'saludo',       label: 'Saludo',       emoji: '👋' },
  { value: 'despedida',    label: 'Despedida',    emoji: '👋' },
  { value: 'pago',         label: 'Pago',         emoji: '💳' },
  { value: 'tecnico',      label: 'Técnico',      emoji: '🔧' },
  { value: 'ventas',       label: 'Ventas',       emoji: '💼' },
  { value: 'soporte',      label: 'Soporte',      emoji: '🛟' },
  { value: 'informacion',  label: 'Información',  emoji: 'ℹ️' },
  { value: 'otro',         label: 'Otro',         emoji: '📌' }
] as const

export type QuickReplyCategory = typeof QUICK_REPLY_CATEGORIES[number]['value']
