// Ruta: /supabase/functions/user-accept-invite/index.ts
// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION: user-accept-invite
// Acepta una invitación:
//   1. Valida el token y que no haya expirado.
//   2. Crea el usuario en auth.users (con la contraseña que eligió).
//   3. Crea el registro en public.users.
//   4. Asigna el rol de la invitación vía user_roles.
//   5. Marca la invitación como 'accepted'.
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface AcceptBody {
  token: string
  password: string
  fullName?: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body: AcceptBody
  try { body = await req.json() } catch { return new Response('Invalid JSON', { status: 400 }) }

  if (!body.token || !body.password) {
    return new Response(JSON.stringify({ error: 'token y password requeridos' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }
  if (body.password.length < 8) {
    return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  // 1. Buscar la invitación
  const { data: invitation } = await admin
    .from('invitations')
    .select('*, role:roles(key)')
    .eq('token', body.token)
    .maybeSingle()

  if (!invitation) {
    return new Response(JSON.stringify({ error: 'Invitación no encontrada' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    })
  }

  if (invitation.status !== 'pending') {
    return new Response(JSON.stringify({ error: `La invitación ya está ${invitation.status}` }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  if (new Date(invitation.expires_at) < new Date()) {
    await admin.from('invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id)
    return new Response(JSON.stringify({ error: 'La invitación expiró' }), {
      status: 410, headers: { 'Content-Type': 'application/json' }
    })
  }

  // 2. Crear auth.users (o reutilizar si ya existe con ese email)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: invitation.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.fullName ?? null }
  })

  if (createErr || !created.user) {
    console.error('[accept-invite] auth createUser:', createErr)
    return new Response(JSON.stringify({ error: createErr?.message ?? 'Error al crear usuario' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const newUserId = created.user.id

  // 3. Crear public.users
  const legacyRole = (invitation as any).role?.key ?? 'agent'
  const { error: profErr } = await admin
    .from('users')
    .insert({
      id: newUserId,
      organization_id: invitation.organization_id,
      email: invitation.email,
      full_name: body.fullName ?? null,
      role: legacyRole  // campo legacy por compatibilidad
    })
  if (profErr) {
    console.error('[accept-invite] users insert:', profErr)
    // Rollback: eliminar el auth user creado
    await admin.auth.admin.deleteUser(newUserId)
    return new Response(JSON.stringify({ error: 'Error al crear perfil' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  // 4. Asignar el rol
  await admin.from('user_roles').insert({
    user_id: newUserId,
    role_id: invitation.role_id,
    organization_id: invitation.organization_id,
    team_id: invitation.team_id,
    granted_by: invitation.invited_by,
    granted_reason: 'Asignado desde invitación'
  })

  // 5. Si es un agente, crear perfil en tabla agents
  if (['agent', 'supervisor'].includes(legacyRole)) {
    await admin.from('agents').insert({
      user_id: newUserId,
      organization_id: invitation.organization_id,
      team_id: invitation.team_id
    })
  }

  // 6. Marcar invitación como aceptada
  await admin
    .from('invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: newUserId
    })
    .eq('id', invitation.id)

  return new Response(JSON.stringify({
    userId: newUserId,
    email: invitation.email,
    organizationId: invitation.organization_id
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})
