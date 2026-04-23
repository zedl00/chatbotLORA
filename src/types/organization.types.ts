// Ruta: /src/types/organization.types.ts
// ═══════════════════════════════════════════════════════════════
// Tipos para el sistema multi-tenant de organizaciones.
// Creado en Sprint 5 (Bloque 3).
// ═══════════════════════════════════════════════════════════════

/**
 * Organización completa (tal como viene de la DB).
 */
export interface Organization {
  id: string
  name: string
  slug: string
  subdomain: string | null
  brandName: string | null
  primaryColor: string
  logoUrl: string | null
  logoFullUrl: string | null
  active: boolean
  plan: string
  timezone: string
  locale: string
  aiTokensLimit: number
  aiTokensUsed: number
  settings: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/**
 * Versión ligera de la organización.
 * Se usa para el contexto público (cargar la org a partir del subdomain)
 * sin exponer campos sensibles como ai_tokens_used o settings.
 */
export interface OrganizationContext {
  id: string
  name: string
  subdomain: string
  brandName: string | null
  primaryColor: string
  logoUrl: string | null
  logoFullUrl: string | null
  active: boolean
}

/**
 * Organización con métricas (para la lista del super admin).
 */
export interface OrganizationWithStats extends Organization {
  userCount: number
  conversationCount: number
}

/**
 * Input del wizard para crear una nueva organización.
 */
export interface CreateOrganizationInput {
  name: string
  subdomain: string
  primaryColor: string
  adminEmail: string | null
  welcomeMessage: string
  brandName?: string | null
  logoUrl?: string | null
}

/**
 * Resultado de la creación.
 */
export interface CreateOrganizationResult {
  orgId: string
  invitationToken: string | null
  adminRoleId: string
  channelId: string
  widgetConfigId: string
  /** URL completa para que el admin acepte la invitación */
  invitationUrl: string | null
  /** URL del subdomain de la nueva empresa */
  subdomainUrl: string
}

/**
 * Estado de validación de un subdomain.
 */
export type SubdomainValidationStatus =
  | 'idle'           // Sin tocar
  | 'checking'       // Verificando contra la DB
  | 'available'      // Libre y válido
  | 'taken'          // Ya existe
  | 'reserved'       // Reservado por el sistema
  | 'invalid'        // Formato inválido

/**
 * Resultado detallado de la validación.
 */
export interface SubdomainValidation {
  status: SubdomainValidationStatus
  message: string
}

/**
 * Modo del app según el hostname actual.
 */
export type AppContextMode =
  | 'tenant'       // Estamos en un subdomain de cliente (jab, norson, etc.)
  | 'super-admin'  // Estamos en admin.lorachat.net (modo super admin)
  | 'unknown'      // Hostname no reconocido (localhost, etc.)
