// Ruta: /src/repository/supabase/rbac.repo.ts
import { supabase } from '@/services/supabase.client'
import type {
  Permission,
  Role,
  RoleWithPermissions,
  UserRole,
  UserPermission,
  EffectivePermission,
  Invitation,
  InvitationWithRole,
  PermissionAuditEntry,
  PermissionScope
} from '@/types/rbac.types'

// ═══════════════════════════════════════════════════════════════
// Mappers
// ═══════════════════════════════════════════════════════════════
function toPermission(r: any): Permission {
  return {
    id: r.id, key: r.key, resource: r.resource, action: r.action,
    description: r.description, scopeable: r.scopeable, category: r.category,
    isDangerous: r.is_dangerous, sortOrder: r.sort_order, createdAt: r.created_at
  }
}

function toRole(r: any): Role {
  return {
    id: r.id, organizationId: r.organization_id, key: r.key, name: r.name,
    description: r.description, color: r.color, icon: r.icon,
    isSystem: r.is_system, priority: r.priority, active: r.active,
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at
  }
}

function toUserRole(r: any): UserRole {
  return {
    id: r.id, userId: r.user_id, roleId: r.role_id, organizationId: r.organization_id,
    expiresAt: r.expires_at, teamId: r.team_id, grantedBy: r.granted_by,
    grantedReason: r.granted_reason, createdAt: r.created_at
  }
}

function toUserPermission(r: any): UserPermission {
  return {
    id: r.id, userId: r.user_id, permissionId: r.permission_id,
    organizationId: r.organization_id, scope: r.scope, grant: r.grant,
    expiresAt: r.expires_at, grantedBy: r.granted_by,
    grantedReason: r.granted_reason, createdAt: r.created_at
  }
}

function toInvitation(r: any): Invitation {
  return {
    id: r.id, organizationId: r.organization_id, email: r.email, token: r.token,
    roleId: r.role_id, teamId: r.team_id, status: r.status,
    invitedBy: r.invited_by, acceptedAt: r.accepted_at, acceptedBy: r.accepted_by,
    revokedAt: r.revoked_at, message: r.message, expiresAt: r.expires_at,
    createdAt: r.created_at
  }
}

function toAuditEntry(r: any): PermissionAuditEntry {
  return {
    id: r.id, organizationId: r.organization_id,
    actorId: r.actor_id, actorEmail: r.actor_email,
    targetUserId: r.target_user_id, targetEmail: r.target_email,
    action: r.action, entityType: r.entity_type, entityId: r.entity_id,
    entityName: r.entity_name, beforeState: r.before_state, afterState: r.after_state,
    reason: r.reason, ipAddress: r.ip_address, userAgent: r.user_agent,
    createdAt: r.created_at
  }
}

