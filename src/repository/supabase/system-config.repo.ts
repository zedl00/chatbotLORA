// Ruta: /src/repository/supabase/system-config.repo.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 11.6 · System config repository
// ═══════════════════════════════════════════════════════════════
import { supabase } from '@/services/supabase.client'
import type { SystemConfigItem } from '@/types/system-config.types'

function toSystemConfigItem(r: Record<string, any>): SystemConfigItem {
  return {
    key: r.key,
    value: r.value,
    valueType: r.value_type,
    description: r.description,
    isPublic: r.is_public,
    category: r.category,
    sortOrder: r.sort_order,
    defaultValue: r.default_value,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by,
    createdAt: r.created_at
  }
}

export class SupabaseSystemConfigRepo {
  /**
   * Lista todas las configuraciones (solo super_admin por RLS).
   */
  async listAll(): Promise<SystemConfigItem[]> {
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })

    if (error) throw error
    return (data ?? []).map(toSystemConfigItem)
  }

  /**
   * Obtener una config individual.
   */
  async getByKey(key: string): Promise<SystemConfigItem | null> {
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .eq('key', key)
      .maybeSingle()

    if (error) throw error
    return data ? toSystemConfigItem(data) : null
  }

  /**
   * Actualizar el valor de una config.
   * Solo super_admin por RLS. El trigger actualiza updated_at/by.
   */
  async updateValue(key: string, value: any): Promise<SystemConfigItem> {
    const { data, error } = await supabase
      .from('system_config')
      .update({ value })
      .eq('key', key)
      .select()
      .single()

    if (error) throw error
    return toSystemConfigItem(data)
  }

  /**
   * Restaurar valor por defecto.
   */
  async resetToDefault(key: string): Promise<SystemConfigItem> {
    const current = await this.getByKey(key)
    if (!current) throw new Error('Config no encontrada')
    if (current.defaultValue === null || current.defaultValue === undefined) {
      throw new Error('Esta configuración no tiene valor por defecto')
    }
    return this.updateValue(key, current.defaultValue)
  }

  /**
   * Obtener solo las configs públicas (equivalente a la RPC).
   * Devuelve un objeto plain { key: value }.
   */
  async getPublicConfig(): Promise<Record<string, any>> {
    const { data, error } = await supabase.rpc('get_public_config')
    if (error) throw error
    return data ?? {}
  }

  /**
   * Obtener TODAS las configs como objeto plain { key: value }.
   * Usado por el composable useSystemConfig.
   */
  async getAllAsMap(): Promise<Record<string, any>> {
    const items = await this.listAll()
    const map: Record<string, any> = {}
    for (const item of items) {
      map[item.key] = item.value
    }
    return map
  }
}
