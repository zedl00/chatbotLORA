// Ruta: /src/repository/supabase/organizations.repo.ts
// ═══════════════════════════════════════════════════════════════
// Repositorio para operaciones sobre la tabla organizations.
// Sprint 5 · Bloque 3.
// ═══════════════════════════════════════════════════════════════
import { supabase } from '@/services/supabase.client'
import { buildInvitationUrl, buildSubdomainUrl } from '@/composables/useOrganizationContext'
import type {
  OrganizationWithStats,
  CreateOrganizationInput,
  CreateOrganizationResult,
  SubdomainValidation
} from '@/types/organization.types'

// ───────────────────────────────────────────────────────────────
// Tipos del resultado de los RPCs (Supabase los devuelve en snake_case)
// ───────────────────────────────────────────────────────────────
interface CreateOrgRpcResult {
  org_id: string
  invitation_token: string | null
  admin_role_id: string
  channel_id: string
  widget_config_id: string
}

interface GetOrgBySubdomainRpcResult {
  id: string
  name: string
  subdomain: string
  brand_name: string | null
  primary_color: string | null
  logo_url: string | null
  logo_full_url: string | null
  active: boolean
}

export class SupabaseOrganizationsRepo {
  // ═════════════════════════════════════════════════════════════
  // Listar todas las organizaciones (solo super_admin)
  // ═════════════════════════════════════════════════════════════
  async listAll(): Promise<OrganizationWithStats[]> {
    const { data, error } = await supabase.rpc('list_all_organizations')

    if (error) throw new Error(`Error listando organizaciones: ${error.message}`)
    if (!data) return []

    return (data as any[]).map((r) => this.toOrgWithStats(r))
  }

  // ═════════════════════════════════════════════════════════════
  // Validar disponibilidad de un subdomain
  // ═════════════════════════════════════════════════════════════
  async validateSubdomain(subdomain: string): Promise<SubdomainValidation> {
    const s = subdomain.trim().toLowerCase()

    if (!s) {
      return { status: 'idle', message: '' }
    }
    if (s.length < 2) {
      return { status: 'invalid', message: 'Debe tener al menos 2 caracteres' }
    }
    if (s.length > 63) {
      return { status: 'invalid', message: 'Máximo 63 caracteres' }
    }
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(s)) {
      return {
        status: 'invalid',
        message: 'Solo minúsculas, números y guiones. No puede empezar ni terminar con guión.'
      }
    }

    const { data: reserved } = await supabase
      .from('reserved_subdomains')
      .select('subdomain')
      .eq('subdomain', s)
      .maybeSingle()

    if (reserved) {
      return { status: 'reserved', message: 'Este subdomain está reservado por el sistema' }
    }

    const { data: existing, error } = await supabase
      .rpc('get_org_by_subdomain', { p_subdomain: s })
      .maybeSingle()

    if (error) {
      return { status: 'invalid', message: `Error al verificar: ${error.message}` }
    }

    if (existing) {
      return { status: 'taken', message: 'Este subdomain ya está en uso' }
    }

    return { status: 'available', message: '✓ Disponible' }
  }

  // ═════════════════════════════════════════════════════════════
  // Crear organización (vía RPC atómica)
  // ═════════════════════════════════════════════════════════════
  async create(input: CreateOrganizationInput): Promise<CreateOrganizationResult> {
    const { data, error } = await supabase
      .rpc('create_organization_with_admin', {
        p_name: input.name.trim(),
        p_subdomain: input.subdomain.trim().toLowerCase(),
        p_primary_color: input.primaryColor,
        p_admin_email: input.adminEmail?.trim().toLowerCase() || null,
        p_welcome_message: input.welcomeMessage,
        p_brand_name: input.brandName ?? input.name.trim(),
        p_logo_url: input.logoUrl ?? null
      })
      .maybeSingle()

    if (error) throw new Error(error.message || 'Error al crear la organización')
    if (!data) throw new Error('La organización no se pudo crear (respuesta vacía)')

    // Cast explícito del resultado del RPC
    const rpcData = data as unknown as CreateOrgRpcResult

    const subdomainUrl = buildSubdomainUrl(input.subdomain)
    const invitationUrl = rpcData.invitation_token
      ? buildInvitationUrl(input.subdomain, rpcData.invitation_token)
      : null

    return {
      orgId: rpcData.org_id,
      invitationToken: rpcData.invitation_token ?? null,
      adminRoleId: rpcData.admin_role_id,
      channelId: rpcData.channel_id,
      widgetConfigId: rpcData.widget_config_id,
      invitationUrl,
      subdomainUrl
    }
  }

  // ═════════════════════════════════════════════════════════════
  // Activar / desactivar organización
  // ═════════════════════════════════════════════════════════════
  async setActive(orgId: string, active: boolean): Promise<void> {
    const { error } = await supabase
      .rpc('set_organization_active', { p_org_id: orgId, p_active: active })

    if (error) throw new Error(error.message)
  }

  // ═════════════════════════════════════════════════════════════
  // Actualizar branding de una organización
  // ═════════════════════════════════════════════════════════════
  async updateBranding(
    orgId: string,
    patch: {
      brandName?: string | null
      primaryColor?: string
      logoUrl?: string | null
      logoFullUrl?: string | null
    }
  ): Promise<void> {
    const updates: Record<string, any> = {}
    if (patch.brandName !== undefined) updates.brand_name = patch.brandName
    if (patch.primaryColor !== undefined) updates.primary_color = patch.primaryColor
    if (patch.logoUrl !== undefined) updates.logo_url = patch.logoUrl
    if (patch.logoFullUrl !== undefined) updates.logo_full_url = patch.logoFullUrl
    updates.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', orgId)

    if (error) throw new Error(error.message)
  }

  // ═════════════════════════════════════════════════════════════
  // Helpers de mapeo
  // ═════════════════════════════════════════════════════════════
  private toOrgWithStats(r: any): OrganizationWithStats {
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      subdomain: r.subdomain,
      brandName: r.brand_name,
      primaryColor: r.primary_color ?? '#0071E3',
      logoUrl: r.logo_url,
      logoFullUrl: r.logo_full_url ?? null,
      active: r.active,
      plan: r.plan ?? 'starter',
      timezone: r.timezone ?? 'America/Santo_Domingo',
      locale: r.locale ?? 'es',
      aiTokensLimit: r.ai_tokens_limit ?? 0,
      aiTokensUsed: r.ai_tokens_used ?? 0,
      settings: r.settings ?? {},
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? r.created_at,
      userCount: Number(r.user_count ?? 0),
      conversationCount: Number(r.conversation_count ?? 0)
    }
  }
}

// Export const para mantener compatibilidad con el tipo RPC
export type { CreateOrgRpcResult, GetOrgBySubdomainRpcResult }
