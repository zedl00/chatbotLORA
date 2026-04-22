// Ruta: /src/types/api.types.ts

export interface PaginatedResult<T> {
  data: T[]
  count: number
  hasMore: boolean
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError }

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err(code: string, message: string, details?: unknown): Result<never> {
  return { ok: false, error: { code, message, details } }
}
