// Ruta: /src/repository/base.repository.ts
// ═══════════════════════════════════════════════════════════════
// INTERFAZ GENÉRICA DEL PATRÓN REPOSITORY
// Todas las implementaciones (supabase/, firebase/, etc.) deben cumplirla.
// Esta es la capa de abstracción que permite cambiar de DB sin tocar la app.
// ═══════════════════════════════════════════════════════════════
import type { PaginatedResult } from '@/types/api.types'

export interface IRepository<T, CreateInput = Partial<T>, UpdateInput = Partial<T>> {
  /** Recupera una entidad por ID. Retorna null si no existe. */
  findById(id: string): Promise<T | null>

  /** Lista con filtros opcionales y paginación. */
  findMany(params?: {
    filters?: Record<string, unknown>
    limit?: number
    offset?: number
    orderBy?: { column: string; ascending?: boolean }
  }): Promise<PaginatedResult<T>>

  /** Crea una nueva entidad. */
  create(input: CreateInput): Promise<T>

  /** Actualiza parcialmente. */
  update(id: string, input: UpdateInput): Promise<T>

  /** Elimina. */
  delete(id: string): Promise<void>
}

/**
 * Contrato de suscripción en tiempo real (opcional por implementación).
 * Retorna una función de unsubscribe.
 */
export interface IRealtimeRepository<T> {
  subscribe(
    filters: Record<string, unknown>,
    handler: (event: RealtimeEvent<T>) => void
  ): Unsubscribe
}

export type RealtimeEvent<T> =
  | { type: 'INSERT'; record: T }
  | { type: 'UPDATE'; record: T; old: Partial<T> }
  | { type: 'DELETE'; old: Partial<T> }

export type Unsubscribe = () => void