// ═══════════════════════════════════════════════════════════════
// Repository
// ═══════════════════════════════════════════════════════════════
export class SupabaseRbacRepo {
  // ─── PERMISSIONS (catálogo global) ──────────────────────────
  async getAllPermissions(): Promise<Permission[]> {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) throw error
    return (data ?? []).map(toPermission)
  }

  // ─── ROLES ──────────────────────────────────────────────────
  async listRoles(organizationId: string): Promise<Role[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .or(`is_system.eq.true,organization_id.eq.${organizationId}`)
      .eq('active', true)
      .order('priority', { ascending: false })
    if (error) throw error
    return (data ?? []).map(toRole)
  }

  async getRoleWithPermissions(roleId: string): Promise<RoleWithPermissions | null> {
    const { data, error } = await supabase
      .from('roles')
      .select(`
        *,
        role_permissions(
          scope,
          permissions(*)
        )
      `)
      .eq('id', roleId)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      ...toRole(data),
      permissions: (data.role_permissions ?? []).map((rp: any) => ({
        scope: rp.scope as PermissionScope,
        permission: toPermission(rp.permissions)
      }))
    }
  }

  async createRole(input: {
    organizationId: string
    key: string
    name: string
    description?: string
    color?: string
    icon?: string
    permissions: Array<{ permissionId: string; scope: PermissionScope }>
  }): Promise<Role> {
    const { data: role, error } = await supabase
      .from('roles')
      .insert({
        organization_id: input.organizationId,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? '#64748b',
        icon: input.icon ?? null,
        is_system: false
      })
      .select()
      .single()
    if (error) throw error

    // Insertar permisos del rol
    if (input.permissions.length > 0) {
      const rows = input.permissions.map((p) => ({
        role_id: role.id,
        permission_id: p.permissionId,
        scope: p.scope
      }))
      const { error: rpErr } = await supabase.from('role_permissions').insert(rows)
      if (rpErr) throw rpErr
    }

    return toRole(role)
  }

  async updateRole(roleId: string, input: Partial<Role>): Promise<Role> {
    const patch: Record<string, any> = {}
    if (input.name !== undefined)        patch.name = input.name
    if (input.description !== undefined) patch.description = input.description
    if (input.color !== undefined)       patch.color = input.color
    if (input.icon !== undefined)        patch.icon = input.icon
    if (input.active !== undefined)      patch.active = input.active

    const { data, error } = await supabase
      .from('roles').update(patch).eq('id', roleId).select().single()
    if (error) throw error
    return toRole(data)
  }

  async updateRolePermissions(
    roleId: string,
    permissions: Array<{ permissionId: string; scope: PermissionScope }>
  ): Promise<void> {
    // Estrategia simple: borrar todas y reinsertar.
    // En alta concurrencia conviene un diff; aquí es suficiente.
    const { error: delErr } = await supabase
      .from('role_permissions').delete().eq('role_id', roleId)
    if (delErr) throw delErr

    if (permissions.length > 0) {
      const rows = permissions.map((p) => ({
        role_id: roleId,
        permission_id: p.permissionId,
        scope: p.scope
      }))
      const { error } = await supabase.from('role_permissions').insert(rows)
      if (error) throw error
    }
  }

  async deleteRole(roleId: string): Promise<void> {
    const { error } = await supabase.from('roles').delete().eq('id', roleId)
    if (error) throw error
  }

  // ─── USER ROLES ─────────────────────────────────────────────
  async getUserRoles(userId: string): Promise<Array<UserRole & { role: Role }>> {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*, roles(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r: any) => ({ ...toUserRole(r), role: toRole(r.roles) }))
  }

  async assignRoleToUser(input: {
    userId: string
    roleId: string
    organizationId: string
    teamId?: string | null
    expiresAt?: string | null
    reason?: string
  }): Promise<UserRole> {
    const { data, error } = await supabase
      .from('user_roles')
      .insert({
        user_id: input.userId,
        role_id: input.roleId,
        organization_id: input.organizationId,
        team_id: input.teamId ?? null,
        expires_at: input.expiresAt ?? null,
        granted_reason: input.reason ?? null
      })
      .select()
      .single()
    if (error) throw error
    return toUserRole(data)
  }

  async revokeUserRole(userRoleId: string): Promise<void> {
    const { error } = await supabase.from('user_roles').delete().eq('id', userRoleId)
    if (error) throw error
  }

  // ─── USER PERMISSIONS (overrides directos) ──────────────────
  async getUserDirectPermissions(userId: string): Promise<Array<UserPermission & { permission: Permission }>> {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*, permissions(*)')
      .eq('user_id', userId)
    if (error) throw error
    return (data ?? []).map((r: any) => ({ ...toUserPermission(r), permission: toPermission(r.permissions) }))
  }

  async grantPermission(input: {
    userId: string
    permissionId: string
    organizationId: string
    scope?: PermissionScope
    expiresAt?: string | null
    reason?: string
  }): Promise<UserPermission> {
    const { data, error } = await supabase
      .from('user_permissions')
      .insert({
        user_id: input.userId,
        permission_id: input.permissionId,
        organization_id: input.organizationId,
        scope: input.scope ?? 'all',
        grant: true,
        expires_at: input.expiresAt ?? null,
        granted_reason: input.reason ?? null
      })
      .select().single()
    if (error) throw error
    return toUserPermission(data)
  }

  async denyPermission(input: {
    userId: string
    permissionId: string
    organizationId: string
    scope?: PermissionScope
    expiresAt?: string | null
    reason?: string
  }): Promise<UserPermission> {
    const { data, error } = await supabase
      .from('user_permissions')
      .insert({
        user_id: input.userId,
        permission_id: input.permissionId,
        organization_id: input.organizationId,
        scope: input.scope ?? 'all',
        grant: false,
        expires_at: input.expiresAt ?? null,
        granted_reason: input.reason ?? null
      })
      .select().single()
    if (error) throw error
    return toUserPermission(data)
  }

  async removeUserPermission(id: string): Promise<void> {
    const { error } = await supabase.from('user_permissions').delete().eq('id', id)
    if (error) throw error
  }

  // ─── EFFECTIVE PERMISSIONS (función RPC) ────────────────────
  async getEffectivePermissions(userId: string): Promise<EffectivePermission[]> {
    const { data, error } = await supabase.rpc('get_user_permissions', { p_user_id: userId })
    if (error) throw error
    return (data ?? []).map((r: any) => ({
      permissionKey: r.permission_key,
      scope: r.scope,
      source: r.source
    }))
  }

  async hasPermission(
    userId: string,
    permissionKey: string,
    scope: PermissionScope = 'all',
    teamId?: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('has_permission', {
      p_user_id: userId,
      p_permission_key: permissionKey,
      p_required_scope: scope,
      p_team_id: teamId ?? null,
      p_resource_owner: null
    })
    if (error) throw error
    return data === true
  }

  // ─── INVITATIONS ────────────────────────────────────────────
  async listInvitations(organizationId: string): Promise<InvitationWithRole[]> {
    const { data, error } = await supabase
      .from('invitations')
      .select(`
        *,
        role:roles(id, name, color, icon),
        inviter:users!invitations_invited_by_fkey(full_name, email)
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r: any) => ({
      ...toInvitation(r),
      role: r.role,
      inviter: r.inviter
    }))
  }

  async createInvitation(input: {
    organizationId: string
    email: string
    roleId: string
    teamId?: string | null
    message?: string
  }): Promise<Invitation> {
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        organization_id: input.organizationId,
        email: input.email.toLowerCase().trim(),
        role_id: input.roleId,
        team_id: input.teamId ?? null,
        message: input.message ?? null
      })
      .select().single()
    if (error) throw error
    return toInvitation(data)
  }

  async revokeInvitation(id: string): Promise<void> {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  async getInvitationByToken(token: string): Promise<Invitation | null> {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle()
    if (error) throw error
    return data ? toInvitation(data) : null
  }

  // ─── AUDIT LOG ──────────────────────────────────────────────
  async listAuditLog(params: {
    organizationId: string
    targetUserId?: string
    action?: string
    limit?: number
    offset?: number
  }): Promise<{ data: PermissionAuditEntry[]; count: number }> {
    const { limit = 50, offset = 0 } = params
    let q = supabase
      .from('permission_audit_log')
      .select('*', { count: 'exact' })
      .eq('organization_id', params.organizationId)

    if (params.targetUserId) q = q.eq('target_user_id', params.targetUserId)
    if (params.action) q = q.eq('action', params.action)

    q = q.order('created_at', { ascending: false })
         .range(offset, offset + limit - 1)

    const { data, error, count } = await q
    if (error) throw error
    return { data: (data ?? []).map(toAuditEntry), count: count ?? 0 }
  }
}
