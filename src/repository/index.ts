// Ruta: /src/repository/index.ts
// ═══════════════════════════════════════════════════════════════
// Factory central del Repository Pattern.
// Todo el código de la app importa desde aquí, nunca de ./supabase/*
// Para cambiar de proveedor (ej: Firebase), crear una nueva carpeta
// y cambiar solo este archivo.
// ═══════════════════════════════════════════════════════════════

import { SupabaseConversationRepo } from './supabase/conversation.repo'
import { SupabaseMessageRepo } from './supabase/message.repo'
import { SupabaseAgentRepo } from './supabase/agent.repo'
import { SupabaseContactRepo } from './supabase/contact.repo'
import { SupabaseChannelRepo } from './supabase/channel.repo'
import { SupabaseRbacRepo } from './supabase/rbac.repo'
import { SupabaseUserRepo } from './supabase/user.repo'
import { SupabaseAiRepo } from './supabase/ai.repo'
import { SupabaseInboxRepo } from './supabase/inbox.repo'

export const repositories = {
  conversations: new SupabaseConversationRepo(),
  messages: new SupabaseMessageRepo(),
  agents: new SupabaseAgentRepo(),
  contacts: new SupabaseContactRepo(),
  channels: new SupabaseChannelRepo(),
  rbac: new SupabaseRbacRepo(),
  users: new SupabaseUserRepo(),
  ai: new SupabaseAiRepo(),
  inbox: new SupabaseInboxRepo()
}

// También exportar las clases por si alguien las necesita directamente
export {
  SupabaseConversationRepo,
  SupabaseMessageRepo,
  SupabaseAgentRepo,
  SupabaseContactRepo,
  SupabaseChannelRepo,
  SupabaseRbacRepo,
  SupabaseUserRepo,
  SupabaseAiRepo,
  SupabaseInboxRepo
}