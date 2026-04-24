// supabase/functions/widget-config/index.ts
// ═══════════════════════════════════════════════════════════════
// Endpoint público CORS: devuelve el settings del widget (JSON)
// Llamado desde widget.js al cargar en el sitio del cliente.
//
// Uso:
//   GET /functions/v1/widget-config?channel_id=UUID
// ═══════════════════════════════════════════════════════════════
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
}

serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const channelId = url.searchParams.get('channel_id')

    if (!channelId) {
      return new Response(
        JSON.stringify({ error: 'channel_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Usar el helper RPC (ya scopea correctamente sin exponer credentials)
    const { data, error } = await supabase.rpc('get_widget_public_config', {
      p_channel_id: channelId
    })

    if (error) {
      console.error('[widget-config] RPC error:', error)
      return new Response(
        JSON.stringify({ error: 'Internal error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Widget not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Respuesta con cache suave (5 min) para no hammer el API en cada load
    return new Response(
      JSON.stringify({ channel_id: channelId, settings: data }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        }
      }
    )
  } catch (e) {
    console.error('[widget-config] Unexpected:', e)
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
