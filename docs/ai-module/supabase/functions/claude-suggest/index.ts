// Ruta: /supabase/functions/claude-suggest/index.ts
// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION: claude-suggest
// Genera una sugerencia de respuesta para el agente humano.
// El agente puede usarla tal cual, editarla, o ignorarla.
// Usa Haiku por velocidad y costo.
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { callClaude, calculateCostMicroUsd, corsHeaders, buildSystemPrompt } from '../_shared/anthropic.ts'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL         = 'claude-haiku-4-5-20251001'

interface Body {
  conversationId: string
  /** Contexto adicional que el agente quiere pasar */
  hint?: string
}

const SUGGEST_SYSTEM = `Eres un asistente que sugiere respuestas CONCISAS a un AGENTE HUMANO de atención al cliente.

Tu sugerencia:
- Es natural, empática y profesional
- Máximo 2-3 oraciones
- En español neutro, tú por defecto
- NO incluye "Hola" ni saludos innecesarios (el agente ya está en conversación)
- NO incluye comillas ni preámbulo, solo el texto que el agente podría enviar

Si el usuario te da un "hint" sobre qué dirigir, úsalo para personalizar la sugerencia.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  })

  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  let body: Body
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  try {
    const { data: conv } = await userClient
      .from('conversations')
      .select('id, organization_id, bot_persona_id')
      .eq('id', body.conversationId)
      .single()

    if (!conv) return json({ error: 'Conversación no encontrada' }, 404)

    // Cargar últimos 10 mensajes
    const { data: messages } = await admin
      .from('messages')
      .select('sender_type, content')
      .eq('conversation_id', body.conversationId)
      .order('created_at', { ascending: false })
      .limit(10)

    const history = (messages ?? []).reverse().filter((m) => m.content)
    if (history.length === 0) return json({ suggestion: '' })

    const claudeMessages = history.map((m) => ({
      role: (m.sender_type === 'contact' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content ?? ''
    }))

    if (body.hint) {
      claudeMessages.push({
        role: 'user',
        content: `[HINT DEL AGENTE]: ${body.hint}`
      })
    }

    const result = await callClaude({
      model: MODEL,
      max_tokens: 200,
      temperature: 0.6,
      system: SUGGEST_SYSTEM,
      messages: claudeMessages
    }, ANTHROPIC_KEY)

    await admin.rpc('register_ai_usage', {
      p_org_id: conv.organization_id,
      p_conversation_id: body.conversationId,
      p_operation: 'suggest',
      p_model: MODEL,
      p_input_tokens: result.inputTokens,
      p_output_tokens: result.outputTokens,
      p_cost_usd_micro: calculateCostMicroUsd(MODEL, result.inputTokens, result.outputTokens),
      p_latency_ms: result.latencyMs,
      p_success: true,
      p_requested_by: user.id
    })

    return json({
      suggestion: result.text.trim(),
      tokens: result.inputTokens + result.outputTokens
    })

  } catch (err) {
    console.error('[claude-suggest] Error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
