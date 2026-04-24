// supabase/functions/widget-csat/index.ts
// ═══════════════════════════════════════════════════════════════
// Recibe el CSAT rating del widget y lo guarda en conversations.
// ═══════════════════════════════════════════════════════════════
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { conversation_id, rating, feedback } = await req.json()

    if (!conversation_id) {
      return jsonResp({ error: 'conversation_id required' }, 400)
    }

    // Validar rating (si se proporciona)
    if (rating !== null && rating !== undefined) {
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return jsonResp({ error: 'rating must be 1-5' }, 400)
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const patch: Record<string, any> = {}
    if (rating !== null && rating !== undefined) patch.csat_score = rating
    if (feedback) patch.csat_feedback = String(feedback).slice(0, 2000)

    if (Object.keys(patch).length === 0) {
      return jsonResp({ ok: true, skipped: true })
    }

    const { error } = await supabase
      .from('conversations')
      .update(patch)
      .eq('id', conversation_id)

    if (error) {
      console.error('[widget-csat] Error:', error)
      return jsonResp({ error: 'DB error' }, 500)
    }

    return jsonResp({ ok: true })
  } catch (e) {
    console.error('[widget-csat] Unexpected:', e)
    return jsonResp({ error: 'Internal' }, 500)
  }
})

function jsonResp(obj: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
