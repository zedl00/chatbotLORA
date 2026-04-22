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
// ═══════════════════════════════════════════════════════════════
export async function playgroundSend(params: {
  message: string
  personaId?: string
  conversationId?: string
}): Promise<PlaygroundResponse> {
  const { data, error } = await supabase.functions.invoke<PlaygroundResponse>(
    'ai-test-message',
    { body: params }
  )
  if (error) throw new Error(`[ai-test-message] ${error.message}`)
  if (!data) throw new Error('Respuesta vacía')
  return data
}
