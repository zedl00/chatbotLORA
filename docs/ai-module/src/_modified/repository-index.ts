// Ruta: /src/repository/index.ts
// ═══════════════════════════════════════════════════════════════
// MODIFICADO en Sprint 3 (AI):
//   - Agregado SupabaseAiRepo
// ═══════════════════════════════════════════════════════════════
import { SupabaseConversationRepo } from './supabase/conversation.repo'
import { SupabaseMessageRepo } from './supabase/message.repo'
import { SupabaseAgentRepo } from './supabase/agent.repo'
import { SupabaseContactRepo } from './supabase/contact.repo'
import { SupabaseChannelRepo } from './supabase/channel.repo'
import { SupabaseRbacRepo } from './supabase/rbac.repo'
import { SupabaseUserRepo } from './supabase/user.repo'
import { SupabaseAiRepo } from './supabase/ai.repo'

const PROVIDER: 'supabase' = 'supabase'

export const repositories = {
  conversations: new SupabaseConversationRepo(),
  messages:      new SupabaseMessageRepo(),
  agents:        new SupabaseAgentRepo(),
  contacts:      new SupabaseContactRepo(),
  channels:      new SupabaseChannelRepo(),
  rbac:          new SupabaseRbacRepo(),
  users:         new SupabaseUserRepo(),
  ai:            new SupabaseAiRepo()
} as const

export type Repositories = typeof repositories

export function getActiveProvider(): string {
  return PROVIDER
}
