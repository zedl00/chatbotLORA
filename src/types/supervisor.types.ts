// Ruta: /src/types/supervisor.types.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 9 · Supervisor Tools · Tipos
// ═══════════════════════════════════════════════════════════════

export type EscalationType = 'sla_breach' | 'takeover' | 'reassign'

export interface Escalation {
  id: string
  organizationId: string
  conversationId: string
  type: EscalationType
  actorId: string | null
  fromUserId: string | null
  toUserId: string | null
  resolved: boolean
  resolvedAt: string | null
  resolvedBy: string | null
  metadata: Record<string, unknown>
  createdAt: string

  // Enriquecido
  contactName?: string | null
  fromUserName?: string | null
  toUserName?: string | null
}

export interface SlaConfig {
  id: string
  organizationId: string
  firstResponseMinutes: number
  resolutionMinutes: number | null
  notifySupervisors: boolean
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateSlaConfigInput {
  firstResponseMinutes?: number
  resolutionMinutes?: number | null
  notifySupervisors?: boolean
  enabled?: boolean
}

/**
 * Config visual para cada tipo de escalation.
 */
export const ESCALATION_TYPE_LABELS: Record<EscalationType, { label: string; emoji: string; color: string }> = {
  sla_breach: { label: 'SLA vencido',       emoji: '🚨', color: '#dc2626' },
  takeover:   { label: 'Toma de control',   emoji: '🦸', color: '#d97706' },
  reassign:   { label: 'Reasignación',      emoji: '🔄', color: '#2563eb' }
}
