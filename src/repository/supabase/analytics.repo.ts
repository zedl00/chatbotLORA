// Ruta: /src/repository/supabase/analytics.repo.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 10 · Analytics Repository
//
// Estrategia: en vez de N queries, 1 query grande que trae todas las
// conversaciones del período y calculamos en frontend. Es más simple
// y para <5000 conversaciones es instantáneo.
// ═══════════════════════════════════════════════════════════════
import { supabase } from '@/services/supabase.client'
import type {
  AnalyticsFilters,
  AnalyticsSummary,
  ConversationAnalytics,
  DailyVolumePoint,
  AgentMetric,
  HeatmapCell
} from '@/types/analytics.types'

function toConversationAnalytics(r: Record<string, any>): ConversationAnalytics {
  return {
    id: r.id,
    organizationId: r.organization_id,
    status: r.status,
    channelType: r.channel_type,
    channelId: r.channel_id,
    priority: r.priority ?? 0,
    teamId: r.team_id,
    tags: r.tags ?? [],
    agentId: r.agent_id,
    agentUserId: r.agent_user_id,
    agentName: r.agent_name,
    contactId: r.contact_id,
    csatScore: r.csat_score,
    aiTokensUsed: r.ai_tokens_used ?? 0,
    createdAt: r.created_at,
    handoffAt: r.handoff_at,
    assignedAt: r.assigned_at,
    firstResponseAt: r.first_response_at,
    resolvedAt: r.resolved_at,
    frtSeconds: r.frt_seconds,
    resolutionSeconds: r.resolution_seconds,
    wasHandoffed: r.was_handoffed ?? false,
    hasHumanAgent: r.has_human_agent ?? false
  }
}

