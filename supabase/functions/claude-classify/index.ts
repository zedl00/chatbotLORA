// Ruta: /supabase/functions/claude-classify/index.ts
// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION: claude-classify
// Clasifica un mensaje: intención, sentimiento, urgencia, idioma.
// Usa Haiku (más barato) con JSON mode para respuestas estructuradas.
// Se dispara asincrónicamente desde claude-chat.
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { callClaude, calculateCostMicroUsd, corsHeaders } from '../_shared/anthropic.ts'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL         = 'claude-haiku-4-5-20251001'

const CLASSIFY_PROMPT = `Eres un clasificador de mensajes de atención al cliente. Analiza el mensaje del usuario y retorna EXCLUSIVAMENTE un JSON válido con este formato exacto, sin texto adicional:

{
  "intent": "question" | "complaint" | "sales" | "support" | "greeting" | "farewell" | "handoff" | "spam" | "other",
  "sentiment": "positive" | "neutral" | "negative",
  "urgency": "low" | "normal" | "high" | "urgent",
  "language": "es" | "en" | "pt" | "fr" | "other",
  "topics": ["tema1", "tema2"],
  "entities": {
    "name": null,
    "email": null,
    "phone": null,
    "order_id": null
  },
  "confidence": 0.95
}

Reglas:
- "handoff" solo si el usuario pide EXPLÍCITAMENTE hablar con un humano
- "urgent" solo si expresa emergencia real o amenaza irse
- "topics" máximo 3, en minúsculas
- "entities": extrae si aparecen en el texto, null si no
- "confidence": tu nivel de confianza 0-1`

interface ClassifyBody {
  messageId: string
  conversationId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  let body: ClassifyBody
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  if (!body.messageId || !body.conversationId) {
    return json({ error: 'messageId y conversationId requeridos' }, 400)
  }

  try {
    // Cargar mensaje
    const { data: msg, error: msgErr } = await admin
      .from('messages')
      .select('id, content, conversation_id, organization_id')
      .eq('id', body.messageId)
      .single()

    if (msgErr || !msg) return json({ error: 'Mensaje no encontrado' }, 404)
    if (!msg.content) return json({ skipped: true, reason: 'Sin contenido de texto' })

    // Verificar que no esté clasificado ya
    const { data: existing } = await admin
      .from('message_classifications')
      .select('id')
      .eq('message_id', msg.id)
      .maybeSingle()

    if (existing) return json({ skipped: true, reason: 'Ya clasificado' })

    // Llamar a Claude Haiku
    const result = await callClaude({
      model: MODEL,
      max_tokens: 300,
      temperature: 0.1,
      system: CLASSIFY_PROMPT,
      messages: [{ role: 'user', content: msg.content }]
    }, ANTHROPIC_KEY)

    // Parsear JSON de la respuesta
    let parsed: any
    try {
      // Extraer primer bloque JSON del texto (por si hay preámbulo)
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No se encontró JSON en la respuesta')
      parsed = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error('[claude-classify] No se pudo parsear JSON:', result.text)
      await admin.rpc('register_ai_usage', {
        p_org_id: msg.organization_id,
        p_conversation_id: msg.conversation_id,
        p_operation: 'classify',
        p_model: MODEL,
        p_input_tokens: result.inputTokens,
        p_output_tokens: result.outputTokens,
        p_cost_usd_micro: calculateCostMicroUsd(MODEL, result.inputTokens, result.outputTokens),
        p_latency_ms: result.latencyMs,
        p_success: false,
        p_error_message: 'JSON parse error: ' + (e instanceof Error ? e.message : String(e))
      })
      return json({ error: 'Error parseando clasificación' }, 500)
    }

    // Insertar clasificación
    const { data: inserted } = await admin
      .from('message_classifications')
      .insert({
        message_id: msg.id,
        conversation_id: msg.conversation_id,
        organization_id: msg.organization_id,
        intent: parsed.intent,
        sentiment: parsed.sentiment,
        urgency: parsed.urgency ?? 'normal',
        language: parsed.language,
        topics: parsed.topics ?? [],
        entities: parsed.entities ?? {},
        confidence: parsed.confidence,
        model: MODEL,
        tokens_used: result.inputTokens + result.outputTokens
      })
      .select()
      .single()

    // Si es urgente, subir prioridad de la conversación
    if (parsed.urgency === 'urgent' || parsed.urgency === 'high') {
      await admin
        .from('conversations')
        .update({ priority: parsed.urgency === 'urgent' ? 2 : 1 })
        .eq('id', msg.conversation_id)
        .lt('priority', parsed.urgency === 'urgent' ? 2 : 1)
    }

    // Registrar uso
    await admin.rpc('register_ai_usage', {
      p_org_id: msg.organization_id,
      p_conversation_id: msg.conversation_id,
      p_operation: 'classify',
      p_model: MODEL,
      p_input_tokens: result.inputTokens,
      p_output_tokens: result.outputTokens,
      p_cost_usd_micro: calculateCostMicroUsd(MODEL, result.inputTokens, result.outputTokens),
      p_latency_ms: result.latencyMs,
      p_success: true
    })

    return json({ success: true, classification: inserted })

  } catch (err) {
    console.error('[claude-classify] Error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
