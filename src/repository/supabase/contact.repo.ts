// Ruta: /src/repository/supabase/contact.repo.ts
import { supabase } from '@/services/supabase.client'
import type { IRepository } from '../base.repository'
import type { Contact, ChannelType } from '@/types/channel.types'
import type { PaginatedResult } from '@/types/api.types'

function toContact(row: Record<string, any>): Contact {
  return {
    id: row.id,
    organizationId: row.organization_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    locale: row.locale,
    timezone: row.timezone,
    channelIdentities: row.channel_identities ?? {},
    tags: row.tags ?? [],
    customFields: row.custom_fields ?? {},
    notes: row.notes,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    blocked: row.blocked,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
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

  /**
   * Busca un contacto por identidad de canal externo.
   * Clave para el webhook: ¿este sender_id ya existe?
   */
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
        custom_fields: input.customFields ?? {}
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
    patch.last_seen_at = new Date().toISOString()

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
}
