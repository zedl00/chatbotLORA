// Ruta: /src/repository/supabase/user.repo.ts
// ═══════════════════════════════════════════════════════════════
// MODIFICADO en Sprint 6.8:
//   - Fix error PGRST201: "Could not embed because more than one
//     relationship was found for 'users' and 'user_roles'"
//   - Causa: user_roles tiene 2 FKs hacia users (user_id + granted_by)
//   - Fix: especificar la FK explícitamente con el nombre del constraint
// ═══════════════════════════════════════════════════════════════
import { supabase } from '@/services/supabase.client'
import type { User, UserRole as LegacyRole } from '@/types/user.types'
import type { Role } from '@/types/rbac.types'

function toUser(r: any): User {
  return {
    id: r.id, organizationId: r.organization_id, email: r.email,
    fullName: r.full_name, avatarUrl: r.avatar_url, phone: r.phone,
    role: r.role, active: r.active, lastSeenAt: r.last_seen_at,
    preferences: r.preferences ?? {}, createdAt: r.created_at, updatedAt: r.updated_at
  }
}

export interface UserWithRoles extends User {
  roles: Role[]
  // hasActiveInvite?: boolean
}

export class SupabaseUserRepo {
  async listUsers(organizationId: string): Promise<UserWithRoles[]> {
    // 🆕 Sprint 6.8 — FIX PGRST201
    // Antes: user_roles(role:roles(*)) → ambigüedad (FKs user_id y granted_by)
    // Ahora: user_roles!user_roles_user_id_fkey(role:roles(*))
    //        → especifica que queremos los roles DEL usuario (no los asignados por él)
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey(
          role:roles(*)
        )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
    if (error) throw error

    return (data ?? []).map((r: any) => ({
      ...toUser(r),
      roles: (r.user_roles ?? [])
        .filter((ur: any) => ur.role !== null)
        .map((ur: any) => ({
          id: ur.role.id,
          organizationId: ur.role.organization_id,
          key: ur.role.key,
          name: ur.role.name,
          description: ur.role.description,
          color: ur.role.color,
          icon: ur.role.icon,
          isSystem: ur.role.is_system,
          priority: ur.role.priority,
          active: ur.role.active,
          createdBy: ur.role.created_by,
          createdAt: ur.role.created_at,
          updatedAt: ur.role.updated_at
        }))
    }))
  }

  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? toUser(data) : null
  }

  async updateUser(id: string, patch: Partial<User>): Promise<User> {
    const p: Record<string, any> = {}
    if (patch.fullName !== undefined) p.full_name = patch.fullName
    if (patch.avatarUrl !== undefined) p.avatar_url = patch.avatarUrl
    if (patch.phone !== undefined) p.phone = patch.phone
    if (patch.active !== undefined) p.active = patch.active
    if (patch.preferences !== undefined) p.preferences = patch.preferences

    const { data, error } = await supabase
      .from('users').update(p).eq('id', id).select().single()
    if (error) throw error
    return toUser(data)
  }

  async deactivateUser(id: string): Promise<void> {
    const { error } = await supabase
      .from('users').update({ active: false }).eq('id', id)
    if (error) throw error
  }

  async reactivateUser(id: string): Promise<void> {
    const { error } = await supabase
      .from('users').update({ active: true }).eq('id', id)
    if (error) throw error
  }

  /**
   * Crea el registro en public.users tras el signup.
   * Se invoca desde la Edge Function user-accept-invite.
   * NO se debe llamar desde el cliente sin token de invitación válido.
   */
  async provisionFromAuth(input: {
    authUserId: string
    organizationId: string
    email: string
    fullName?: string | null
    legacyRole?: LegacyRole
  }): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: input.authUserId,
        organization_id: input.organizationId,
        email: input.email,
        full_name: input.fullName ?? null,
        role: input.legacyRole ?? 'agent'
      })
      .select().single()
    if (error) throw error
    return toUser(data)
  }
}
