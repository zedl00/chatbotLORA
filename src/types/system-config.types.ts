// Ruta: /src/types/system-config.types.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 11.6 · Tipos para el sistema de configuración global
// ═══════════════════════════════════════════════════════════════

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'url' | 'email' | 'json'

export type ConfigCategory = 'general' | 'urls' | 'branding' | 'limits' | 'integrations'

export interface SystemConfigItem {
  key: string
  value: any                 // JSONB, puede ser string, number, object, etc.
  valueType: ConfigValueType
  description: string | null
  isPublic: boolean
  category: ConfigCategory
  sortOrder: number
  defaultValue: any | null
  updatedAt: string
  updatedBy: string | null
  createdAt: string
}

export interface UpdateConfigInput {
  key: string
  value: any
}

// Keys conocidas (para autocompletado en TS)
export const KNOWN_CONFIG_KEYS = {
  ADMIN_URL: 'admin_url',
  WIDGET_URL: 'widget_url',
  API_URL: 'api_url',
  BRAND_NAME: 'brand_name',
  BRAND_TAGLINE: 'brand_tagline',
  SUPPORT_EMAIL: 'support_email',
  SUPPORT_URL: 'support_url',
  LANDING_URL: 'landing_url'
} as const

export type KnownConfigKey = typeof KNOWN_CONFIG_KEYS[keyof typeof KNOWN_CONFIG_KEYS]

// Metadata visual de las categorías
export const CATEGORY_METADATA: Record<ConfigCategory, { label: string; icon: string; description: string }> = {
  general: {
    label: 'General',
    icon: '⚙️',
    description: 'Configuraciones generales del sistema'
  },
  urls: {
    label: 'URLs del sistema',
    icon: '🔗',
    description: 'Dominios y URLs usados por el admin y widget'
  },
  branding: {
    label: 'Marca y comunicación',
    icon: '🎨',
    description: 'Nombre, tagline, emails de soporte'
  },
  limits: {
    label: 'Límites',
    icon: '📊',
    description: 'Cuotas, rate limits, timeouts'
  },
  integrations: {
    label: 'Integraciones',
    icon: '🔌',
    description: 'API keys y tokens de servicios externos'
  }
}

// Helper: validar un valor según su tipo
export function validateConfigValue(value: any, type: ConfigValueType): { valid: boolean; error?: string } {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: 'No puede estar vacío' }
  }

  switch (type) {
    case 'url': {
      if (typeof value !== 'string') return { valid: false, error: 'Debe ser texto' }
      try {
        new URL(value)
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          return { valid: false, error: 'Debe empezar con http:// o https://' }
        }
        return { valid: true }
      } catch {
        return { valid: false, error: 'URL no válida' }
      }
    }
    case 'email': {
      if (typeof value !== 'string') return { valid: false, error: 'Debe ser texto' }
      if (!/^\S+@\S+\.\S+$/.test(value)) {
        return { valid: false, error: 'Email no válido' }
      }
      return { valid: true }
    }
    case 'number': {
      if (typeof value !== 'number' && isNaN(Number(value))) {
        return { valid: false, error: 'Debe ser un número' }
      }
      return { valid: true }
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'Debe ser true o false' }
      }
      return { valid: true }
    }
    case 'json': {
      try {
        if (typeof value === 'string') JSON.parse(value)
        return { valid: true }
      } catch {
        return { valid: false, error: 'JSON no válido' }
      }
    }
    case 'string':
    default:
      if (typeof value !== 'string') return { valid: false, error: 'Debe ser texto' }
      return { valid: true }
  }
}
