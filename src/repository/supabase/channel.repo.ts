// Ruta: /src/repository/supabase/channel.repo.ts
import { supabase } from '@/services/supabase.client'
import type { IRepository } from '../base.repository'
import type { Channel, ChannelType } from '@/types/channel.types'
import type { PaginatedResult } from '@/types/api.types'

function toChannel(row: Record<string, any>): Channel {
  return {
    id: row.id,
    organizationId: row.organization_id,
    type: row.type,
    name: row.name,
    externalId: row.external_id,
    credentials: row.credentials ?? {},
    webhookUrl: row.webhook_url,
    webhookSecret: row.webhook_secret,
    settings: row.settings ?? {},
    active: row.active,
    lastError: row.last_error,
    lastErrorAt: row.last_error_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class SupabaseChannelRepo implements IRepository<Channel> {
  async findById(id: string): Promise<Channel | null> {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? toChannel(data) : null
  }

  async findByExternalId(
    organizationId: string,
    type: ChannelType,
    externalId: string
  ): Promise<Channel | null> {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('type', type)
      .eq('external_id', externalId)
      .maybeSingle()
    if (error) throw error
    return data ? toChannel(data) : null
  }

  async findMany(params: {
    filters?: Record<string, unknown>
    limit?: number
    offset?: number
  } = {}): Promise<PaginatedResult<Channel>> {
    const { limit = 50, offset = 0 } = params
    let q = supabase.from('channels').select('*', { count: 'exact' })

    if (params.filters) {
      for (const [k, v] of Object.entries(params.filters)) {
        if (v !== undefined && v !== null) q = q.eq(k, v as any)
      }
    }

    q = q.range(offset, offset + limit - 1)
    const { data, error, count } = await q
    if (error) throw error

    return {
      data: (data ?? []).map(toChannel),
      count: count ?? 0,
      hasMore: (count ?? 0) > offset + limit
    }
  }

  async create(input: Partial<Channel>): Promise<Channel> {
    const { data, error } = await supabase
      .from('channels')
      .insert({
        organization_id: input.organizationId,
        type: input.type,
        name: input.name,
        external_id: input.externalId,
        credentials: input.credentials ?? {},
        webhook_url: input.webhookUrl,
        webhook_secret: input.webhookSecret,
        settings: input.settings ?? {},
        active: input.active ?? true
      })
      .select()
      .single()
    if (error) throw error
    return toChannel(data)
  }

  async update(id: string, input: Partial<Channel>): Promise<Channel> {
    const patch: Record<string, any> = {}
    if (input.name !== undefined)           patch.name = input.name
    if (input.externalId !== undefined)     patch.external_id = input.externalId
    if (input.credentials !== undefined)    patch.credentials = input.credentials
    if (input.webhookUrl !== undefined)     patch.webhook_url = input.webhookUrl
    if (input.webhookSecret !== undefined)  patch.webhook_secret = input.webhookSecret
    if (input.settings !== undefined)       patch.settings = input.settings
    if (input.active !== undefined)         patch.active = input.active

    const { data, error } = await supabase
      .from('channels')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return toChannel(data)
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('channels').delete().eq('id', id)
    if (error) throw error
  }
}
