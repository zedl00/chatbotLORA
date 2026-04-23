// Ruta: /src/composables/useOrganizationContext.ts
// ═══════════════════════════════════════════════════════════════
// Detecta el subdomain del hostname y carga la organización activa.
// Sprint 5 · Bloque 3.
// ═══════════════════════════════════════════════════════════════
import type { AppContextMode } from '@/types/organization.types'

/**
 * Dominio base donde vive LORA. Todo lo que sea un subdomain de esto
 * se considera un tenant (cliente).
 *
 * Cambiar esto si algún día migras el dominio.
 */
const BASE_DOMAIN = 'lorachat.net'

/**
 * Subdomains que NO son de clientes (son del sistema).
 * Si entras a admin.lorachat.net, no debe cargar ninguna org —
 * es el panel de super admin.
 */
const SYSTEM_SUBDOMAINS = new Set([
  'admin',
  'www',
  'api',
  'app'
])

/**
 * Extrae el subdomain del hostname.
 * Ejemplos:
 *   jab.lorachat.net      → "jab"
 *   norson.lorachat.net   → "norson"
 *   admin.lorachat.net    → null (es del sistema)
 *   lorachat.net          → null (raíz)
 *   localhost             → null (dev)
 *
 * En desarrollo local puedes simular un subdomain definiendo
 * la variable de entorno VITE_DEV_SUBDOMAIN en .env.local:
 *   VITE_DEV_SUBDOMAIN=jab
 */
export function extractSubdomain(hostname: string): string | null {
  // ── Desarrollo local: usar variable de entorno ──
  if (import.meta.env.DEV) {
    const devSubdomain = import.meta.env.VITE_DEV_SUBDOMAIN as string | undefined
    if (devSubdomain && devSubdomain.trim()) {
      return devSubdomain.trim().toLowerCase()
    }
    // En dev sin variable, no hay subdomain → modo super-admin
    return null
  }

  // ── Producción: parsear el hostname real ──
  const host = hostname.toLowerCase().replace(/:\d+$/, '') // quitar puerto si hay

  // Si el hostname es exactamente el dominio base → no hay subdomain
  if (host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) {
    return null
  }

  // Si el hostname termina en .lorachat.net, el subdomain es lo que viene antes
  const suffix = `.${BASE_DOMAIN}`
  if (host.endsWith(suffix)) {
    const subdomain = host.slice(0, -suffix.length)

    // Verificar que no tenga más puntos (subsubdomain, ej: foo.bar.lorachat.net)
    if (subdomain.includes('.')) {
      return null
    }

    return subdomain
  }

  // Hostname desconocido (ej: acceso por IP directa)
  return null
}

/**
 * Determina el modo del app según el hostname.
 */
export function detectAppMode(hostname: string): AppContextMode {
  const subdomain = extractSubdomain(hostname)

  if (subdomain === null) {
    return 'unknown'
  }

  if (SYSTEM_SUBDOMAINS.has(subdomain)) {
    return 'super-admin'
  }

  return 'tenant'
}

/**
 * Composable principal. Devuelve:
 *   - subdomain: el subdomain actual (o null)
 *   - mode: si estamos en super-admin, tenant, o unknown
 *   - isTenant: helper boolean
 *   - isSuperAdminMode: helper boolean
 */
export function useOrganizationContext() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const subdomain = extractSubdomain(hostname)
  const mode = detectAppMode(hostname)

  return {
    subdomain,
    mode,
    isTenant: mode === 'tenant',
    isSuperAdminMode: mode === 'super-admin',
    hostname
  }
}

/**
 * Construye la URL pública de un subdomain.
 * Útil para mostrar en el wizard: "https://capitali.lorachat.net"
 */
export function buildSubdomainUrl(subdomain: string): string {
  if (import.meta.env.DEV) {
    // En dev, devolvemos un placeholder informativo
    return `https://${subdomain}.${BASE_DOMAIN}`
  }
  return `https://${subdomain}.${BASE_DOMAIN}`
}

/**
 * Construye la URL de aceptación de invitación.
 * El admin recibirá este link por WhatsApp/email manual.
 */
export function buildInvitationUrl(subdomain: string, token: string): string {
  const base = import.meta.env.DEV
    ? window.location.origin
    : `https://${subdomain}.${BASE_DOMAIN}`
  return `${base}/auth/accept-invite?token=${token}`
}
