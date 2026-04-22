// Ruta: /supabase/functions/_shared/anthropic.ts
// ═══════════════════════════════════════════════════════════════
// Cliente compartido de Anthropic Claude API
// Importado por claude-chat, claude-classify, claude-summarize, claude-suggest
// ═══════════════════════════════════════════════════════════════

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
export const ANTHROPIC_VERSION = '2023-06-01'

// Precios (USD por 1M tokens) - actualizar aquí si Anthropic cambia precios
// Fuente: https://www.anthropic.com/pricing
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514':    { input: 3.0,  output: 15.0 },
  'claude-haiku-4-5-20251001':   { input: 1.0,  output: 5.0 },
  'claude-opus-4-20250514':      { input: 15.0, output: 75.0 }
}

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ClaudeRequest {
  model: string
  max_tokens: number
  system?: string
  messages: ClaudeMessage[]
  temperature?: number
}

export interface ClaudeResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: Array<{ type: 'text'; text: string }>
  model: string
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

/**
 * Llamada genérica a Claude API.
 * Retorna el texto combinado + metadatos de uso.
 */
export async function callClaude(params: ClaudeRequest, apiKey: string): Promise<{
  text: string
  inputTokens: number
  outputTokens: number
  model: string
  stopReason: string
  latencyMs: number
}> {
  const start = Date.now()

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify(params)
  })

  const latencyMs = Date.now() - start

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic API ${response.status}: ${errText}`)
  }

  const data: ClaudeResponse = await response.json()
  const text = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')

  return {
    text,
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
    model: data.model,
    stopReason: data.stop_reason,
    latencyMs
  }
}

/**
 * Calcula el costo en microdólares (para precisión en DB).
 * 1 USD = 1,000,000 microdólares.
 */
export function calculateCostMicroUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) return 0

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return Math.round((inputCost + outputCost) * 1_000_000)
}

/**
 * Construye el system prompt compuesto desde una bot_persona.
 */
export function buildSystemPrompt(persona: {
  identity: string
  objective?: string | null
  tone?: string | null
  language?: string | null
  restrictions?: string | null
  fallback_message?: string | null
  handoff_keyword?: string | null
}, ragContext?: string): string {
  const parts: string[] = []

  parts.push(`## IDENTIDAD\n${persona.identity}`)

  if (persona.objective) {
    parts.push(`## OBJETIVO\n${persona.objective}`)
  }

  const meta: string[] = []
  if (persona.tone) meta.push(`- Tono: ${persona.tone}`)
  if (persona.language) meta.push(`- Idioma: ${persona.language === 'es' ? 'español' : persona.language}`)
  if (meta.length > 0) {
    parts.push(`## ESTILO\n${meta.join('\n')}`)
  }

  if (persona.restrictions) {
    parts.push(`## LIMITACIONES\n${persona.restrictions}`)
  }

  if (persona.fallback_message) {
    parts.push(`## FALLBACK\nSi no sabes algo, responde: "${persona.fallback_message}"`)
  }

  parts.push(`## HANDOFF A HUMANO
Si detectas alguna de estas condiciones:
- El usuario pide explícitamente hablar con un humano/agente/persona
- El tema excede tu capacidad (queja formal, caso legal, reembolso grande, emergencia)
- El usuario está frustrado tras 3+ intentos sin solucionar
- El usuario pide información específica sobre su cuenta que no tienes
Entonces responde comenzando con la palabra clave exacta: ${persona.handoff_keyword ?? '[HANDOFF]'}
Seguida de un breve mensaje amable informando que lo conectarás con un humano.`)

  if (ragContext) {
    parts.push(`## BASE DE CONOCIMIENTO
Usa esta información para responder. Si la respuesta no está aquí, di que necesitas verificarlo:

${ragContext}`)
  }

  return parts.join('\n\n')
}

/**
 * CORS headers para funciones que deben ser invocadas desde el navegador.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}
