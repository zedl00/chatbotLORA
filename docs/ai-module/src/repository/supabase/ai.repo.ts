// Ruta: /src/repository/supabase/ai.repo.ts
import { supabase } from '@/services/supabase.client'
import type {
  BotPersona,
  CreateBotPersonaInput,
  MessageClassification,
  AiUsageEntry,
  AiMonthlyUsage,
  KnowledgeDoc
} from '@/types/ai.types'

// ═══════════════════════════════════════════════════════════════
// Mappers
// ═══════════════════════════════════════════════════════════════
function toPersona(r: any): BotPersona {
  return {
    id: r.id, organizationId: r.organization_id, name: r.name, slug: r.slug,
    description: r.description, avatarUrl: r.avatar_url,
    identity: r.identity, objective: r.objective, tone: r.tone, language: r.language,
    restrictions: r.restrictions, fallbackMessage: r.fallback_message,
    handoffKeyword: r.handoff_keyword, model: r.model,
    temperature: Number(r.temperature), maxTokens: r.max_tokens, maxHistoryMsgs: r.max_history_msgs,
    useKnowledgeBase: r.use_knowledge_base, kbTopK: r.kb_top_k,
    kbThreshold: Number(r.kb_threshold),
    enableClassification: r.enable_classification, enableSuggestions: r.enable_suggestions,
    isDefault: r.is_default, active: r.active,
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at
  }
}

function toClassification(r: any): MessageClassification {
  return {
    id: r.id, messageId: r.message_id, conversationId: r.conversation_id,
    organizationId: r.organization_id, intent: r.intent, sentiment: r.sentiment,
    urgency: r.urgency, language: r.language, topics: r.topics ?? [],
    entities: r.entities ?? {}, confidence: r.confidence ? Number(r.confidence) : null,
    model: r.model, tokensUsed: r.tokens_used, createdAt: r.created_at
  }
}

function toUsage(r: any): AiUsageEntry {
  return {
    id: r.id, organizationId: r.organization_id, conversationId: r.conversation_id,
    operation: r.operation, model: r.model,
    inputTokens: r.input_tokens, outputTokens: r.output_tokens, totalTokens: r.total_tokens,
    costUsdMicro: r.cost_usd_micro ?? 0,
    costUsd: (r.cost_usd_micro ?? 0) / 1_000_000,
    latencyMs: r.latency_ms, success: r.success, errorMessage: r.error_message,
    createdAt: r.created_at
  }
}

function toKnowledge(r: any): KnowledgeDoc {
  return {
    id: r.id, organizationId: r.organization_id, title: r.title,
    sourceType: r.source_type, sourceUrl: r.source_url, content: r.content,
    tags: r.tags ?? [], active: r.active, createdBy: r.created_by,
    createdAt: r.created_at, updatedAt: r.updated_at,
    chunkCount: r.chunk_count
  }
}

