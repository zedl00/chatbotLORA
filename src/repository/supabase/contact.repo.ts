// Ruta: /src/repository/supabase/contact.repo.ts
// ═══════════════════════════════════════════════════════════════
// MODIFICADO en Sprint 7.5 (Entrega 2):
//   - Nueva firma listContacts con búsqueda + filtros
//   - Nuevo método: countByOrganization
//   - Nuevo método: listConversationsByContact
//   - Nuevo método: listAllTags
//
// FIX post-entrega2:
//   - listConversationsByContact: agent_id apunta a 'agents', NO a 'users'.
//     Doble embed: conversations → agents → users para obtener el full_name.
// ═══════════════════════════════════════════════════════════════
import { supabase } from '@/services/supabase.client'
import type { IRepository } from '../base.repository'
import type { Contact, ChannelType } from '@/types/channel.types'
import type { PaginatedResult } from '@/types/api.types'

function toContact(r: Record<string, any>): Contact {
  return {
    id: r.id,
    organizationId: r.organization_id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    avatarUrl: r.avatar_url,
    locale: r.locale,
    timezone: r.timezone,
    channelIdentities: r.channel_identities ?? {},
    tags: r.tags ?? [],
    customFields: r.custom_fields ?? {},
    notes: r.notes,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    blocked: r.blocked,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export interface ContactFilters {
  search?: string           // busca en full_name, email, phone
  channelType?: ChannelType // filtra por canal
  tag?: string              // filtra por tag
  blocked?: boolean
  limit?: number
  offset?: number
}

export interface ContactStats {
  total: number
  newThisWeek: number
  blocked: number
}

/**
 * Entrada resumida del historial de conversaciones de un contacto.
 */
export interface ContactConversationSummary {
  id: string
  status: string
  channelType: string | null
  subject: string | null
  tags: string[]
  priority: number
  agentId: string | null       // agents.id (NO users.id)
  agentName: string | null
  lastMessagePreview: string | null
  lastMessageAt: string | null
  csatScore: number | null
  resolvedAt: string | null
  createdAt: string
}

export class SupabaseContactRepo implements IRepository<Contact> {
  async findById(id: string): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? toContact(data) : null
  }

  async findByChannelIdentity(
    organizationId: string,
    channelType: ChannelType,
    externalId: string
  ): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq(`channel_identities->>${channelType}`, externalId)
      .maybeSingle()

    if (error) throw error
    return data ? toContact(data) : null
  }

  async listContacts(
    organizationId: string,
    filters: ContactFilters = {}
  ): Promise<PaginatedResult<Contact>> {
    const { limit = 50, offset = 0 } = filters

    let q = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)

    if (filters.search?.trim()) {
      const s = filters.search.trim()
      q = q.or(
        `full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`
      )
    }

    if (filters.channelType) {
      q = q.not(`channel_identities->${filters.channelType}`, 'is', null)
    }

    if (filters.tag) {
      q = q.contains('tags', [filters.tag])
    }

    if (filters.blocked !== undefined) {
      q = q.eq('blocked', filters.blocked)
    }

    q = q.order('last_seen_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await q
    if (error) throw error

    return {
      data: (data ?? []).map(toContact),
      count: count ?? 0,
      hasMore: (count ?? 0) > offset + limit
    }
  }

  async getStats(organizationId: string): Promise<ContactStats> {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoIso = sevenDaysAgo.toISOString()

    const [totalRes, newRes, blockedRes] = await Promise.all([
      supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('created_at', sevenDaysAgoIso),
      supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('blocked', true)
    ])

    return {
      total: totalRes.count ?? 0,
      newThisWeek: newRes.count ?? 0,
      blocked: blockedRes.count ?? 0
    }
  }

  async listAllTags(organizationId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('tags')
      .eq('organization_id', organizationId)
      .not('tags', 'is', null)

    if (error) throw error

    const set = new Set<string>()
    for (const r of data ?? []) {
      const tags = (r as any).tags as string[] | null
      if (Array.isArray(tags)) {
        for (const t of tags) if (t) set.add(t)
      }
    }
    return Array.from(set).sort()
  }

  /**
   * Lista las conversaciones de un contacto específico.
   *
   * 🔧 FIX: agent_id apunta a la tabla 'agents', NO a 'users'.
   * Por eso hacemos doble embed: conversations → agents → users
   * para obtener el nombre del agente humano.
   */
  async listConversationsByContact(
    contactId: string,
    limit = 20
  ): Promise<ContactConversationSummary[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        status,
        channel_type,
        subject,
        tags,
        priority,
        agent_id,
        last_message_preview,
        last_message_at,
        csat_score,
        resolved_at,
        created_at,
        agent:agents!conversations_agent_id_fkey(
          user:users!agents_user_id_fkey(full_name)
        )
      `)
      .eq('contact_id', contactId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (error) throw error

    return (data ?? []).map((r: any) => ({
      id: r.id,
      status: r.status,
      channelType: r.channel_type,
      subject: r.subject,
      tags: r.tags ?? [],
      priority: r.priority ?? 0,
      agentId: r.agent_id,
      // Doble embed: conv.agent.user.full_name
      agentName: r.agent?.user?.full_name ?? null,
      lastMessagePreview: r.last_message_preview,
      lastMessageAt: r.last_message_at,
      csatScore: r.csat_score,
      resolvedAt: r.resolved_at,
      createdAt: r.created_at
    }))
  }

  async create(input: Partial<Contact>): Promise<Contact> {
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        organization_id: input.organizationId,
        full_name: input.fullName,
        email: input.email,
        phone: input.phone,
        avatar_url: input.avatarUrl,
        locale: input.locale,
        timezone: input.timezone,
        channel_identities: input.channelIdentities ?? {},
        tags: input.tags ?? [],
        custom_fields: input.customFields ?? {},
        notes: input.notes ?? null
      })
      .select()
      .single()
    if (error) throw error
    return toContact(data)
  }

  async update(id: string, input: Partial<Contact>): Promise<Contact> {
    const patch: Record<string, any> = {}
    if (input.fullName !== undefined)           patch.full_name = input.fullName
    if (input.email !== undefined)              patch.email = input.email
    if (input.phone !== undefined)              patch.phone = input.phone
    if (input.avatarUrl !== undefined)          patch.avatar_url = input.avatarUrl
    if (input.locale !== undefined)             patch.locale = input.locale
    if (input.timezone !== undefined)           patch.timezone = input.timezone
    if (input.channelIdentities !== undefined)  patch.channel_identities = input.channelIdentities
    if (input.tags !== undefined)               patch.tags = input.tags
    if (input.customFields !== undefined)       patch.custom_fields = input.customFields
    if (input.notes !== undefined)              patch.notes = input.notes
    if (input.blocked !== undefined)            patch.blocked = input.blocked

    const coreFieldsChanged = ['fullName', 'email', 'phone', 'blocked'].some(
      (f) => input[f as keyof Contact] !== undefined
    )
    if (coreFieldsChanged) {
      patch.last_seen_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('contacts')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return toContact(data)
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) throw error
  }

  async findMany(params: {
    filters?: Record<string, unknown>
    limit?: number
    offset?: number
  } = {}): Promise<PaginatedResult<Contact>> {
    const { limit = 50, offset = 0 } = params
    let q = supabase.from('contacts').select('*', { count: 'exact' })

    if (params.filters) {
      for (const [k, v] of Object.entries(params.filters)) {
        if (v !== undefined && v !== null) q = q.eq(k, v as any)
      }
    }

    q = q.order('last_seen_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await q
    if (error) throw error

    return {
      data: (data ?? []).map(toContact),
      count: count ?? 0,
      hasMore: (count ?? 0) > offset + limit
    }
  }
}
