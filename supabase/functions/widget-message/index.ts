// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION: widget-message (PÚBLICA, sin JWT)
// Recibe un mensaje del visitante del widget:
//   1. Valida sesión
//   2. 🆕 Verifica si el contacto está bloqueado → rechaza
//   3. Si no hay conversación, crea una
//   4. Inserta mensaje del contacto
//   5. Si ai_active, invoca claude-chat → respuesta bot
//   6. Retorna ambos mensajes al widget
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

interface Body {
  sessionId: string
  message: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  let body: Body
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  if (!body.sessionId || !body.message?.trim()) {
    return json({ error: 'sessionId y message requeridos' }, 400)
  }

  try {
    // Cargar sesión
    const { data: session, error: sesErr } = await admin
      .from('widget_sessions')
      .select('*, channel:channels(default_persona_id)')
      .eq('id', body.sessionId)
      .single()

    if (sesErr || !session) return json({ error: 'Sesión no encontrada' }, 404)

    // 🆕 Fix B — Sprint 7.5: verificar si el contacto está bloqueado
    // El contacto puede haber sido bloqueado por un agente después de
    // crear su sesión. En ese caso, rechazamos todos sus mensajes nuevos.
    if (session.contact_id) {
      const { data: contact, error: contactErr } = await admin
        .from('contacts')
        .select('blocked')
        .eq('id', session.contact_id)
        .maybeSingle()

      if (contactErr) {
        console.warn('[widget-message] Error verificando contacto bloqueado:', contactErr)
        // No bloqueamos por error de query: seguimos el flujo normal
      } else if (contact?.blocked === true) {
        // 403: el widget mostrará un mensaje genérico al usuario
        console.info('[widget-message] Mensaje rechazado: contacto bloqueado', session.contact_id)
        return json({
          error: 'contact_blocked',
          message: 'No podemos procesar tu mensaje en este momento.'
        }, 403)
      }
    }

    let conversationId = session.conversation_id

    // Si no hay conversación, crear una
    if (!conversationId) {
      const { data: newConv, error: convErr } = await admin
        .from('conversations')
        .insert({
          organization_id: session.organization_id,
          contact_id: session.contact_id,
          channel_id: session.channel_id,
          channel_type: 'web_widget',
          status: 'open',
          ai_active: true,
          bot_persona_id: session.channel?.default_persona_id ?? null,
          tags: ['widget']
        })
        .select('id').single()
      if (convErr) throw convErr
      conversationId = newConv.id

      await admin
        .from('widget_sessions')
        .update({ conversation_id: conversationId })
        .eq('id', session.id)
    }

    // Insertar mensaje del contacto
    const { data: contactMsg, error: msgErr } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        organization_id: session.organization_id,
        sender_type: 'contact',
        content: body.message.trim(),
        content_type: 'text',
        status: 'delivered'
      })
      .select('id, content, sender_type, created_at').single()
    if (msgErr) throw msgErr

    // Verificar si la conversación tiene IA activa
    const { data: conv } = await admin
      .from('conversations')
      .select('ai_active, agent_id')
      .eq('id', conversationId)
      .single()

    // Si hay IA activa y NO hay agente asignado, invocar bot
    if (conv?.ai_active && !conv.agent_id) {
      try {
        const chatResponse = await fetch(`${SUPABASE_URL}/functions/v1/claude-chat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SERVICE_ROLE}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ conversationId })
        })

        if (chatResponse.ok) {
          const chatResult = await chatResponse.json()
          return json({
            success: true,
            conversationId,
            contactMessage: contactMsg,
            botMessage: {
              id: chatResult.messageId,
              content: chatResult.response,
              sender_type: 'bot',
              created_at: new Date().toISOString()
            },
            handoffDetected: chatResult.handoffDetected
          })
        } else {
          // Bot falló: retornar solo el mensaje del contacto
          const errData = await chatResponse.json().catch(() => ({}))
          console.warn('[widget-message] Bot falló:', errData)
          return json({
            success: true,
            conversationId,
            contactMessage: contactMsg,
            botError: errData?.error ?? 'Bot no disponible temporalmente'
          })
        }
      } catch (e) {
        console.warn('[widget-message] Error invocando bot:', e)
        return json({
          success: true,
          conversationId,
          contactMessage: contactMsg,
          botError: 'Bot no disponible'
        })
      }
    }

    // Sin bot, conversación pasa a agente humano
    return json({
      success: true,
      conversationId,
      contactMessage: contactMsg,
      awaitingHuman: true
    })

  } catch (err) {
    console.error('[widget-message] Error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
