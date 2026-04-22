// Ruta: /src/types/ai.types.ts

export type AiOperation = 'chat' | 'classify' | 'summarize' | 'suggest' | 'embed'
export type IntentCategory =
  | 'question' | 'complaint' | 'sales' | 'support'
  | 'greeting' | 'farewell' | 'handoff' | 'spam' | 'other'
export type Sentiment = 'positive' | 'neutral' | 'negative'
export type UrgencyLevel = 'low' | 'normal' | 'high' | 'urgent'

// ═══════════════════════════════════════════════════════════════
// BOT PERSONAS
// ═══════════════════════════════════════════════════════════════
export interface BotPersona {
  id: string
  organizationId: string
  name: string
  slug: string
  description: string | null
  avatarUrl: string | null
  identity: string
  objective: string | null
  tone: string
  language: string
  restrictions: string | null
  fallbackMessage: string | null
  handoffKeyword: string
  model: string
  temperature: number
  maxTokens: number
  maxHistoryMsgs: number
  useKnowledgeBase: boolean
  kbTopK: number
  kbThreshold: number
  enableClassification: boolean
  enableSuggestions: boolean
  isDefault: boolean
  active: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateBotPersonaInput {
  name: string
  slug: string
  description?: string
  identity: string
  objective?: string
  tone?: string
  language?: string
  restrictions?: string
  fallbackMessage?: string
  handoffKeyword?: string
  model?: string
  temperature?: number
  maxTokens?: number
  maxHistoryMsgs?: number
  useKnowledgeBase?: boolean
  kbTopK?: number
  kbThreshold?: number
  enableClassification?: boolean
  enableSuggestions?: boolean
  isDefault?: boolean
}

// ═══════════════════════════════════════════════════════════════
// CLASSIFICATION
// ═══════════════════════════════════════════════════════════════
export interface MessageClassification {
  id: string
  messageId: string
  conversationId: string
  organizationId: string
  intent: IntentCategory | null
  sentiment: Sentiment | null
  urgency: UrgencyLevel
  language: string | null
  topics: string[]
  entities: Record<string, string | null>
  confidence: number | null
  model: string | null
  tokensUsed: number | null
  createdAt: string
}

// ═══════════════════════════════════════════════════════════════
// USAGE / COSTS
// ═══════════════════════════════════════════════════════════════
export interface AiUsageEntry {
  id: string
  organizationId: string
  conversationId: string | null
  operation: AiOperation
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsdMicro: number
  costUsd: number     // derivado
  latencyMs: number | null
  success: boolean
  errorMessage: string | null
  createdAt: string
}

export interface AiMonthlyUsage {
  totalTokens: number
  totalCostUsd: number
  callCount: number
  chatCount: number
  errorCount: number
}

// ═══════════════════════════════════════════════════════════════
// KNOWLEDGE
// ═══════════════════════════════════════════════════════════════
export interface KnowledgeDoc {
  id: string
  organizationId: string
  title: string
  sourceType: 'manual' | 'url' | 'file' | 'api'
  sourceUrl: string | null
  content: string
  tags: string[]
  active: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
  /** Número de chunks generados (populated cuando se hace join) */
  chunkCount?: number
}

// ═══════════════════════════════════════════════════════════════
// PLAYGROUND
// ═══════════════════════════════════════════════════════════════
export interface PlaygroundResponse {
  success: boolean
  conversationId: string
  contactMessageId: string
  botMessageId: string
  botResponse: string
  handoffDetected: boolean
  tokensUsed: number
  costUsd: number
  latencyMs: number
  ragUsed: boolean
}

// ═══════════════════════════════════════════════════════════════
// Labels para UI
// ═══════════════════════════════════════════════════════════════
export const INTENT_LABELS: Record<IntentCategory, { label: string; icon: string; color: string }> = {
  question:  { label: 'Pregunta',   icon: '❓', color: '#3b82f6' },
  complaint: { label: 'Queja',      icon: '😠', color: '#ef4444' },
  sales:     { label: 'Venta',      icon: '💰', color: '#10b981' },
  support:   { label: 'Soporte',    icon: '🔧', color: '#f59e0b' },
  greeting:  { label: 'Saludo',     icon: '👋', color: '#8b5cf6' },
  farewell:  { label: 'Despedida',  icon: '👋', color: '#6b7280' },
  handoff:   { label: 'Humano',     icon: '🧑‍💼', color: '#dc2626' },
  spam:      { label: 'Spam',       icon: '🚫', color: '#64748b' },
  other:     { label: 'Otro',       icon: '•',  color: '#94a3b8' }
}

export const SENTIMENT_LABELS: Record<Sentiment, { label: string; color: string; emoji: string }> = {
  positive: { label: 'Positivo', color: '#10b981', emoji: '😊' },
  neutral:  { label: 'Neutral',  color: '#64748b', emoji: '😐' },
  negative: { label: 'Negativo', color: '#ef4444', emoji: '😟' }
}

export const URGENCY_LABELS: Record<UrgencyLevel, { label: string; color: string }> = {
  low:    { label: 'Baja',    color: '#94a3b8' },
  normal: { label: 'Normal',  color: '#64748b' },
  high:   { label: 'Alta',    color: '#f59e0b' },
  urgent: { label: 'Urgente', color: '#dc2626' }
}

export const CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-20250514',   label: 'Claude Sonnet 4 (recomendado)',   speed: 'medio',  quality: 'alta' },
  { value: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5 (rápido/barato)', speed: 'rápido', quality: 'buena' },
  { value: 'claude-opus-4-20250514',     label: 'Claude Opus 4 (máxima calidad)',   speed: 'lento',  quality: 'máxima' }
] as const

export const TONE_OPTIONS = [
  { value: 'friendly',    label: 'Amigable' },
  { value: 'formal',      label: 'Formal' },
  { value: 'casual',      label: 'Casual' },
  { value: 'professional',label: 'Profesional' },
  { value: 'enthusiastic',label: 'Entusiasta' }
] as const

export const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
  { value: 'fr', label: 'Français' }
] as const
