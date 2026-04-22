// Ruta: /supabase/functions/ai-test-message/index.ts
// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION: ai-test-message
// Inyecta un mensaje de prueba (simula a un contacto) para probar el bot
// sin tener canales reales conectados.
//
// Flujo:
//   1. Usa o crea un contacto de prueba
//   2. Usa o crea una conversación con el canal "web_widget" (ya viene en seed)
//   3. Inserta el mensaje como si el contacto hubiera escrito
//   4. Invoca claude-chat → el bot responde
//   5. Retorna ambos mensajes + IDs para el frontend
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/anthropic.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!

interface Body {
  message: string
  /** ID de la persona a usar (opcional, sino usa la default) */
  personaId?: string
  /** Si se provee, reutilizar esta conversación; si no, crea una nueva */
  conversationId?: string
  /** Nombre del contacto de prueba */
  contactName?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  })
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  let body: Body
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  if (!body.message || body.message.trim().length === 0) {
    return json({ error: 'message requerido' }, 400)
  }

  try {
    // Obtener organization_id del user
    const { data: profile } = await userClient
      .from('users').select('organization_id, full_name, email')
      .eq('id', user.id).single()
    if (!profile) return json({ error: 'Profile not found' }, 404)

    const orgId = profile.organization_id

    // Buscar canal web_widget (seed ya lo crea)
    const { data: channel } = await admin
      .from('channels')
      .select('id')
      .eq('organization_id', orgId)
      .eq('type', 'web_widget')
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (!channel) {
      return json({
        error: 'No hay canal web_widget. Crea uno en /admin/channels o ejecuta el seed.'
      }, 400)
    }

    let conversationId = body.conversationId

    if (!conversationId) {
      // Buscar o crear contacto de prueba (identidad única por usuario que prueba)
      const contactName = body.contactName ?? `[TEST] ${profile.full_name ?? profile.email}`
      const testIdentity = `test-playground-${user.id}`

      let { data: contact } = await admin
        .from('contacts')
        .select('id')
        .eq('organization_id', orgId)
        .filter('channel_identities->>web_widget', 'eq', testIdentity)
        .maybeSingle()

      if (!contact) {
        const { data: newContact, error: ctErr } = await admin
          .from('contacts')
          .insert({
            organization_id: orgId,
            full_name: contactName,
            channel_identities: { web_widget: testIdentity },
            tags: ['test']
          })
          .select('id')
          .single()
        if (ctErr) throw ctErr
        contact = newContact
      }

      // Crear conversación
      const { data: newConv, error: convErr } = await admin
        .from('conversations')
        .insert({
          organization_id: orgId,
          contact_id: contact!.id,
          channel_id: channel.id,
          channel_type: 'web_widget',
          status: 'open',
          ai_active: true,
          bot_persona_id: body.personaId ?? null,
          subject: '[Playground] Conversación de prueba',
          tags: ['test', 'playground']
        })
        .select('id')
        .single()
      if (convErr) throw convErr
      conversationId = newConv.id
    }

    // Insertar el mensaje del "contacto"
    const { data: contactMsg, error: msgErr } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        organization_id: orgId,
        sender_type: 'contact',
        content: body.message,
        content_type: 'text',
        status: 'delivered',
        metadata: { source: 'playground', test_user: user.id }
      })
      .select('id')
      .single()
    if (msgErr) throw msgErr

    // Invocar claude-chat (SIN dryRun; queremos que inserte el mensaje del bot)
    const chatResponse = await fetch(`${SUPABASE_URL}/functions/v1/claude-chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversationId,
        personaId: body.personaId
      })
    })

    const chatResult = await chatResponse.json()

    if (!chatResponse.ok) {
      return json({
        error: 'Error del bot',
        details: chatResult,
        conversationId,
        contactMessageId: contactMsg.id
      }, chatResponse.status)
    }

    return json({
      success: true,
      conversationId,
      contactMessageId: contactMsg.id,
      botMessageId: chatResult.messageId,
      botResponse: chatResult.response,
      handoffDetected: chatResult.handoffDetected,
      tokensUsed: chatResult.tokensUsed,
      costUsd: chatResult.costUsd,
      latencyMs: chatResult.latencyMs,
      ragUsed: chatResult.ragUsed
    })

  } catch (err) {
    console.error('[ai-test-message] Error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