export class SupabaseAnalyticsRepo {
  /**
   * Obtener conversaciones para analytics con filtros.
   * Trae ambos períodos (actual + anterior) para comparación.
   */
  async fetchConversations(
    organizationId: string,
    filters: AnalyticsFilters
  ): Promise<{ current: ConversationAnalytics[]; previous: ConversationAnalytics[] }> {
    const { range } = filters

    // Query con rango ampliado para cubrir ambos períodos
    let q = supabase
      .from('v_conversations_analytics')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('created_at', range.previousStart.toISOString())
      .lte('created_at', range.end.toISOString())

    // Aplicar filtros adicionales
    if (filters.agentId) q = q.eq('agent_id', filters.agentId)
    if (filters.channelType) q = q.eq('channel_type', filters.channelType)
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.priority !== undefined && filters.priority !== null) q = q.eq('priority', filters.priority)
    if (filters.teamId) q = q.eq('team_id', filters.teamId)

    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) throw error

    const all = (data ?? []).map(toConversationAnalytics)

    // Separar en períodos
    const current: ConversationAnalytics[] = []
    const previous: ConversationAnalytics[] = []
    const startTs = range.start.getTime()
    const prevEndTs = range.previousEnd.getTime()

    for (const c of all) {
      const ts = new Date(c.createdAt).getTime()
      if (ts >= startTs) {
        current.push(c)
      } else if (ts <= prevEndTs) {
        previous.push(c)
      }
    }

    return { current, previous }
  }

  /**
   * Calcula summary comparando ambos períodos.
   */
  computeSummary(
    current: ConversationAnalytics[],
    previous: ConversationAnalytics[]
  ): AnalyticsSummary {
    // Actual
    const total = current.length
    const resolved = current.filter(c => c.status === 'resolved').length
    const open = current.filter(c => c.status === 'open').length
    const pending = current.filter(c => c.status === 'pending').length
    const abandoned = current.filter(c => c.status === 'abandoned').length

    const frts = current.filter(c => c.frtSeconds != null).map(c => c.frtSeconds!)
    const avgFrtSeconds = frts.length > 0 ? frts.reduce((s, v) => s + v, 0) / frts.length : null

    const resolutions = current.filter(c => c.resolutionSeconds != null).map(c => c.resolutionSeconds!)
    const avgResolutionSeconds = resolutions.length > 0 ? resolutions.reduce((s, v) => s + v, 0) / resolutions.length : null

    const csats = current.filter(c => c.csatScore != null).map(c => c.csatScore!)
    const avgCsat = csats.length > 0 ? csats.reduce((s, v) => s + v, 0) / csats.length : null

    const totalAiTokens = current.reduce((s, c) => s + (c.aiTokensUsed ?? 0), 0)
    const withHumanAgent = current.filter(c => c.hasHumanAgent).length
    const handoffRate = total > 0 ? (withHumanAgent / total) * 100 : 0
    const resolutionRate = total > 0 ? (resolved / total) * 100 : 0

    // Anterior
    const previousTotal = previous.length
    const previousResolved = previous.filter(c => c.status === 'resolved').length

    const prevFrts = previous.filter(c => c.frtSeconds != null).map(c => c.frtSeconds!)
    const previousAvgFrtSeconds = prevFrts.length > 0 ? prevFrts.reduce((s, v) => s + v, 0) / prevFrts.length : null

    const prevCsats = previous.filter(c => c.csatScore != null).map(c => c.csatScore!)
    const previousAvgCsat = prevCsats.length > 0 ? prevCsats.reduce((s, v) => s + v, 0) / prevCsats.length : null

    // Deltas
    const totalDeltaPercent = previousTotal > 0
      ? ((total - previousTotal) / previousTotal) * 100
      : 0
    const resolvedDeltaPercent = previousResolved > 0
      ? ((resolved - previousResolved) / previousResolved) * 100
      : 0
    const frtDeltaSeconds = (avgFrtSeconds !== null && previousAvgFrtSeconds !== null)
      ? avgFrtSeconds - previousAvgFrtSeconds
      : null
    const csatDelta = (avgCsat !== null && previousAvgCsat !== null)
      ? avgCsat - previousAvgCsat
      : null

    return {
      total, resolved, open, pending, abandoned,
      avgFrtSeconds, avgResolutionSeconds, avgCsat,
      csatRatingsCount: csats.length,
      totalAiTokens, handoffRate, resolutionRate,
      previousTotal, previousResolved, previousAvgFrtSeconds, previousAvgCsat,
      totalDeltaPercent, resolvedDeltaPercent, frtDeltaSeconds, csatDelta
    }
  }

  /**
   * Agrupa por día para línea chart.
   */
  computeDailyVolume(
    current: ConversationAnalytics[],
    previous: ConversationAnalytics[],
    startDate: Date,
    endDate: Date
  ): DailyVolumePoint[] {
    const result: DailyVolumePoint[] = []
    const ms = 24 * 60 * 60 * 1000

    // Contar por día en ambos períodos
    const currentByDay = new Map<string, number>()
    const previousByDay = new Map<string, number>()

    for (const c of current) {
      const key = c.createdAt.slice(0, 10)
      currentByDay.set(key, (currentByDay.get(key) ?? 0) + 1)
    }

    // Para el período anterior, mapear a la misma posición relativa del período actual
    const periodDuration = endDate.getTime() - startDate.getTime()
    for (const c of previous) {
      const relativePos = new Date(c.createdAt).getTime() - (startDate.getTime() - periodDuration)
      const mappedDate = new Date(startDate.getTime() + relativePos)
      const key = mappedDate.toISOString().slice(0, 10)
      previousByDay.set(key, (previousByDay.get(key) ?? 0) + 1)
    }

    // Generar serie completa día por día
    let cursor = new Date(startDate)
    cursor.setHours(0, 0, 0, 0)
    const last = new Date(endDate)
    last.setHours(0, 0, 0, 0)

    while (cursor.getTime() <= last.getTime()) {
      const key = cursor.toISOString().slice(0, 10)
      result.push({
        date: key,
        current: currentByDay.get(key) ?? 0,
        previous: previousByDay.get(key) ?? 0
      })
      cursor = new Date(cursor.getTime() + ms)
    }

    return result
  }

  /**
   * Métricas agregadas por agente (desde v_agent_metrics)
   * filtrada al período solicitado usando los datos raw.
   */
  computeAgentMetrics(current: ConversationAnalytics[]): AgentMetric[] {
    const grouped = new Map<string, ConversationAnalytics[]>()

    for (const c of current) {
      if (!c.agentId) continue
      if (!grouped.has(c.agentId)) grouped.set(c.agentId, [])
      grouped.get(c.agentId)!.push(c)
    }

    const result: AgentMetric[] = []
    for (const [agentId, convs] of grouped) {
      const resolved = convs.filter(c => c.status === 'resolved')
      const frts = convs.filter(c => c.frtSeconds != null).map(c => c.frtSeconds!)
      const resolutions = convs.filter(c => c.resolutionSeconds != null).map(c => c.resolutionSeconds!)
      const csats = convs.filter(c => c.csatScore != null).map(c => c.csatScore!)

      result.push({
        agentId,
        userId: convs[0].agentUserId ?? '',
        agentName: convs[0].agentName ?? 'Sin nombre',
        agentEmail: '',
        teamId: convs[0].teamId,
        totalConversations: convs.length,
        resolvedCount: resolved.length,
        abandonedCount: convs.filter(c => c.status === 'abandoned').length,
        openCount: convs.filter(c => c.status === 'open').length,
        avgCsat: csats.length > 0 ? csats.reduce((s, v) => s + v, 0) / csats.length : null,
        csatRatingsCount: csats.length,
        avgFrtSeconds: frts.length > 0 ? frts.reduce((s, v) => s + v, 0) / frts.length : null,
        avgResolutionSeconds: resolutions.length > 0 ? resolutions.reduce((s, v) => s + v, 0) / resolutions.length : null,
        lastActivityAt: convs.reduce((max, c) => (c.createdAt > max ? c.createdAt : max), '')
      })
    }

    return result.sort((a, b) => b.resolvedCount - a.resolvedCount)
  }

  /**
   * Heatmap día × hora.
   */
  computeHeatmap(current: ConversationAnalytics[]): HeatmapCell[] {
    const grid = new Map<string, number>()

    for (const c of current) {
      const d = new Date(c.createdAt)
      const key = `${d.getDay()}-${d.getHours()}`
      grid.set(key, (grid.get(key) ?? 0) + 1)
    }

    const result: HeatmapCell[] = []
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`
        result.push({
          dayOfWeek: day,
          hourOfDay: hour,
          count: grid.get(key) ?? 0
        })
      }
    }
    return result
  }

  /**
   * Lista de agentes para filtro.
   */
  async listAgentsForFilter(organizationId: string): Promise<{ agentId: string; name: string }[]> {
    const { data, error } = await supabase
      .from('agents')
      .select('id, user:users!agents_user_id_fkey(full_name, email)')
      .eq('organization_id', organizationId)

    if (error) throw error
    return (data ?? []).map((r: any) => ({
      agentId: r.id,
      name: r.user?.full_name || r.user?.email || 'Sin nombre'
    }))
  }

  /**
   * Lista de teams para filtro.
   */
  async listTeamsForFilter(organizationId: string): Promise<{ teamId: string; name: string }[]> {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name')
      .eq('organization_id', organizationId)

    if (error) {
      // Si la tabla teams no existe, devuelve array vacío en vez de romper
      console.warn('[analytics.repo] listTeamsForFilter:', error.message)
      return []
    }
    return (data ?? []).map((r: any) => ({ teamId: r.id, name: r.name }))
  }
}
