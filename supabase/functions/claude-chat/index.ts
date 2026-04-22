// Ruta: /supabase/functions/claude-chat/index.ts
// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION: claude-chat
// El corazón del bot. Para una conversación dada:
//   1. Resuelve qué bot_persona usar
//   2. Carga historial de mensajes
//   3. (Si persona.use_knowledge_base) Busca chunks RAG relevantes
//   4. Construye el system prompt completo
//   5. Llama a Claude
//   6. Detecta handoff_keyword → marca conversación ai_active=false
//   7. Inserta mensaje en DB (trigger de la tabla ya propaga a realtime)
//   8. Registra uso (tokens + costo)
//   9. Si persona.enable_classification → dispara claude-classify en background
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  callClaude,
  buildSystemPrompt,
  calculateCostMicroUsd,
  corsHeaders
} from '../_shared/anthropic.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY    = Deno.env.get('ANTHROPIC_API_KEY')!

interface ChatBody {
  conversationId: string
  /** Opcional: si se provee, NO se inserta el mensaje ni se guarda nada (modo dry-run/test) */
  dryRun?: boolean
  /** Opcional: forzar una persona específica (para playground) */
  personaId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  let body: ChatBody
  try { body = await req.json() } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (!body.conversationId) {
    return json({ error: 'conversationId requerido' }, 400)
  }

