// supabase/functions/public-config/index.ts
// ═══════════════════════════════════════════════════════════════
// Endpoint público: devuelve solo configs marcadas como is_public.
// Usado por widget.js al cargar para conocer URLs base, branding, etc.
// Sin auth (--no-verify-jwt al desplegar).
// ═══════════════════════════════════════════════════════════════
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await supabase.rpc('get_public_config')

    if (error) {
      console.error('[public-config] RPC error:', error)
      return jsonResp({ error: 'Internal error' }, 500)
    }

    return new Response(
      JSON.stringify(data ?? {}),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'  // cache 5 min
        }
      }
    )
  } catch (e) {
    console.error('[public-config] Unexpected:', e)
    return jsonResp({ error: 'Unexpected error' }, 500)
  }
})

function jsonResp(obj: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
