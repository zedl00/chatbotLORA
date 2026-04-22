// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION: widget-session (PÚBLICA, sin JWT)
// Inicia/recupera una sesión del widget.
// Si el visitor_id no existe, crea contacto y sesión.
// Retorna config del widget + conversación activa si hay.
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

interface SessionBody {
  channelId: string
  visitorId: string
  visitorData?: {
    name?: string
    email?: string
    phone?: string
    currentUrl?: string
    referrer?: string
    userAgent?: string
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  let body: SessionBody
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  if (!body.channelId || !body.visitorId) {
    return json({ error: 'channelId y visitorId requeridos' }, 400)
  }

  try {
    // Cargar canal + widget config
    const { data: channel } = await admin
      .from('channels')
      .select('id, organization_id, active, default_persona_id')
      .eq('id', body.channelId)
      .eq('type', 'web_widget')
      .maybeSingle()

    if (!channel || !channel.active) {
      return json({ error: 'Canal no encontrado o inactivo' }, 404)
    }

    const { data: widgetConfig } = await admin
      .from('widget_configs')
      .select('*')
      .eq('channel_id', body.channelId)
      .maybeSingle()

    if (!widgetConfig || !widgetConfig.active) {
      return json({ error: 'Widget no configurado' }, 404)
    }

    // Verificar origen si hay restricciones
    const origin = req.headers.get('origin')
    const allowed = widgetConfig.allowed_origins as string[]
    if (allowed && !allowed.includes('*') && origin && !allowed.some(o => origin.includes(o))) {
      return json({ error: 'Origen no permitido' }, 403)
    }

    // Buscar sesión existente
    const { data: existingSession } = await admin
      .from('widget_sessions')
      .select('*, conversation:conversations(id, ai_active, status)')
      .eq('channel_id', body.channelId)
      .eq('visitor_id', body.visitorId)
      .maybeSingle()

    let sessionData = existingSession

    if (sessionData) {
      // Actualizar last_seen + datos si vienen
      const patch: Record<string, any> = { last_seen_at: new Date().toISOString() }
      if (body.visitorData?.name && !sessionData.visitor_name) patch.visitor_name = body.visitorData.name
      if (body.visitorData?.email && !sessionData.visitor_email) patch.visitor_email = body.visitorData.email
      if (body.visitorData?.phone && !sessionData.visitor_phone) patch.visitor_phone = body.visitorData.phone
      if (body.visitorData) {
        patch.visitor_metadata = {
          ...(sessionData.visitor_metadata || {}),
          current_url: body.visitorData.currentUrl,
          referrer: body.visitorData.referrer,
          user_agent: body.visitorData.userAgent
        }
      }

      const { data: updated } = await admin
        .from('widget_sessions').update(patch).eq('id', sessionData.id)
        .select('*, conversation:conversations(id, ai_active, status)')
        .single()
      sessionData = updated
    } else {
      // Crear contacto
      const contactName = body.visitorData?.name || `Visitante ${body.visitorId.slice(0, 8)}`
      const { data: contact, error: contactErr } = await admin
        .from('contacts')
        .insert({
          organization_id: channel.organization_id,
          full_name: contactName,
          email: body.visitorData?.email ?? null,
          phone: body.visitorData?.phone ?? null,
          channel_identities: { web_widget: body.visitorId },
          tags: ['widget']
        })
        .select('id').single()
      if (contactErr) throw contactErr

      // Crear sesión
      const { data: newSession, error: sesErr } = await admin
        .from('widget_sessions')
        .insert({
          channel_id: body.channelId,
          organization_id: channel.organization_id,
          visitor_id: body.visitorId,
          contact_id: contact.id,
          visitor_name: body.visitorData?.name,
          visitor_email: body.visitorData?.email,
          visitor_phone: body.visitorData?.phone,
          visitor_metadata: {
            current_url: body.visitorData?.currentUrl,
            referrer: body.visitorData?.referrer,
            user_agent: body.visitorData?.userAgent
          }
        })
        .select('*, conversation:conversations(id, ai_active, status)')
        .single()
      if (sesErr) throw sesErr
      sessionData = newSession
    }

    // Cargar mensajes si hay conversación
    let messages: any[] = []
    if (sessionData?.conversation_id) {
      const { data: msgs } = await admin
        .from('messages')
        .select('id, sender_type, content, content_type, created_at')
        .eq('conversation_id', sessionData.conversation_id)
        .order('created_at', { ascending: true })
        .limit(50)
      messages = msgs ?? []
    }

    return json({
      sessionId: sessionData.id,
      conversationId: sessionData.conversation_id,
      aiActive: sessionData.conversation?.ai_active ?? true,
      messages,
      config: {
        brandName: widgetConfig.brand_name,
        logoUrl: widgetConfig.logo_url,
        primaryColor: widgetConfig.primary_color,
        accentColor: widgetConfig.accent_color,
        position: widgetConfig.position,
        launcherIcon: widgetConfig.launcher_icon,
        welcomeTitle: widgetConfig.welcome_title,
        welcomeSubtitle: widgetConfig.welcome_subtitle,
        inputPlaceholder: widgetConfig.input_placeholder,
        offlineMessage: widgetConfig.offline_message,
        requireName: widgetConfig.require_name,
        requireEmail: widgetConfig.require_email,
        requirePhone: widgetConfig.require_phone,
        preChatMessage: widgetConfig.pre_chat_message,
        autoOpen: widgetConfig.auto_open,
        autoOpenDelayMs: widgetConfig.auto_open_delay_ms,
        showPoweredBy: widgetConfig.show_powered_by
      }
    })
  } catch (err) {
    console.error('[widget-session] Error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
