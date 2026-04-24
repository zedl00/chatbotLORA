// Ruta: /src/repository/supabase/quick-reply.repo.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 8 · CRUD de Quick Replies (snippets)
//
// Reglas:
//   - Las "personales" solo las ve el owner
//   - Las "compartidas" las ve toda la organización
//   - RLS refuerza estas reglas en DB
// ═══════════════════════════════════════════════════════════════
import { supabase } from '@/services/supabase.client'
import type {
  QuickReply,
  CreateQuickReplyInput,
  UpdateQuickReplyInput
} from '@/types/agent.types'

function toQuickReply(r: any): QuickReply {
  return {
    id: r.id,
    organizationId: r.organization_id,
    ownerId: r.owner_id,
    shortcut: r.shortcut,
    title: r.title,
    content: r.content,
    category: r.category,
    isShared: r.is_shared,
    usageCount: r.usage_count ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export class SupabaseQuickReplyRepo {
  /**
   * Lista las quick replies visibles para el usuario:
   *   - Sus personales (owner_id = userId)
   *   - Las compartidas de su org
   *
   * RLS ya filtra en DB; este query solo ordena.
   */
  async listMine(organizationId: string): Promise<QuickReply[]> {
    const { data, error } = await supabase
      .from('quick_replies')
      .select('*')
      .eq('organization_id', organizationId)
      .order('is_shared', { ascending: true })    // personales primero
      .order('category', { ascending: true })
      .order('shortcut', { ascending: true })
    if (error) throw error
    return (data ?? []).map(toQuickReply)
  }

  async getById(id: string): Promise<QuickReply | null> {
    const { data, error } = await supabase
      .from('quick_replies')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? toQuickReply(data) : null
  }

  async create(input: CreateQuickReplyInput): Promise<QuickReply> {
    const { data, error } = await supabase
      .from('quick_replies')
      .insert({
        organization_id: input.organizationId,
        owner_id: input.ownerId,
        shortcut: input.shortcut.toLowerCase().trim(),
        title: input.title.trim(),
        content: input.content,
        category: input.category ?? null,
        is_shared: input.isShared ?? false
      })
      .select()
      .single()
    if (error) throw error
    return toQuickReply(data)
  }

  async update(id: string, input: UpdateQuickReplyInput): Promise<QuickReply> {
    const patch: Record<string, any> = {}
    if (input.shortcut !== undefined) patch.shortcut = input.shortcut.toLowerCase().trim()
    if (input.title !== undefined)    patch.title = input.title.trim()
    if (input.content !== undefined)  patch.content = input.content
    if (input.category !== undefined) patch.category = input.category
    if (input.isShared !== undefined) patch.is_shared = input.isShared

    const { data, error } = await supabase
      .from('quick_replies')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return toQuickReply(data)
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('quick_replies')
      .delete()
      .eq('id', id)
    if (error) throw error
  }

  /**
   * Incrementa el contador de uso (analytics).
   * Se llama cuando el agente inserta un quick reply con /shortcut.
   */
  async incrementUsage(id: string): Promise<void> {
    const { error } = await supabase.rpc('increment_quick_reply_usage', { p_id: id })
    // Si el RPC no existe, hacemos un fallback manual (no crítico)
    if (error) {
      console.warn('[quick-reply.repo] incrementUsage fallback:', error.message)
      const current = await this.getById(id)
      if (current) {
        await supabase
          .from('quick_replies')
          .update({ usage_count: current.usageCount + 1 })
          .eq('id', id)
      }
    }
  }
}
