// Ruta: /supabase/functions/user-create/index.ts
// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION: user-create
// Crea un usuario con contraseña temporal que debe cambiar al primer login.
// Requiere permiso 'users.create'.
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!

interface CreateBody {
  email: string
  fullName: string
  roleId: string
  teamId?: string | null
  temporaryPassword: string
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const buf = new Uint8Array(14)
  crypto.getRandomValues(buf)
  for (const b of buf) out += chars[b % chars.length]
  return out + '#'  // asegurar un carácter especial
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  })

  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return new Response('Unauthorized', { status: 401 })

  const { data: allowed } = await userClient.rpc('has_permission', {
    p_user_id: user.id, p_permission_key: 'users.create', p_required_scope: 'all'
  })
  if (!allowed) return new Response('Forbidden', { status: 403 })

  let body: CreateBody
  try { body = await req.json() } catch { return new Response('Invalid JSON', { status: 400 }) }

  if (!body.email || !body.fullName || !body.roleId) {
    return new Response(JSON.stringify({ error: 'email, fullName, roleId requeridos' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const tempPassword = body.temporaryPassword || generateTempPassword()

  const { data: inviterProfile } = await userClient
    .from('users').select('organization_id').eq('id', user.id).single()
  if (!inviterProfile) return new Response('Profile not found', { status: 404 })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  // Crear auth user con flag de reset obligatorio
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: body.email.toLowerCase().trim(),
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: body.fullName,
      must_change_password: true
    }
  })

  if (createErr || !created.user) {
    return new Response(JSON.stringify({ error: createErr?.message ?? 'Error' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Obtener key del rol para legacy field
  const { data: roleData } = await admin
    .from('roles').select('key').eq('id', body.roleId).single()
  const legacyRole = roleData?.key ?? 'agent'

  // Crear public.users
  await admin.from('users').insert({
    id: created.user.id,
    organization_id: inviterProfile.organization_id,
    email: body.email.toLowerCase().trim(),
    full_name: body.fullName,
    role: legacyRole,
    preferences: { must_change_password: true }
  })

  // Asignar rol
  await admin.from('user_roles').insert({
    user_id: created.user.id,
    role_id: body.roleId,
    organization_id: inviterProfile.organization_id,
    team_id: body.teamId ?? null,
    granted_by: user.id,
    granted_reason: 'Usuario creado directamente con contraseña temporal'
  })

  // Crear agent si corresponde
  if (['agent', 'supervisor'].includes(legacyRole)) {
    await admin.from('agents').insert({
      user_id: created.user.id,
      organization_id: inviterProfile.organization_id,
      team_id: body.teamId ?? null
    })
  }

  return new Response(JSON.stringify({
    userId: created.user.id,
    email: body.email,
    temporaryPassword: tempPassword,
    message: 'El usuario debe cambiar su contraseña al primer login'
  }), { status: 201, headers: { 'Content-Type': 'application/json' } })
})
