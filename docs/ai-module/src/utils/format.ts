// Ruta: /src/utils/format.ts
// ═══════════════════════════════════════════════════════════════
// Helpers de formato usados en todo el proyecto.
// ═══════════════════════════════════════════════════════════════

/**
 * Iniciales a partir de un nombre. "Juan Perez" → "JP"
 */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

export function formatDateShort(isoDate: string | null | undefined): string {
  if (!isoDate) return ''
  return new Date(isoDate).toLocaleDateString('es', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

export function formatDateTime(isoDate: string | null | undefined): string {
  if (!isoDate) return ''
  return new Date(isoDate).toLocaleString('es', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return ''
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `${diffMin} min`
  if (diffHour < 24) return `${diffHour}h`
  if (diffDay === 1) return 'ayer'
  if (diffDay < 7) return `${diffDay}d`
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

export function truncate(text: string | null | undefined, max = 60): string {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '…' : text
}