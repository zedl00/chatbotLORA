// Ruta: /src/repository/supabase/supervisor.repo.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 9 · Supervisor Tools · Repo
// ═══════════════════════════════════════════════════════════════
import { supabase } from '@/services/supabase.client'
import type { Escalation, EscalationType } from '@/types/supervisor.types'

function toEscalation(r: Record<string, any>): Escalation {
  return {
    id: r.id,
    organizationId: r.organization_id,
    conversationId: r.conversation_id,
    type: r.type,
    actorId: r.actor_id,
    fromUserId: r.from_user_id,
    toUserId: r.to_user_id,
    resolved: r.resolved,
    resolvedAt: r.resolved_at,
    resolvedBy: r.resolved_by,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
    // Enriquecidos (si vienen)
    contactName: r.conversation?.contact?.full_name ?? null,
    fromUserName: r.from_user?.full_name ?? null,
    toUserName: r.to_user?.full_name ?? null
  }
}

export class SupabaseSupervisorRepo {
  /**
   * Ejecuta el takeover: el usuario autenticado toma el control de la conversación.
   */
  async takeover(conversationId: string): Promise<string> {
    const { data, error } = await supabase.rpc('supervisor_takeover', {
      p_conversation_id: conversationId
    })
    if (error) throw error
    return data as string
  }

  /**
   * Envía un whisper (mensaje privado del equipo).
   */
  async sendWhisper(conversationId: string, content: string): Promise<string> {
    const { data, error } = await supabase.rpc('send_whisper', {
      p_conversation_id: conversationId,
      p_content: content
    })
    if (error) throw error
    return data as string
  }

  /**
   * Reasigna la conversación a otro agente (agents.id, no users.id).
   */
  async reassign(conversationId: string, newAgentId: string): Promise<string> {
    const { data, error } = await supabase.rpc('reassign_conversation', {
      p_conversation_id: conversationId,
      p_new_agent_id: newAgentId
    })
    if (error) throw error
    return data as string
  }

  /**
   * Lista escalamientos activos (unresolved) de la org.
   * Incluye contact name y user names para mostrar en UI.
   */
  async listActive(
    organizationId: string,
    typeFilter?: EscalationType
  ): Promise<Escalation[]> {
    let q = supabase
      .from('escalations')
      .select(`
        *,
        conversation:conversations!escalations_conversation_id_fkey(
          contact:contacts!conversations_contact_id_fkey(full_name)
        ),
        from_user:users!escalations_from_user_id_fkey(full_name),
        to_user:users!escalations_to_user_id_fkey(full_name)
      `)
      .eq('organization_id', organizationId)
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50)

    if (typeFilter) {
      q = q.eq('type', typeFilter)
    }

    const { data, error } = await q
    if (error) throw error
    return (data ?? []).map(toEscalation)
  }

  async countActive(organizationId: string): Promise<number> {
    const { count, error } = await supabase
      .from('escalations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('resolved', false)

    if (error) throw error
    return count ?? 0
  }

  /**
   * Marcar un escalation como resuelto manualmente (si el supervisor ya lo vio).
   */
  async markResolved(escalationId: string): Promise<void> {
    const { error } = await supabase
      .from('escalations')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString()
      })
      .eq('id', escalationId)
    if (error) throw error
  }

  /**
   * Suscribirse a nuevos escalamientos de la org (realtime).
   */
  subscribeToEscalations(
    organizationId: string,
    onNew: (row: any) => void
  ): () => void {
    const channel = supabase
      .channel(`escalations-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'escalations',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => onNew(payload.new)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }
}
