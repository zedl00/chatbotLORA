// Ruta: /src/repository/supabase/widget-config.repo.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 11 · Widget config repository
// ═══════════════════════════════════════════════════════════════
import { supabase } from '@/services/supabase.client'
import type { WidgetChannel, WidgetSettings } from '@/types/widget.types'
import { mergeWidgetSettings } from '@/types/widget.types'

function toWidgetChannel(r: Record<string, any>): WidgetChannel {
  return {
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    active: r.active,
    settings: mergeWidgetSettings(r.settings),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export class SupabaseWidgetConfigRepo {
  /**
   * Lista widgets (web_widget channels) de la org.
   */
  async listWidgets(organizationId: string): Promise<WidgetChannel[]> {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('type', 'web_widget')
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []).map(toWidgetChannel)
  }

  /**
   * Obtener un widget por ID.
   */
  async getWidget(id: string): Promise<WidgetChannel | null> {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('id', id)
      .eq('type', 'web_widget')
      .maybeSingle()

    if (error) throw error
    return data ? toWidgetChannel(data) : null
  }

  /**
   * Actualizar settings completo del widget.
   */
  async updateSettings(id: string, settings: WidgetSettings): Promise<WidgetChannel> {
    const { data, error } = await supabase
      .from('channels')
      .update({
        settings: settings as unknown as Record<string, any>,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('type', 'web_widget')
      .select()
      .single()

    if (error) throw error
    return toWidgetChannel(data)
  }

  /**
   * Actualizar solo una sección de settings (merge).
   */
  async updateSection<K extends keyof WidgetSettings>(
    id: string,
    section: K,
    value: WidgetSettings[K]
  ): Promise<WidgetChannel> {
    const current = await this.getWidget(id)
    if (!current) throw new Error('Widget no encontrado')

    const newSettings: WidgetSettings = {
      ...current.settings,
      [section]: value
    }

    return this.updateSettings(id, newSettings)
  }
}