  try {
    // ── 1. Cargar conversación ────────────────────────────────
    const { data: conv, error: convErr } = await admin
      .from('conversations')
      .select('*')
      .eq('id', body.conversationId)
      .single()

    if (convErr || !conv) return json({ error: 'Conversación no encontrada' }, 404)

    if (!conv.ai_active) {
      return json({ skipped: true, reason: 'IA desactivada en esta conversación' }, 200)
    }

    // ── 2. Rate limit check ──────────────────────────────────
    const { data: rateLimit } = await admin
      .from('ai_rate_limits')
      .select('paused_until, pause_reason')
      .eq('organization_id', conv.organization_id)
      .maybeSingle()

    if (rateLimit?.paused_until && new Date(rateLimit.paused_until) > new Date()) {
      return json({
        error: 'IA pausada temporalmente',
        reason: rateLimit.pause_reason,
        until: rateLimit.paused_until
      }, 429)
    }

    // ── 3. Token budget check ────────────────────────────────
    const { data: org } = await admin
      .from('organizations')
      .select('ai_tokens_limit, ai_tokens_used, name')
      .eq('id', conv.organization_id)
      .single()

    if (org && org.ai_tokens_used >= org.ai_tokens_limit) {
      return json({
        error: 'Límite mensual de tokens alcanzado',
        used: org.ai_tokens_used,
        limit: org.ai_tokens_limit
      }, 429)
    }

    // ── 4. Resolver bot_persona ──────────────────────────────
    let personaId = body.personaId ?? conv.bot_persona_id

    if (!personaId) {
      // Fallback: persona por defecto del canal
      const { data: channel } = await admin
        .from('channels')
        .select('default_persona_id')
        .eq('id', conv.channel_id)
        .maybeSingle()
      personaId = channel?.default_persona_id
    }

    if (!personaId) {
      // Fallback: persona default de la org
      const { data: defaultPersona } = await admin
        .from('bot_personas')
        .select('id')
        .eq('organization_id', conv.organization_id)
        .eq('is_default', true)
        .eq('active', true)
        .maybeSingle()
      personaId = defaultPersona?.id
    }

    if (!personaId) {
      return json({ error: 'No hay bot persona configurada para esta organización' }, 400)
    }

    const { data: persona, error: personaErr } = await admin
      .from('bot_personas')
      .select('*')
      .eq('id', personaId)
      .single()

    if (personaErr || !persona) return json({ error: 'Persona no encontrada' }, 404)

    // ── 5. Cargar historial ──────────────────────────────────
    const maxHistory = persona.max_history_msgs ?? 20
    const { data: historyRaw } = await admin
      .from('messages')
      .select('sender_type, content, created_at')
      .eq('conversation_id', body.conversationId)
      .order('created_at', { ascending: false })
      .limit(maxHistory)

    const history = (historyRaw ?? []).reverse().filter((m) => m.content)

    if (history.length === 0) {
      return json({ error: 'La conversación no tiene mensajes para responder' }, 400)
    }

    // El último mensaje debe ser del contact (sino no hay nada a qué responder)
    const lastMsg = history[history.length - 1]
    if (lastMsg.sender_type !== 'contact') {
      return json({ skipped: true, reason: 'Último mensaje no es del contacto' }, 200)
    }

    // ── 6. RAG — buscar chunks relevantes ────────────────────
    let ragContext: string | undefined

    if (persona.use_knowledge_base) {
      try {
        // Generar embedding del último mensaje
        const embedding = await generateEmbedding(lastMsg.content!)

        if (embedding) {
          const { data: chunks } = await admin.rpc('match_knowledge_chunks', {
            p_org_id: conv.organization_id,
            p_embedding: embedding,
            p_threshold: persona.kb_threshold ?? 0.75,
            p_match_count: persona.kb_top_k ?? 5
          })

          if (chunks && chunks.length > 0) {
            ragContext = chunks
              .map((c: any, i: number) =>
                `[Fuente ${i + 1}: ${c.document_title}]\n${c.content}`
              )
              .join('\n\n---\n\n')
          }
        }
      } catch (e) {
        console.warn('[claude-chat] RAG falló, continuando sin contexto:', e)
      }
    }

    // ── 7. Construir mensajes para Claude ────────────────────
    const systemPrompt = buildSystemPrompt(persona, ragContext)

    const messages = history.map((m) => ({
      role: (m.sender_type === 'contact' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content ?? ''
    }))

    // ── 8. Llamar a Claude ───────────────────────────────────
    let result
    try {
      result = await callClaude({
        model: persona.model,
        max_tokens: persona.max_tokens,
        temperature: Number(persona.temperature),
        system: systemPrompt,
        messages
      }, ANTHROPIC_KEY)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await admin.rpc('register_ai_usage', {
        p_org_id: conv.organization_id,
        p_conversation_id: body.conversationId,
        p_operation: 'chat',
        p_model: persona.model,
        p_input_tokens: 0,
        p_output_tokens: 0,
        p_cost_usd_micro: 0,
        p_success: false,
        p_error_message: msg
      })
      throw err
    }

    // ── 9. Detectar handoff ──────────────────────────────────
    const handoffKey = persona.handoff_keyword ?? '[HANDOFF]'
    const handoffDetected = result.text.trim().startsWith(handoffKey)
    const cleanText = handoffDetected
      ? result.text.substring(handoffKey.length).trim()
      : result.text.trim()

    // ── 10. Registrar uso ────────────────────────────────────
    const costMicro = calculateCostMicroUsd(result.model, result.inputTokens, result.outputTokens)

    await admin.rpc('register_ai_usage', {
      p_org_id: conv.organization_id,
      p_conversation_id: body.conversationId,
      p_operation: 'chat',
      p_model: result.model,
      p_input_tokens: result.inputTokens,
      p_output_tokens: result.outputTokens,
      p_cost_usd_micro: costMicro,
      p_latency_ms: result.latencyMs,
      p_success: true
    })

    // ── 11. Si es dry-run, retornar sin persistir ────────────
    if (body.dryRun) {
      return json({
        dryRun: true,
        response: cleanText,
        handoffDetected,
        tokensUsed: result.inputTokens + result.outputTokens,
        model: result.model,
        latencyMs: result.latencyMs,
        ragUsed: !!ragContext
      })
    }

    // ── 12. Insertar mensaje del bot en DB ───────────────────
    const { data: insertedMsg } = await admin
      .from('messages')
      .insert({
        conversation_id: body.conversationId,
        organization_id: conv.organization_id,
        sender_type: 'bot',
        content: cleanText,
        content_type: 'text',
        ai_tokens_used: result.inputTokens + result.outputTokens,
        ai_model: result.model,
        status: 'pending',  // pending hasta que el canal lo envíe
        metadata: {
          persona_id: personaId,
          rag_used: !!ragContext,
          handoff_detected: handoffDetected
        }
      })
      .select('id')
      .single()

    // ── 13. Si hay handoff, actualizar conversación ──────────
    if (handoffDetected) {
      await admin
        .from('conversations')
        .update({
          ai_active: false,
          handoff_at: new Date().toISOString(),
          priority: Math.max(conv.priority ?? 0, 1)  // subir prioridad
        })
        .eq('id', body.conversationId)
    }

    // ── 14. Disparar clasificación async (fire-and-forget) ───
    if (persona.enable_classification) {
      // No esperamos el resultado: no bloquea la respuesta del bot
      fetch(`${SUPABASE_URL}/functions/v1/claude-classify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messageId: history[history.length - 1],  // el msg del contacto
          conversationId: body.conversationId
        })
      }).catch((e) => console.warn('[claude-chat] classify failed:', e))
    }

    return json({
      success: true,
      messageId: insertedMsg?.id,
      response: cleanText,
      handoffDetected,
      tokensUsed: result.inputTokens + result.outputTokens,
      costUsd: costMicro / 1_000_000,
      model: result.model,
      latencyMs: result.latencyMs,
      ragUsed: !!ragContext
    })

  } catch (err) {
    console.error('[claude-chat] Error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
})

// ═══════════════════════════════════════════════════════════════
// Helper: genera embedding llamando a claude-embed
// ═══════════════════════════════════════════════════════════════
async function generateEmbedding(text: string): Promise<number[] | null> {
  const voyageKey = Deno.env.get('VOYAGE_API_KEY')
  if (!voyageKey) return null   // sin key = sin RAG (graceful degradation)

  try {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Authorization': `Bearer ${voyageKey}`
      },
      body: JSON.stringify({
        input: text.slice(0, 8000),
        model: 'voyage-3',
        input_type: 'query'
      })
    })

    if (!response.ok) {
      console.warn('[generateEmbedding] Voyage API error:', await response.text())
      return null
    }

    const data = await response.json()
    return data.data?.[0]?.embedding ?? null
  } catch (e) {
    console.warn('[generateEmbedding] Error:', e)
    return null
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
