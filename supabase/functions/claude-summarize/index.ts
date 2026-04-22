// Ruta: /supabase/functions/claude-summarize/index.ts
// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION: claude-summarize
// Genera un resumen conciso de una conversación larga.
// Uso principal: al hacer handoff, el agente ve un resumen del contexto.
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { callClaude, calculateCostMicroUsd, corsHeaders } from '../_shared/anthropic.ts'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL         = 'claude-haiku-4-5-20251001'

const SUMMARIZE_PROMPT = `Eres un asistente que resume conversaciones de atención al cliente para que un agente humano se ponga al día rápidamente.

Retorna un resumen estructurado en español con este formato:

**Situación:** [una oración sobre qué está pasando]
**Qué pide el cliente:** [punto clave]
**Intentos previos:** [qué se le ha respondido]
**Estado emocional:** [cómo se siente el cliente]
**Acción sugerida:** [qué debería hacer el agente]

Sé conciso: máximo 6 líneas totales.`

interface Body {
  conversationId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // Autenticar usuario
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
    // Cargar conversación con permisos del usuario (para respetar RLS)
    const { data: conv } = await userClient
      .from('conversations')
      .select('id, organization_id')
      .eq('id', body.conversationId)
      .single()

    if (!conv) return json({ error: 'Conversación no encontrada o sin acceso' }, 404)

    // Historial
    const { data: messages } = await admin
      .from('messages')
      .select('sender_type, content, created_at')
      .eq('conversation_id', body.conversationId)
      .order('created_at', { ascending: true })
      .limit(50)

    if (!messages || messages.length === 0) {
      return json({ error: 'Conversación sin mensajes' }, 400)
    }

    // Formatear como texto de entrada
    const transcript = messages
      .filter((m) => m.content)
      .map((m) => {
        const role = m.sender_type === 'contact' ? 'Cliente'
                   : m.sender_type === 'bot'     ? 'Bot'
                   : m.sender_type === 'agent'   ? 'Agente'
                   : 'Sistema'
        return `${role}: ${m.content}`
      })
      .join('\n')

    const result = await callClaude({
      model: MODEL,
      max_tokens: 400,
      temperature: 0.3,
      system: SUMMARIZE_PROMPT,
      messages: [{ role: 'user', content: transcript }]
    }, ANTHROPIC_KEY)

    // Registrar uso
    await admin.rpc('register_ai_usage', {
      p_org_id: conv.organization_id,
      p_conversation_id: body.conversationId,
      p_operation: 'summarize',
      p_model: MODEL,
      p_input_tokens: result.inputTokens,
      p_output_tokens: result.outputTokens,
      p_cost_usd_micro: calculateCostMicroUsd(MODEL, result.inputTokens, result.outputTokens),
      p_latency_ms: result.latencyMs,
      p_success: true,
      p_requested_by: user.id
    })

    return json({ summary: result.text.trim() })

  } catch (err) {
    console.error('[claude-summarize] Error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
