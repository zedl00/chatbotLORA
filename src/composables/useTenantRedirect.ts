// Ruta: /src/composables/useTenantRedirect.ts
// ═══════════════════════════════════════════════════════════════
// Composable para redirigir al usuario a su subdomain correcto
// después del login.
//
// Patrón: login universal en admin.lorachat.net
//   - super_admin → se queda en admin.lorachat.net
//   - admin/supervisor/agent → redirect a SU subdomain (empresa.lorachat.net)
//
// Sprint 5.
// ═══════════════════════════════════════════════════════════════
import { supabase } from '@/services/supabase.client'
import { useOrganizationContext } from './useOrganizationContext'
import type { User } from '@/types/user.types'

/**
 * Dominio base. Debe coincidir con el BASE_DOMAIN de useOrganizationContext.
 */
const BASE_DOMAIN = 'lorachat.net'

/**
 * Resultado de la decisión de redirect.
 */
export interface RedirectDecision {
  /** true si el usuario debe ser redirigido a otro subdomain */
  shouldRedirect: boolean
  /** URL completa de destino (solo si shouldRedirect=true) */
  targetUrl?: string
  /** Motivo de la decisión (útil para debug/logs) */
  reason: string
}

/**
 * Decide si el usuario debe ser redirigido después del login.
 *
 * Reglas:
 *   1. super_admin → queda donde esté (no redirige)
 *   2. En dev local (mode='unknown') → no redirige (no tenemos subdomains reales)
 *   3. Si el user ya está en su subdomain correcto → no redirige
 *   4. Si el user está en admin.lorachat.net pero es de empresa → redirige a su subdomain
 *   5. Si el user está en un subdomain DIFERENTE al suyo → redirige al correcto
 */
export async function decideRedirectAfterLogin(user: User): Promise<RedirectDecision> {
  const { mode, subdomain, isSuperAdminMode, isTenant } = useOrganizationContext()

  // ─ Regla 1: super_admin no se redirige nunca ─
  if (user.role === 'super_admin') {
    return {
      shouldRedirect: false,
      reason: 'super_admin no se redirige'
    }
  }

  // ─ Regla 2: dev local → no redirige ─
  if (mode === 'unknown') {
    return {
      shouldRedirect: false,
      reason: 'modo desarrollo (localhost sin subdomain)'
    }
  }

  // ─ Obtener el subdomain de la empresa del usuario ─
  const { data: userOrg, error } = await supabase
    .from('organizations')
    .select('subdomain, active')
    .eq('id', user.organizationId)
    .maybeSingle()

  if (error || !userOrg || !userOrg.subdomain) {
    // Si no hay subdomain asignado, no podemos redirigir
    return {
      shouldRedirect: false,
      reason: 'la organización del usuario no tiene subdomain asignado'
    }
  }

  if (!userOrg.active) {
    return {
      shouldRedirect: false,
      reason: 'la organización está desactivada'
    }
  }

  const userSubdomain = userOrg.subdomain.toLowerCase()

  // ─ Regla 3: ya está en el subdomain correcto ─
  if (isTenant && subdomain === userSubdomain) {
    return {
      shouldRedirect: false,
      reason: 'ya está en el subdomain correcto'
    }
  }

  // ─ Regla 4 y 5: redirigir al subdomain correcto ─
  // Preservar la ruta actual (ej: /admin/inbox) en el redirect
  const currentPath = window.location.pathname + window.location.search
  const targetUrl = `https://${userSubdomain}.${BASE_DOMAIN}${currentPath}`

  return {
    shouldRedirect: true,
    targetUrl,
    reason: isSuperAdminMode
      ? `redirigiendo desde admin.${BASE_DOMAIN} a ${userSubdomain}.${BASE_DOMAIN}`
      : `redirigiendo del subdomain incorrecto a ${userSubdomain}.${BASE_DOMAIN}`
  }
}

/**
 * Ejecuta el redirect si es necesario.
 * Retorna true si se hizo redirect (el código que llama NO debería continuar).
 * Retorna false si no hubo redirect (continuar con navegación normal).
 */
export async function redirectToTenantIfNeeded(user: User): Promise<boolean> {
  const decision = await decideRedirectAfterLogin(user)

  if (decision.shouldRedirect && decision.targetUrl) {
    console.log(`[useTenantRedirect] ${decision.reason}`)
    console.log(`[useTenantRedirect] → ${decision.targetUrl}`)
    window.location.href = decision.targetUrl
    return true
  }

  return false
}