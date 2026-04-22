// Ruta: /supabase/functions/meta-webhook/index.ts
// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION: meta-webhook
// Webhook unificado para WhatsApp, Instagram DM y Messenger.
//
// GET  → verificación de webhook (hub.challenge)
// POST → recepción de mensajes (valida firma HMAC antes de procesar)
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { crypto } from 'jsr:@std/crypto'
import { encodeHex } from 'jsr:@std/encoding/hex'

// ── ENV ────────────────────────────────────────────────────────
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const META_VERIFY_TOKEN    = Deno.env.get('META_WA_VERIFY_TOKEN')!
const META_APP_SECRET      = Deno.env.get('META_APP_SECRET')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

// ── Validación HMAC del payload Meta ──────────────────────────
async function validateSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader?.startsWith('sha256=')) return false
  const expected = signatureHeader.slice('sha256='.length)

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(META_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const computed = encodeHex(new Uint8Array(signature))

  // Comparación constante para evitar timing attacks
  if (expected.length !== computed.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ computed.charCodeAt(i)
  }
  return diff === 0
}

// ── Normalización del payload WhatsApp ────────────────────────
interface NormalizedMsg {
  channelType: 'whatsapp' | 'instagram' | 'messenger'
  externalId: string
  from: { externalId: string; name?: string; phone?: string }
  content: string | null
  contentType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location'
  mediaUrl?: string
  timestamp: string
  channelExternalId: string  // phone_number_id, page_id
}

function normalizeWhatsApp(entry: any): NormalizedMsg[] {
  const out: NormalizedMsg[] = []
  for (const ch of entry.changes ?? []) {
    const value = ch.value ?? {}
    const phoneNumberId = value.metadata?.phone_number_id
    const contacts = value.contacts ?? []
    for (const msg of value.messages ?? []) {
      const contact = contacts.find((c: any) => c.wa_id === msg.from) ?? {}
      out.push({
        channelType: 'whatsapp',
        externalId: msg.id,
        from: {
          externalId: msg.from,
          name: contact.profile?.name,
          phone: msg.from
        },
        content: msg.text?.body ?? null,
        contentType: msg.type === 'text' ? 'text' : msg.type,
        timestamp: new Date(Number(msg.timestamp) * 1000).toISOString(),
        channelExternalId: phoneNumberId
      })
    }
  }
  return out
}

// ── Handler principal ─────────────────────────────────────────
Deno.serve(async (req) => {
  const url = new URL(req.url)

  // ─── Verificación del webhook (Meta lo hace al configurar) ──
  if (req.method === 'GET') {
    const mode      = url.searchParams.get('hub.mode')
    const token     = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // ─── Recepción de mensajes ────────────────────────────────
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')
  const valid = await validateSignature(rawBody, signature)
  if (!valid) {
    console.error('[meta-webhook] Firma inválida')
    return new Response('Invalid signature', { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  try {
    for (const entry of payload.entry ?? []) {
      // WhatsApp: entry.changes[].value.messages[]
      if (payload.object === 'whatsapp_business_account') {
        const messages = normalizeWhatsApp(entry)
        for (const msg of messages) {
          await processMessage(msg)
        }
      }
      // TODO: Instagram, Messenger
    }
    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('[meta-webhook] Error procesando:', err)
    // Responder 200 igualmente para que Meta no reintente indefinidamente;
    // el error queda en logs y se audita.
    return new Response('OK', { status: 200 })
  }
})

// ── Procesamiento de un mensaje normalizado ──────────────────
async function processMessage(msg: NormalizedMsg) {
  // 1. Buscar el canal por external_id y tipo
  const { data: channel } = await supabase
    .from('channels')
    .select('*')
    .eq('type', msg.channelType)
    .eq('external_id', msg.channelExternalId)
    .eq('active', true)
    .maybeSingle()

  if (!channel) {
    console.warn(`[meta-webhook] Canal no encontrado: ${msg.channelType}/${msg.channelExternalId}`)
    return
  }

  const orgId = channel.organization_id

  // 2. Buscar o crear contacto
  const identityKey = `channel_identities->>${msg.channelType}`
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('*')
    .eq('organization_id', orgId)
    .eq(identityKey, msg.from.externalId)
    .maybeSingle()

  let contactId: string
  if (existingContact) {
    contactId = existingContact.id
    await supabase
      .from('contacts')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', contactId)
  } else {
    const { data: created, error } = await supabase
      .from('contacts')
      .insert({
        organization_id: orgId,
        full_name: msg.from.name ?? null,
        phone: msg.from.phone ?? null,
        channel_identities: { [msg.channelType]: msg.from.externalId }
      })
      .select('id')
      .single()
    if (error) throw error
    contactId = created!.id
  }

  // 3. Buscar o crear conversación activa
  const { data: activeConv } = await supabase
    .from('conversations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('contact_id', contactId)
    .eq('channel_id', channel.id)
    .in('status', ['open', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let conversationId: string
  if (activeConv) {
    conversationId = activeConv.id
  } else {
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        organization_id: orgId,
        contact_id: contactId,
        channel_id: channel.id,
        channel_type: msg.channelType,
        status: 'open',
        ai_active: true
      })
      .select('id')
      .single()
    if (error) throw error
    conversationId = newConv!.id
  }

  // 4. Insertar el mensaje entrante
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    organization_id: orgId,
    sender_type: 'contact',
    sender_id: contactId,
    content: msg.content,
    content_type: msg.contentType,
    media_url: msg.mediaUrl ?? null,
    external_id: msg.externalId,
    status: 'delivered'
  })

  // 5. TODO Sprint 3: invocar a claude-chat si ai_active
  // await supabase.functions.invoke('claude-chat', { body: { conversationId } })
}
