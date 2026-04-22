// Ruta: /src/services/supabase.client.ts
// Cliente único de Supabase para todo el frontend.
// NUNCA importar @supabase/supabase-js directamente en otro archivo.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[supabase.client] VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY son requeridas. Copia .env.example a .env.local y completa los valores.'
  )
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'chatbot-ia-auth'
  },
  realtime: {
    params: { eventsPerSecond: 10 }
  },
  global: {
    headers: { 'x-application-name': 'chatbot-ia' }
  }
})
