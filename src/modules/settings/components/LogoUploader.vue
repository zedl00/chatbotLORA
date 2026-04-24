<!-- Ruta: /src/modules/settings/components/LogoUploader.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 7: Uploader de logo con drag-drop y preview.

     Props:
       - modelValue: URL actual del logo (o null)
       - orgId: ID de la organización (para el path del archivo)

     Eventos:
       - update:modelValue: cuando cambia la URL del logo
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLogoUpload } from '@/composables/useLogoUpload'

interface Props {
  modelValue: string | null
  orgId: string
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', url: string | null): void
  (e: 'error', msg: string): void
}>()

const { uploading, uploadLogo, deleteLogo, extractPathFromUrl, validateFile } = useLogoUpload()
const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)

const hasLogo = computed(() => !!props.modelValue)

async function handleFile(file: File) {
  const validationError = validateFile(file)
  if (validationError) {
    emit('error', validationError)
    return
  }

  try {
    // Si hay logo previo, intentar eliminarlo
    if (props.modelValue) {
      const oldPath = extractPathFromUrl(props.modelValue)
      if (oldPath) await deleteLogo(oldPath)
    }

    // Subir el nuevo
    const result = await uploadLogo(file, props.orgId)
    emit('update:modelValue', result.url)
  } catch (e) {
    emit('error', e instanceof Error ? e.message : 'Error al subir')
  }
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleFile(file)
  // Resetear el input para permitir subir el mismo archivo de nuevo
  input.value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

async function removeLogo() {
  if (!props.modelValue) return
  const confirmed = window.confirm('¿Eliminar el logo actual?')
  if (!confirmed) return

  const path = extractPathFromUrl(props.modelValue)
  if (path) await deleteLogo(path)
  emit('update:modelValue', null)
}

function openFilePicker() {
  fileInput.value?.click()
}
</script>

<template>
  <div class="logo-uploader">
    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
      class="hidden"
      @change="onFileSelected"
    />

    <!-- Estado con logo ya cargado -->
    <div v-if="hasLogo" class="logo-current">
      <div class="logo-preview">
        <img :src="modelValue!" alt="Logo actual" />
      </div>
      <div class="logo-actions">
        <button
          type="button"
          class="btn-primary-sm"
          :disabled="uploading"
          @click="openFilePicker"
        >
          {{ uploading ? 'Subiendo...' : '🔄 Reemplazar' }}
        </button>
        <button
          type="button"
          class="btn-danger-sm"
          :disabled="uploading"
          @click="removeLogo"
        >
          🗑️ Eliminar
        </button>
      </div>
    </div>

    <!-- Estado vacío: drag & drop -->
    <div
      v-else
      class="logo-dropzone"
      :class="{ 'is-dragover': dragOver }"
      @click="openFilePicker"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop="onDrop"
    >
      <div v-if="uploading" class="dropzone-uploading">
        <div class="spinner"></div>
        <div class="dropzone-text">Subiendo...</div>
      </div>
      <div v-else class="dropzone-empty">
        <div class="dropzone-icon">📁</div>
        <div class="dropzone-text">
          <strong>Arrastra tu logo aquí</strong>
          <span>o haz click para seleccionar</span>
        </div>
        <div class="dropzone-hint">PNG, JPG, WEBP, SVG · máx 2 MB</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logo-uploader {
  width: 100%;
}

.hidden {
  display: none;
}

.logo-current {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.logo-preview {
  width: 100%;
  height: 140px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 16px;
}

.logo-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.logo-actions {
  display: flex;
  gap: 8px;
}

.btn-primary-sm,
.btn-danger-sm {
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary-sm {
  background: #0071E3;
  color: white;
}
.btn-primary-sm:hover:not(:disabled) {
  background: #005BB5;
}
.btn-primary-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger-sm {
  background: white;
  color: #DC2626;
  border-color: #E5E7EB;
}
.btn-danger-sm:hover:not(:disabled) {
  background: #FEF2F2;
  border-color: #FCA5A5;
}
.btn-danger-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.logo-dropzone {
  border: 2px dashed #CBD5E1;
  border-radius: 12px;
  padding: 32px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #F8FAFC;
}

.logo-dropzone:hover {
  border-color: #0071E3;
  background: #EFF6FF;
}

.logo-dropzone.is-dragover {
  border-color: #0071E3;
  background: #DBEAFE;
  transform: scale(1.01);
}

.dropzone-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.dropzone-icon {
  font-size: 40px;
  opacity: 0.6;
}

.dropzone-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropzone-text strong {
  font-size: 14px;
  font-weight: 600;
  color: #0F172A;
}

.dropzone-text span {
  font-size: 13px;
  color: #64748B;
}

.dropzone-hint {
  font-size: 11px;
  color: #94A3B8;
  margin-top: 4px;
}

.dropzone-uploading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #E2E8F0;
  border-top-color: #0071E3;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
