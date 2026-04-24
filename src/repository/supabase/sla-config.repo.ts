// Ruta: /src/repository/supabase/sla-config.repo.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 9 · Supervisor Tools · SLA Config
// ═══════════════════════════════════════════════════════════════
import { supabase } from '@/services/supabase.client'
import type { SlaConfig, UpdateSlaConfigInput } from '@/types/supervisor.types'

function toSlaConfig(r: Record<string, any>): SlaConfig {
  return {
    id: r.id,
    organizationId: r.organization_id,
    firstResponseMinutes: r.first_response_minutes,
    resolutionMinutes: r.resolution_minutes,
    notifySupervisors: r.notify_supervisors,
    enabled: r.enabled,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export class SupabaseSlaConfigRepo {
  async getByOrganization(organizationId: string): Promise<SlaConfig | null> {
    const { data, error } = await supabase
      .from('sla_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (error) throw error
    return data ? toSlaConfig(data) : null
  }

  async upsert(organizationId: string, input: UpdateSlaConfigInput): Promise<SlaConfig> {
    const patch: Record<string, any> = {
      organization_id: organizationId,
      updated_at: new Date().toISOString()
    }

    if (input.firstResponseMinutes !== undefined) patch.first_response_minutes = input.firstResponseMinutes
    if (input.resolutionMinutes !== undefined)    patch.resolution_minutes     = input.resolutionMinutes
    if (input.notifySupervisors !== undefined)    patch.notify_supervisors     = input.notifySupervisors
    if (input.enabled !== undefined)              patch.enabled                = input.enabled

    const { data, error } = await supabase
      .from('sla_configs')
      .upsert(patch, { onConflict: 'organization_id' })
      .select()
      .single()

    if (error) throw error
    return toSlaConfig(data)
  }
}
