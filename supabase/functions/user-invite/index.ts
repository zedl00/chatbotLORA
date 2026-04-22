// Ruta: /supabase/functions/user-invite/index.ts
// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION: user-invite
// Envía una invitación por email con token único.
// El link apunta a /auth/accept-invite?token=XXX en el frontend.
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY')
const RESEND_FROM      = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@example.com'
const APP_URL          = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

interface InviteBody {
  email: string
  roleId: string
  teamId?: string | null
  message?: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Autenticar al usuario que está invitando
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  })

  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return new Response('Unauthorized', { status: 401 })

  // Verificar permiso 'users.invite' usando la función RPC
  const { data: allowed } = await userClient.rpc('has_permission', {
    p_user_id: user.id,
    p_permission_key: 'users.invite',
    p_required_scope: 'all'
  })
  if (!allowed) return new Response('Forbidden', { status: 403 })

  let body: InviteBody
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  if (!body.email || !body.roleId) {
    return new Response('Missing email or roleId', { status: 400 })
  }

  // Obtener organization_id del invitador
  const { data: inviterProfile } = await userClient
    .from('users').select('organization_id, full_name, email')
    .eq('id', user.id).single()

  if (!inviterProfile) return new Response('Profile not found', { status: 404 })

  // Crear invitación con service role (bypass RLS para esto)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  const { data: invitation, error: invErr } = await admin
    .from('invitations')
    .insert({
      organization_id: inviterProfile.organization_id,
      email: body.email.toLowerCase().trim(),
      role_id: body.roleId,
      team_id: body.teamId ?? null,
      invited_by: user.id,
      message: body.message ?? null
    })
    .select('*, role:roles(name), org:organizations(name)')
    .single()

  if (invErr) {
    console.error('[user-invite] Error creating invitation:', invErr)
    return new Response(JSON.stringify({ error: invErr.message }), { status: 400 })
  }

  // Enviar email con Resend (si está configurado)
  if (RESEND_API_KEY) {
    const inviteLink = `${APP_URL}/auth/accept-invite?token=${invitation.token}`
    const roleName = (invitation as any).role?.name ?? 'miembro'
    const orgName  = (invitation as any).org?.name ?? 'la organización'

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: body.email,
          subject: `Te invitaron a unirte a ${orgName}`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: auto; padding: 24px;">
              <h2 style="color: #155df5;">¡Hola!</h2>
              <p><strong>${inviterProfile.full_name ?? inviterProfile.email}</strong> te invitó a unirte a <strong>${orgName}</strong> como <strong>${roleName}</strong>.</p>
              ${body.message ? `<blockquote style="border-left: 4px solid #cbd5e1; padding-left: 12px; color: #475569; margin: 16px 0;">${body.message}</blockquote>` : ''}
              <p><a href="${inviteLink}" style="display: inline-block; background: #155df5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">Aceptar invitación</a></p>
              <p style="color: #64748b; font-size: 13px;">Si no esperabas este correo, puedes ignorarlo. La invitación expira en 7 días.</p>
            </div>
          `
        })
      })
    } catch (err) {
      console.error('[user-invite] Error sending email:', err)
      // No fallar la creación si el email falla; el admin puede copiar el link manualmente
    }
  }

  return new Response(JSON.stringify({
    id: invitation.id,
    email: invitation.email,
    token: invitation.token,
    inviteLink: `${APP_URL}/auth/accept-invite?token=${invitation.token}`
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  })
})
