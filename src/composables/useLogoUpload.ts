// Ruta: /src/composables/useLogoUpload.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 7: Composable para subir/gestionar logos de la empresa.
//
// Usa el bucket 'organization-logos' de Supabase Storage.
// Path: {org_id}/logo-{timestamp}.{ext}
// ═══════════════════════════════════════════════════════════════
import { ref } from 'vue'
import { supabase } from '@/services/supabase.client'

const MAX_SIZE_BYTES = 2 * 1024 * 1024  // 2 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']

export interface LogoUploadResult {
  url: string       // URL pública del logo
  path: string      // Path en el bucket
}

export function useLogoUpload() {
  const uploading = ref(false)
  const error = ref<string | null>(null)
  const progress = ref(0)

  /**
   * Valida el archivo antes de subirlo.
   * Retorna un mensaje de error si es inválido, null si es OK.
   */
  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Formato no soportado. Usa PNG, JPG, WEBP o SVG.'
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `El archivo es muy grande. Máximo 2 MB.`
    }
    return null
  }

  /**
   * Sube un archivo al bucket 'organization-logos'.
   *
   * Path generado: {orgId}/logo-{timestamp}.{ext}
   * Retorna la URL pública y el path del archivo.
   */
  async function uploadLogo(file: File, orgId: string): Promise<LogoUploadResult> {
    error.value = null
    progress.value = 0

    const validationError = validateFile(file)
    if (validationError) {
      error.value = validationError
      throw new Error(validationError)
    }

    uploading.value = true

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const timestamp = Date.now()
      const path = `${orgId}/logo-${timestamp}.${ext}`

      const { error: uploadError } = await supabase
        .storage
        .from('organization-logos')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      progress.value = 100

      // Obtener URL pública
      const { data: urlData } = supabase
        .storage
        .from('organization-logos')
        .getPublicUrl(path)

      return {
        url: urlData.publicUrl,
        path
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al subir el logo'
      error.value = msg
      throw new Error(msg)
    } finally {
      uploading.value = false
    }
  }

  /**
   * Elimina un logo previo del bucket.
   * Útil para limpiar logos viejos cuando se sube uno nuevo.
   */
  async function deleteLogo(path: string): Promise<void> {
    if (!path) return
    try {
      await supabase.storage.from('organization-logos').remove([path])
    } catch (e) {
      console.warn('[useLogoUpload] No se pudo eliminar logo anterior:', e)
    }
  }

  /**
   * Extrae el path del bucket a partir de la URL pública completa.
   * Supabase URLs: https://{project}.supabase.co/storage/v1/object/public/organization-logos/{path}
   */
  function extractPathFromUrl(url: string): string | null {
    if (!url) return null
    const match = url.match(/\/organization-logos\/(.+)$/)
    return match ? match[1] : null
  }

  return {
    uploading,
    error,
    progress,
    uploadLogo,
    deleteLogo,
    validateFile,
    extractPathFromUrl
  }
}
