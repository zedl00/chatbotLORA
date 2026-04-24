// Ruta: /src/repository/supabase/channels.repo.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 11.5 · Channels repository
// ═══════════════════════════════════════════════════════════════
import { supabase } from '@/services/supabase.client'
import type { Channel, ChannelMetrics, CreateChannelInput } from '@/types/channel.types'

function toChannel(r: Record<string, any>): Channel {
  return {
    id: r.id,
    organizationId: r.organization_id,
    type: r.type,
    name: r.name,
    active: r.active,
    settings: r.settings ?? {},
    defaultPersonaId: r.default_persona_id,
    externalId: r.external_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function toChannelMetrics(r: Record<string, any>): ChannelMetrics {
  return {
    channelId: r.channel_id,
    name: r.name,
    type: r.type,
    active: r.active,
    totalConversations: Number(r.total_conversations ?? 0),
    conversations30d: Number(r.conversations_30d ?? 0),
    lastActivityAt: r.last_activity_at,
    avgCsat30d: r.avg_csat_30d !== null ? Number(r.avg_csat_30d) : null,
    csatCount30d: Number(r.csat_count_30d ?? 0),
    createdAt: r.created_at
  }
}

export class SupabaseChannelsRepo {
  /**
   * Lista canales + sus métricas (usa vista v_channel_metrics).
   */
  async listWithMetrics(organizationId: string): Promise<ChannelMetrics[]> {
    const { data, error } = await supabase
      .from('v_channel_metrics')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []).map(toChannelMetrics)
  }

  /**
   * Obtener canal individual.
   */
  async getById(id: string): Promise<Channel | null> {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data ? toChannel(data) : null
  }

  /**
   * Crear canal nuevo.
   */
  async create(organizationId: string, input: CreateChannelInput): Promise<Channel> {
    // Default settings mínimo - el WidgetConfigView se encargará del resto
    const defaultSettings = input.type === 'web_widget'
      ? { branding: { primary_color: '#0071E3', position: 'right' } }
      : {}

    const { data, error } = await supabase
      .from('channels')
      .insert({
        organization_id: organizationId,
        type: input.type,
        name: input.name,
        active: true,
        settings: defaultSettings,
        default_persona_id: input.defaultPersonaId ?? null
      })
      .select()
      .single()

    if (error) throw error
    return toChannel(data)
  }

  /**
   * Renombrar canal.
   */
  async rename(id: string, newName: string): Promise<Channel> {
    const { data, error } = await supabase
      .from('channels')
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return toChannel(data)
  }

  /**
   * Activar/desactivar canal.
   */
  async setActive(id: string, active: boolean): Promise<Channel> {
    const { data, error } = await supabase
      .from('channels')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return toChannel(data)
  }

  /**
   * Duplicar canal (clona settings pero conversaciones NO se copian).
   */
  async duplicate(id: string): Promise<Channel> {
    const source = await this.getById(id)
    if (!source) throw new Error('Canal fuente no encontrado')

    const { data, error } = await supabase
      .from('channels')
      .insert({
        organization_id: source.organizationId,
        type: source.type,
        name: `${source.name} (copia)`,
        active: true,
        settings: source.settings,
        default_persona_id: source.defaultPersonaId
      })
      .select()
      .single()

    if (error) throw error
    return toChannel(data)
  }

  /**
   * Eliminar canal (solo si no tiene conversaciones).
   * Devuelve { deleted: boolean, reason?: string }
   */
  async deleteChannel(id: string): Promise<{ deleted: boolean; reason?: string }> {
    // Verificar conversaciones
    const { count, error: countError } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', id)

    if (countError) throw countError

    if ((count ?? 0) > 0) {
      return {
        deleted: false,
        reason: `No se puede eliminar: este canal tiene ${count} conversaciones. Desactívalo en su lugar.`
      }
    }

    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { deleted: true }
  }
}
