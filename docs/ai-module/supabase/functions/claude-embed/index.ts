// Ruta: /supabase/functions/claude-embed/index.ts
// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION: claude-embed
// Procesa un documento de knowledge_base:
//   1. Divide el content en chunks (500-800 tokens c/u con solapamiento)
//   2. Genera embedding de cada chunk via Voyage AI
//   3. Inserta/actualiza en knowledge_chunks
//
// Nota: Anthropic no ofrece embeddings; usamos Voyage AI (partner oficial de Anthropic).
// Tier gratis: 50M tokens/mes. Registro en https://www.voyageai.com
//
// Si no hay VOYAGE_API_KEY configurada, retorna error con instrucciones.
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/anthropic.ts'

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VOYAGE_API_KEY  = Deno.env.get('VOYAGE_API_KEY')
const EMBEDDING_MODEL = 'voyage-3'   // 1024 dimensiones

interface Body {
  documentId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  if (!VOYAGE_API_KEY) {
    return json({
      error: 'VOYAGE_API_KEY no configurada',
      hint: 'Obtén una gratis en https://www.voyageai.com y ejecuta: supabase secrets set VOYAGE_API_KEY=pa-...'
    }, 503)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  })

  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  let body: Body
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  try {
    // Cargar documento con RLS del usuario
    const { data: doc } = await userClient
      .from('knowledge_base')
      .select('id, organization_id, title, content')
      .eq('id', body.documentId)
      .single()

    if (!doc) return json({ error: 'Documento no encontrado o sin acceso' }, 404)
    if (!doc.content || doc.content.trim().length < 10) {
      return json({ error: 'Documento vacío o muy corto' }, 400)
    }

    // Chunking: dividir por párrafos, agrupar hasta ~2000 chars c/u
    const chunks = chunkText(doc.content, 2000, 200)
    if (chunks.length === 0) return json({ error: 'No se generaron chunks' }, 400)

    // Generar embeddings en batches (Voyage acepta hasta 128 textos)
    const batchSize = 64
    const allEmbeddings: number[][] = []

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${VOYAGE_API_KEY}`
        },
        body: JSON.stringify({
          input: batch,
          model: EMBEDDING_MODEL,
          input_type: 'document'
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Voyage API ${response.status}: ${errText}`)
      }

      const data = await response.json()
      for (const item of data.data) {
        allEmbeddings.push(item.embedding)
      }
    }

    // Borrar chunks viejos
    await admin.from('knowledge_chunks').delete().eq('document_id', doc.id)

    // Insertar nuevos chunks
    const rows = chunks.map((content, idx) => ({
      organization_id: doc.organization_id,
      document_id:     doc.id,
      chunk_index:     idx,
      content,
      token_count:     Math.ceil(content.length / 4),   // aprox
      embedding:       allEmbeddings[idx],
      embedding_model: EMBEDDING_MODEL
    }))

    const { error: insErr } = await admin.from('knowledge_chunks').insert(rows)
    if (insErr) throw insErr

    // Registrar uso (solo para dashboard; el modelo de embed tiene su propia facturación)
    const totalTokens = chunks.reduce((sum, c) => sum + Math.ceil(c.length / 4), 0)
    await admin.rpc('register_ai_usage', {
      p_org_id: doc.organization_id,
      p_conversation_id: null,
      p_operation: 'embed',
      p_model: EMBEDDING_MODEL,
      p_input_tokens: totalTokens,
      p_output_tokens: 0,
      p_cost_usd_micro: 0,    // voyage-3 es gratis en tier básico
      p_success: true,
      p_requested_by: user.id
    })

    return json({
      success: true,
      chunks: chunks.length,
      totalTokens
    })

  } catch (err) {
    console.error('[claude-embed] Error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

// ═══════════════════════════════════════════════════════════════
// Text chunking: divide por párrafos con solapamiento
// ═══════════════════════════════════════════════════════════════
function chunkText(text: string, maxChars: number, overlap: number): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim())
      // Solapamiento: tomar últimos N chars del chunk actual
      current = current.slice(Math.max(0, current.length - overlap))
    }
    current += (current ? '\n\n' : '') + para
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
