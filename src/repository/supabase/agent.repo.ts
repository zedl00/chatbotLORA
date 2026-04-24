// Ruta: /src/repository/supabase/agent.repo.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 7.5 + 8 · Repository para agentes
//
// Incluye:
//   - Listar agentes live (desde v_agents_live)
//   - Cambiar estado manualmente (online/busy/away/offline)
//   - Heartbeat para mantener "online"
//   - Update de config (maxChats, skills, autoAssign)
// ═══════════════════════════════════════════════════════════════
import { supabase } from '@/services/supabase.client'
import type {
  Agent,
  AgentLive,
  AgentStatus
} from '@/types/agent.types'

function toAgent(r: any): Agent {
  return {
    id: r.id,
    userId: r.user_id,
    organizationId: r.organization_id,
    teamId: r.team_id,
    status: r.status,
    statusMessage: r.status_message,
    maxConcurrentChats: r.max_concurrent_chats ?? 5,
    autoAssign: r.auto_assign ?? true,
    skills: r.skills ?? [],
    workingHours: r.working_hours ?? {},
    slaTier: r.sla_tier ?? 'standard',
    statusChangedAt: r.status_changed_at,
    lastActivityAt: r.last_activity_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function toAgentLive(r: any): AgentLive {
  return {
    agentId: r.agent_id,
    userId: r.user_id,
    organizationId: r.organization_id,
    teamId: r.team_id,
    status: r.status,
    statusMessage: r.status_message,
    statusChangedAt: r.status_changed_at,
    lastActivityAt: r.last_activity_at,
    maxConcurrentChats: r.max_concurrent_chats ?? 5,
    autoAssign: r.auto_assign ?? true,
    skills: r.skills ?? [],
    email: r.email,
    fullName: r.full_name,
    avatarUrl: r.avatar_url,
    userActive: r.user_active,
    teamName: r.team_name,
    teamColor: r.team_color,
    activeConversations: r.active_conversations ?? 0,
    atCapacity: r.at_capacity ?? false
  }
}

export class SupabaseAgentRepo {
  // ───── Listar agentes live ─────
  async listAgentsLive(organizationId: string): Promise<AgentLive[]> {
    const { data, error } = await supabase
      .from('v_agents_live')
      .select('*')
      .eq('organization_id', organizationId)
      .order('status', { ascending: true })  // online primero alfabéticamente
      .order('full_name', { ascending: true })
    if (error) throw error
    return (data ?? []).map(toAgentLive)
  }

  // ───── Obtener mi propio agent record ─────
  async getMyAgent(userId: string): Promise<Agent | null> {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data ? toAgent(data) : null
  }

  // ───── Heartbeat: mantener "online" ─────
  async heartbeat(userId: string): Promise<void> {
    const { error } = await supabase.rpc('agent_heartbeat', { p_user_id: userId })
    if (error) throw error
  }

  // ───── Cambiar estado manualmente ─────
  async setStatus(
    userId: string,
    status: AgentStatus,
    message: string | null = null
  ): Promise<void> {
    const { error } = await supabase.rpc('agent_set_status', {
      p_user_id: userId,
      p_status: status,
      p_status_message: message
    })
    if (error) throw error
  }

  // ───── Update configuración del agente ─────
  async updateAgent(
    agentId: string,
    input: Partial<Pick<Agent, 'maxConcurrentChats' | 'autoAssign' | 'skills' | 'teamId' | 'slaTier'>>
  ): Promise<Agent> {
    const patch: Record<string, any> = {}
    if (input.maxConcurrentChats !== undefined) patch.max_concurrent_chats = input.maxConcurrentChats
    if (input.autoAssign !== undefined)         patch.auto_assign = input.autoAssign
    if (input.skills !== undefined)             patch.skills = input.skills
    if (input.teamId !== undefined)             patch.team_id = input.teamId
    if (input.slaTier !== undefined)            patch.sla_tier = input.slaTier

    const { data, error } = await supabase
      .from('agents')
      .update(patch)
      .eq('id', agentId)
      .select()
      .single()
    if (error) throw error
    return toAgent(data)
  }

  // ───── Suscripción realtime a cambios en agents ─────
  subscribeToAgentStatus(
    organizationId: string,
    onUpdate: (agent: any) => void
  ): () => void {
    const channel = supabase
      .channel(`agents-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agents',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => onUpdate(payload.new)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }
}
