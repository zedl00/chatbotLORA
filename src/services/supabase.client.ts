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

// ═══════════════════════════════════════════════════════════════
// Migración suave del storage key: 'chatbot-ia-auth' → 'lora-auth'
// Se ejecuta una sola vez por usuario al cargar la app. Invisible.
// Después de 60 días en producción, se puede eliminar este bloque.
// ═══════════════════════════════════════════════════════════════
;(function migrateStorageKey() {
  if (typeof window === 'undefined') return
  const OLD_KEY = 'chatbot-ia-auth'
  const NEW_KEY = 'lora-auth'
  try {
    const oldVal = localStorage.getItem(OLD_KEY)
    const newVal = localStorage.getItem(NEW_KEY)
    if (oldVal && !newVal) {
      localStorage.setItem(NEW_KEY, oldVal)
      localStorage.removeItem(OLD_KEY)
      console.info('[lora] Sesión migrada al nuevo storage key')
    }
  } catch {
    // Si localStorage no está disponible (ej. Safari privacy mode), seguimos sin migrar
  }
})()

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'lora-auth'
  },
  realtime: {
    params: { eventsPerSecond: 10 }
  },
  global: {
    headers: { 'x-application-name': 'lora' }
  }
})
