// Ruta: /src/repository/supabase/agent.repo.ts
import { supabase } from '@/services/supabase.client'
import type { IRepository } from '../base.repository'
import type { Agent, AgentWithUser, AgentStatus } from '@/types/agent.types'
import type { PaginatedResult } from '@/types/api.types'

function toAgent(row: Record<string, any>): Agent {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    teamId: row.team_id,
    status: row.status,
    statusMessage: row.status_message,
    maxConcurrentChats: row.max_concurrent_chats,
    autoAssign: row.auto_assign,
    skills: row.skills ?? [],
    workingHours: row.working_hours ?? {},
    slaTier: row.sla_tier,
    statusChangedAt: row.status_changed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toAgentWithUser(row: Record<string, any>): AgentWithUser {
  return {
    ...toAgent(row),
    user: {
      id: row.users.id,
      fullName: row.users.full_name,
      email: row.users.email,
      avatarUrl: row.users.avatar_url,
      role: row.users.role
    }
  }
}

export class SupabaseAgentRepo implements IRepository<Agent> {
  async findById(id: string): Promise<Agent | null> {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? toAgent(data) : null
  }

  async findByUserId(userId: string): Promise<Agent | null> {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data ? toAgent(data) : null
  }

  async findMany(params: {
    filters?: Record<string, unknown>
    limit?: number
    offset?: number
  } = {}): Promise<PaginatedResult<Agent>> {
    const { limit = 50, offset = 0 } = params
    let q = supabase.from('agents').select('*', { count: 'exact' })

    if (params.filters) {
      for (const [k, v] of Object.entries(params.filters)) {
        if (v !== undefined && v !== null) q = q.eq(k, v as any)
      }
    }

    q = q.range(offset, offset + limit - 1)
    const { data, error, count } = await q
    if (error) throw error

    return {
      data: (data ?? []).map(toAgent),
      count: count ?? 0,
      hasMore: (count ?? 0) > offset + limit
    }
  }

  /**
   * Lista agentes con datos del user join. Útil para vista de equipo.
   */
  async findManyWithUser(organizationId: string): Promise<AgentWithUser[]> {
    const { data, error } = await supabase
      .from('agents')
      .select('*, users!inner(id, full_name, email, avatar_url, role)')
      .eq('organization_id', organizationId)
      .order('status', { ascending: true })

    if (error) throw error
    return (data ?? []).map(toAgentWithUser)
  }

  async create(input: Partial<Agent>): Promise<Agent> {
    const { data, error } = await supabase
      .from('agents')
      .insert({
        user_id: input.userId,
        organization_id: input.organizationId,
        team_id: input.teamId,
        max_concurrent_chats: input.maxConcurrentChats ?? 5,
        auto_assign: input.autoAssign ?? true,
        skills: input.skills ?? [],
        working_hours: input.workingHours ?? {},
        sla_tier: input.slaTier ?? 'standard'
      })
      .select()
      .single()

    if (error) throw error
    return toAgent(data)
  }

  async update(id: string, input: Partial<Agent>): Promise<Agent> {
    const patch: Record<string, any> = {}
    if (input.teamId !== undefined)              patch.team_id = input.teamId
    if (input.status !== undefined)              patch.status = input.status
    if (input.statusMessage !== undefined)       patch.status_message = input.statusMessage
    if (input.maxConcurrentChats !== undefined)  patch.max_concurrent_chats = input.maxConcurrentChats
    if (input.autoAssign !== undefined)          patch.auto_assign = input.autoAssign
    if (input.skills !== undefined)              patch.skills = input.skills
    if (input.workingHours !== undefined)        patch.working_hours = input.workingHours
    if (input.slaTier !== undefined)             patch.sla_tier = input.slaTier

    if (input.status !== undefined) patch.status_changed_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('agents')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return toAgent(data)
  }

  async updateStatus(userId: string, status: AgentStatus): Promise<void> {
    const { error } = await supabase
      .from('agents')
      .update({ status, status_changed_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (error) throw error
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('agents').delete().eq('id', id)
    if (error) throw error
  }
}