// ═══════════════════════════════════════════════════════════════
// Repository
// ═══════════════════════════════════════════════════════════════
export class SupabaseAiRepo {
  // ─── BOT PERSONAS ───────────────────────────────────────────
  async listPersonas(organizationId: string): Promise<BotPersona[]> {
    const { data, error } = await supabase
      .from('bot_personas')
      .select('*')
      .eq('organization_id', organizationId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })
    if (error) throw error
    return (data ?? []).map(toPersona)
  }

  async getPersona(id: string): Promise<BotPersona | null> {
    const { data, error } = await supabase
      .from('bot_personas').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? toPersona(data) : null
  }

  async createPersona(orgId: string, input: CreateBotPersonaInput): Promise<BotPersona> {
    const { data, error } = await supabase
      .from('bot_personas')
      .insert({
        organization_id: orgId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        identity: input.identity,
        objective: input.objective ?? null,
        tone: input.tone ?? 'friendly',
        language: input.language ?? 'es',
        restrictions: input.restrictions ?? null,
        fallback_message: input.fallbackMessage ?? null,
        handoff_keyword: input.handoffKeyword ?? '[HANDOFF]',
        model: input.model ?? 'claude-sonnet-4-20250514',
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 1000,
        max_history_msgs: input.maxHistoryMsgs ?? 20,
        use_knowledge_base: input.useKnowledgeBase ?? true,
        kb_top_k: input.kbTopK ?? 5,
        kb_threshold: input.kbThreshold ?? 0.75,
        enable_classification: input.enableClassification ?? true,
        enable_suggestions: input.enableSuggestions ?? true,
        is_default: input.isDefault ?? false
      })
      .select().single()
    if (error) throw error
    return toPersona(data)
  }

  async updatePersona(id: string, input: Partial<CreateBotPersonaInput & { active: boolean }>): Promise<BotPersona> {
    const patch: Record<string, any> = {}
    if (input.name !== undefined)                 patch.name = input.name
    if (input.description !== undefined)          patch.description = input.description
    if (input.identity !== undefined)             patch.identity = input.identity
    if (input.objective !== undefined)            patch.objective = input.objective
    if (input.tone !== undefined)                 patch.tone = input.tone
    if (input.language !== undefined)             patch.language = input.language
    if (input.restrictions !== undefined)         patch.restrictions = input.restrictions
    if (input.fallbackMessage !== undefined)      patch.fallback_message = input.fallbackMessage
    if (input.handoffKeyword !== undefined)       patch.handoff_keyword = input.handoffKeyword
    if (input.model !== undefined)                patch.model = input.model
    if (input.temperature !== undefined)          patch.temperature = input.temperature
    if (input.maxTokens !== undefined)            patch.max_tokens = input.maxTokens
    if (input.maxHistoryMsgs !== undefined)       patch.max_history_msgs = input.maxHistoryMsgs
    if (input.useKnowledgeBase !== undefined)     patch.use_knowledge_base = input.useKnowledgeBase
    if (input.kbTopK !== undefined)               patch.kb_top_k = input.kbTopK
    if (input.kbThreshold !== undefined)          patch.kb_threshold = input.kbThreshold
    if (input.enableClassification !== undefined) patch.enable_classification = input.enableClassification
    if (input.enableSuggestions !== undefined)    patch.enable_suggestions = input.enableSuggestions
    if (input.isDefault !== undefined)            patch.is_default = input.isDefault
    if (input.active !== undefined)               patch.active = input.active

    const { data, error } = await supabase
      .from('bot_personas').update(patch).eq('id', id).select().single()
    if (error) throw error
    return toPersona(data)
  }

  async setDefaultPersona(id: string, organizationId: string): Promise<void> {
    // Transacción simulada: primero quitar default a otras, luego poner default a esta
    await supabase
      .from('bot_personas')
      .update({ is_default: false })
      .eq('organization_id', organizationId)
      .eq('is_default', true)

    const { error } = await supabase
      .from('bot_personas')
      .update({ is_default: true })
      .eq('id', id)
    if (error) throw error
  }

  async deletePersona(id: string): Promise<void> {
    const { error } = await supabase.from('bot_personas').delete().eq('id', id)
    if (error) throw error
  }

  // ─── CLASSIFICATIONS ────────────────────────────────────────
  async getClassificationForMessage(messageId: string): Promise<MessageClassification | null> {
    const { data, error } = await supabase
      .from('message_classifications')
      .select('*')
      .eq('message_id', messageId)
      .maybeSingle()
    if (error) throw error
    return data ? toClassification(data) : null
  }

  // ─── USAGE / COSTS ──────────────────────────────────────────
  async getMonthlyUsage(organizationId: string): Promise<AiMonthlyUsage> {
    const { data, error } = await supabase.rpc('get_current_month_tokens', {
      p_org_id: organizationId
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return {
      totalTokens:  Number(row?.total_tokens ?? 0),
      totalCostUsd: Number(row?.total_cost_usd ?? 0),
      callCount:    Number(row?.call_count ?? 0),
      chatCount:    Number(row?.chat_count ?? 0),
      errorCount:   Number(row?.error_count ?? 0)
    }
  }

  async listRecentUsage(organizationId: string, limit = 50): Promise<AiUsageEntry[]> {
    const { data, error } = await supabase
      .from('ai_usage_log')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map(toUsage)
  }

  // ─── KNOWLEDGE BASE ─────────────────────────────────────────
  async listKnowledgeDocs(organizationId: string): Promise<KnowledgeDoc[]> {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*, knowledge_chunks(count)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
    if (error) throw error

    return (data ?? []).map((r: any) => ({
      ...toKnowledge(r),
      chunkCount: r.knowledge_chunks?.[0]?.count ?? 0
    }))
  }

  async createKnowledgeDoc(input: {
    organizationId: string
    title: string
    content: string
    sourceType?: 'manual' | 'url' | 'file'
    sourceUrl?: string
    tags?: string[]
  }): Promise<KnowledgeDoc> {
    const { data, error } = await supabase
      .from('knowledge_base')
      .insert({
        organization_id: input.organizationId,
        title: input.title,
        content: input.content,
        source_type: input.sourceType ?? 'manual',
        source_url: input.sourceUrl ?? null,
        tags: input.tags ?? []
      })
      .select().single()
    if (error) throw error
    return toKnowledge(data)
  }

  async updateKnowledgeDoc(
    id: string,
    input: Partial<{ title: string; content: string; tags: string[]; active: boolean }>
  ): Promise<KnowledgeDoc> {
    const { data, error } = await supabase
      .from('knowledge_base')
      .update(input)
      .eq('id', id)
      .select().single()
    if (error) throw error
    return toKnowledge(data)
  }

  async deleteKnowledgeDoc(id: string): Promise<void> {
    const { error } = await supabase.from('knowledge_base').delete().eq('id', id)
    if (error) throw error
  }
}
