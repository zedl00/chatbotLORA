// Ruta: /src/services/claude.service.ts
// ═══════════════════════════════════════════════════════════════
// Cliente frontend que invoca Edge Functions.
// La ANTHROPIC_API_KEY NUNCA vive en el frontend.
// ═══════════════════════════════════════════════════════════════
import { supabase } from './supabase.client'
import type { PlaygroundResponse } from '@/types/ai.types'

// ═══════════════════════════════════════════════════════════════
// CHAT (para canales reales; retorna un mensaje insertado en DB)
// ═══════════════════════════════════════════════════════════════
export interface ChatResult {
  success: boolean
  messageId: string
  response: string
  handoffDetected: boolean
  tokensUsed: number
  costUsd: number
  model: string
  latencyMs: number
  ragUsed: boolean
}

export async function chatRespond(conversationId: string, personaId?: string): Promise<ChatResult> {
  const { data, error } = await supabase.functions.invoke<ChatResult>('claude-chat', {
    body: { conversationId, personaId }
  })
  if (error) throw new Error(`[claude-chat] ${error.message}`)
  if (!data) throw new Error('Respuesta vacía de claude-chat')
  return data
}

// Dry-run: prueba sin persistir. Útil para preview en el panel de configuración.
export async function chatDryRun(conversationId: string, personaId?: string) {
  const { data, error } = await supabase.functions.invoke('claude-chat', {
    body: { conversationId, personaId, dryRun: true }
  })
  if (error) throw new Error(`[claude-chat dry] ${error.message}`)
  return data
}

// ═══════════════════════════════════════════════════════════════
// CLASSIFY
// ═══════════════════════════════════════════════════════════════
export async function classifyMessage(messageId: string, conversationId: string) {
  const { data, error } = await supabase.functions.invoke('claude-classify', {
    body: { messageId, conversationId }
  })
  if (error) throw new Error(`[claude-classify] ${error.message}`)
  return data
}

// ═══════════════════════════════════════════════════════════════
// SUMMARIZE
// ═══════════════════════════════════════════════════════════════
export async function summarizeConversation(conversationId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ summary: string }>(
    'claude-summarize',
    { body: { conversationId } }
  )
  if (error) throw new Error(`[claude-summarize] ${error.message}`)
  return data?.summary ?? ''
}

// ═══════════════════════════════════════════════════════════════
// SUGGEST (para agentes humanos)
// ═══════════════════════════════════════════════════════════════
export async function suggestReply(conversationId: string, hint?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ suggestion: string }>(
    'claude-suggest',
    { body: { conversationId, hint } }
  )
  if (error) throw new Error(`[claude-suggest] ${error.message}`)
  return data?.suggestion ?? ''
}

// ═══════════════════════════════════════════════════════════════
// EMBED (procesa un documento de knowledge_base)
// ═══════════════════════════════════════════════════════════════
export async function embedKnowledgeDoc(documentId: string): Promise<{ chunks: number; totalTokens: number }> {
  const { data, error } = await supabase.functions.invoke('claude-embed', {
    body: { documentId }
  })
  if (error) throw new Error(`[claude-embed] ${error.message}`)
  return data as { chunks: number; totalTokens: number }
}

// ═══════════════════════════════════════════════════════════════
// PLAYGROUND TEST (inyecta mensaje ficticio y obtiene respuesta)
//
// El backend devuelve:
//   { response, meta: { model, inputTokens, outputTokens, tokensUsed,
//                       costUsd, latencyMs, handoffDetected, ragUsed } }
//
// El frontend (PlaygroundResponse) espera campos planos.
// Esta función actúa como adaptador entre los dos formatos.
// ═══════════════════════════════════════════════════════════════
interface AiTestMessageBackendResponse {
  response?: string
  messageId?: string
  conversationId?: string
  contactMessageId?: string
  meta?: {
    model?: string
    inputTokens?: number
    outputTokens?: number
    tokensUsed?: number
    costUsd?: number | string
    latencyMs?: number
    handoffDetected?: boolean
    ragUsed?: boolean
  }
}

export async function playgroundSend(params: {
  message: string
  personaId?: string
  conversationId?: string
}): Promise<PlaygroundResponse> {
  const { data, error } = await supabase.functions.invoke<AiTestMessageBackendResponse>(
    'ai-test-message',
    { body: params }
  )
  if (error) throw new Error(`[ai-test-message] ${error.message}`)
  if (!data) throw new Error('Respuesta vacía')

  const meta = data.meta ?? {}

  const mapped: PlaygroundResponse = {
    success: true,
    conversationId: data.conversationId ?? params.conversationId ?? '',
    contactMessageId: data.contactMessageId ?? `local-${Date.now()}`,
    botMessageId: data.messageId ?? `bot-${Date.now()}`,
    botResponse: data.response ?? '',
    handoffDetected: Boolean(meta.handoffDetected),
    tokensUsed: Number(meta.tokensUsed ?? 0),
    costUsd: Number(meta.costUsd ?? 0),
    latencyMs: Number(meta.latencyMs ?? 0),
    ragUsed: Boolean(meta.ragUsed)
  }

  return mapped
}