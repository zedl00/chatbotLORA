// Ruta: /src/types/analytics.types.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 10 · Analytics tipos
// ═══════════════════════════════════════════════════════════════

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_year'
  | 'custom'

export interface DateRange {
  preset: DateRangePreset
  start: Date
  end: Date
  previousStart: Date
  previousEnd: Date
}

export interface AnalyticsFilters {
  range: DateRange
  agentId?: string | null
  channelType?: string | null
  status?: string | null
  priority?: number | null
  teamId?: string | null
}

export interface ConversationAnalytics {
  id: string
  organizationId: string
  status: string
  channelType: string
  channelId: string | null
  priority: number
  teamId: string | null
  tags: string[]
  agentId: string | null
  agentUserId: string | null
  agentName: string | null
  contactId: string | null
  csatScore: number | null
  aiTokensUsed: number
  createdAt: string
  handoffAt: string | null
  assignedAt: string | null
  firstResponseAt: string | null
  resolvedAt: string | null
  frtSeconds: number | null
  resolutionSeconds: number | null
  wasHandoffed: boolean
  hasHumanAgent: boolean
}

export interface AnalyticsSummary {
  // Período actual
  total: number
  resolved: number
  open: number
  pending: number
  abandoned: number
  avgFrtSeconds: number | null
  avgResolutionSeconds: number | null
  avgCsat: number | null
  csatRatingsCount: number
  totalAiTokens: number
  handoffRate: number  // % de conversaciones que pasaron a humano
  resolutionRate: number  // % resolved / total

  // Período anterior (para comparar)
  previousTotal: number
  previousResolved: number
  previousAvgFrtSeconds: number | null
  previousAvgCsat: number | null

  // Deltas calculados
  totalDeltaPercent: number
  resolvedDeltaPercent: number
  frtDeltaSeconds: number | null
  csatDelta: number | null
}

export interface DailyVolumePoint {
  date: string     // YYYY-MM-DD
  current: number  // conversaciones creadas ese día
  previous: number // mismo día pero del período anterior (para overlay)
}

export interface AgentMetric {
  agentId: string
  userId: string
  agentName: string
  agentEmail: string
  teamId: string | null
  totalConversations: number
  resolvedCount: number
  abandonedCount: number
  openCount: number
  avgCsat: number | null
  csatRatingsCount: number
  avgFrtSeconds: number | null
  avgResolutionSeconds: number | null
  lastActivityAt: string | null
}

export interface LeaderboardEntry extends AgentMetric {
  rank: number
  rankChange: number | null  // diff con período anterior (+5, -2, 0)
  score: number  // score compuesto para ordenar
}

export interface HeatmapCell {
  dayOfWeek: number   // 0=domingo, 1=lunes, ..., 6=sábado
  hourOfDay: number   // 0-23
  count: number
}

export interface StatusDistribution {
  open: number
  pending: number
  resolved: number
  abandoned: number
}

export interface ChannelDistribution {
  channelType: string
  count: number
}

/**
 * Para el radar chart: perfil del agente normalizado 0-100
 */
export interface AgentRadarProfile {
  agentId: string
  agentName: string
  volume: number      // 0-100, normalizado
  speed: number       // 0-100 (FRT inverso)
  quality: number     // 0-100 (CSAT × 20)
  ai_usage: number    // 0-100 (% handoff)
  resolution: number  // 0-100 (% resolved)
}

// ─── Date range helpers ───

export const DATE_PRESET_LABELS: Record<DateRangePreset, string> = {
  today:        'Hoy',
  yesterday:    'Ayer',
  this_week:    'Esta semana',
  last_week:    'Semana anterior',
  this_month:   'Este mes',
  last_month:   'Mes anterior',
  last_7_days:  'Últimos 7 días',
  last_30_days: 'Últimos 30 días',
  last_90_days: 'Últimos 90 días',
  this_year:    'Este año',
  custom:       'Personalizado'
}

/**
 * Calcula el rango de fechas a partir de un preset.
 */
export function computeDateRange(preset: DateRangePreset, customStart?: Date, customEnd?: Date): DateRange {
  const now = new Date()
  let start: Date, end: Date

  if (preset === 'custom' && customStart && customEnd) {
    start = new Date(customStart)
    start.setHours(0, 0, 0, 0)
    end = new Date(customEnd)
    end.setHours(23, 59, 59, 999)
  } else {
    switch (preset) {
      case 'today':
        start = new Date(now); start.setHours(0, 0, 0, 0)
        end = new Date(now); end.setHours(23, 59, 59, 999)
        break
      case 'yesterday':
        start = new Date(now); start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0)
        end = new Date(now); end.setDate(end.getDate() - 1); end.setHours(23, 59, 59, 999)
        break
      case 'this_week': {
        start = new Date(now)
        const day = start.getDay() // 0=dom
        const diff = start.getDate() - day + (day === 0 ? -6 : 1) // lunes
        start.setDate(diff); start.setHours(0, 0, 0, 0)
        end = new Date(now); end.setHours(23, 59, 59, 999)
        break
      }
      case 'last_week': {
        const last = new Date(now); last.setDate(last.getDate() - 7)
        start = new Date(last)
        const day = start.getDay()
        start.setDate(start.getDate() - day + (day === 0 ? -6 : 1))
        start.setHours(0, 0, 0, 0)
        end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999)
        break
      }
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
        end = new Date(now); end.setHours(23, 59, 59, 999)
        break
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
        break
      case 'last_7_days':
        start = new Date(now); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0)
        end = new Date(now); end.setHours(23, 59, 59, 999)
        break
      case 'last_30_days':
        start = new Date(now); start.setDate(start.getDate() - 30); start.setHours(0, 0, 0, 0)
        end = new Date(now); end.setHours(23, 59, 59, 999)
        break
      case 'last_90_days':
        start = new Date(now); start.setDate(start.getDate() - 90); start.setHours(0, 0, 0, 0)
        end = new Date(now); end.setHours(23, 59, 59, 999)
        break
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
        end = new Date(now); end.setHours(23, 59, 59, 999)
        break
      default:
        start = new Date(now); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0)
        end = new Date(now); end.setHours(23, 59, 59, 999)
    }
  }

  // Período anterior: misma duración justo antes del start actual
  const durationMs = end.getTime() - start.getTime()
  const previousEnd = new Date(start.getTime() - 1) // 1ms antes del start
  const previousStart = new Date(previousEnd.getTime() - durationMs)

  return { preset, start, end, previousStart, previousEnd }
}

export const DAY_OF_WEEK_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
export const DAY_OF_WEEK_FULL   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Helpers de formato
export function formatSeconds(s: number | null): string {
  if (s === null || s === undefined || isNaN(s)) return '—'
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  const remain = Math.round(s % 60)
  if (m < 60) return `${m}m ${remain}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function formatPercent(n: number, decimals = 0): string {
  if (isNaN(n)) return '—'
  return `${n.toFixed(decimals)}%`
}
