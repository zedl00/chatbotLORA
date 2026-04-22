// Ruta: /src/types/user.types.ts

export type UserRole = 'super_admin' | 'admin' | 'supervisor' | 'agent'

export interface User {
  id: string
  organizationId: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  phone: string | null
  role: UserRole
  active: boolean
  lastSeenAt: string | null
  preferences: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  timezone: string
  locale: string
  plan: string
  aiTokensLimit: number
  aiTokensUsed: number
  settings: Record<string, unknown>
  active: boolean
  createdAt: string
  updatedAt: string
}

// Fuente de verdad para UX. RLS lo refuerza en DB.
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 4,
  admin: 3,
  supervisor: 2,
  agent: 1
}

export function isRoleAtLeast(current: UserRole, required: UserRole): boolean {
  return ROLE_HIERARCHY[current] >= ROLE_HIERARCHY[required]
}
