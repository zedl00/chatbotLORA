<!-- Ruta: /src/modules/contacts/components/ContactFormModal.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Modal de creación/edición de contactos.
     Si recibe prop `contact`, entra en modo edición; si no, crea uno nuevo.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { SupabaseContactRepo } from '@/repository/supabase/contact.repo'
import type { Contact } from '@/types/channel.types'
import TagInput from './TagInput.vue'

interface Props {
  contact?: Contact | null
  suggestionsTags?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  contact: null,
  suggestionsTags: () => []
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', contact: Contact): void
}>()

const ui = useUiStore()
const activeOrgId = useActiveOrganizationId()
const repo = new SupabaseContactRepo()

const saving = ref(false)
const form = ref({
  fullName: '',
  email: '',
  phone: '',
  locale: '',
  timezone: '',
  tags: [] as string[],
  notes: ''
})

function resetForm() {
  if (props.contact) {
    form.value = {
      fullName: props.contact.fullName ?? '',
      email: props.contact.email ?? '',
      phone: props.contact.phone ?? '',
      locale: props.contact.locale ?? '',
      timezone: props.contact.timezone ?? '',
      tags: [...(props.contact.tags ?? [])],
      notes: props.contact.notes ?? ''
    }
  } else {
    form.value = {
      fullName: '',
      email: '',
      phone: '',
      locale: '',
      timezone: '',
      tags: [],
      notes: ''
    }
  }
}

watch(() => props.contact, resetForm, { immediate: true })

function isValid(): boolean {
  if (!form.value.fullName.trim()) {
    ui.showToast('error', 'El nombre es requerido')
    return false
  }
  if (!form.value.email && !form.value.phone) {
    ui.showToast('error', 'Agrega al menos email o teléfono')
    return false
  }
  if (form.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    ui.showToast('error', 'El email no es válido')
    return false
  }
  return true
}

async function save() {
  if (!isValid()) return
  if (!activeOrgId.value) {
    ui.showToast('error', 'No hay organización activa')
    return
  }

  saving.value = true
  try {
    const payload: Partial<Contact> = {
      organizationId: activeOrgId.value,
      fullName: form.value.fullName.trim() || null,
      email: form.value.email.trim() || null,
      phone: form.value.phone.trim() || null,
      locale: form.value.locale.trim() || null,
      timezone: form.value.timezone.trim() || null,
      tags: form.value.tags,
      notes: form.value.notes.trim() || null
    }

    let result: Contact
    if (props.contact) {
      result = await repo.update(props.contact.id, payload)
      ui.showToast('success', 'Contacto actualizado')
    } else {
      result = await repo.create(payload)
      ui.showToast('success', 'Contacto creado')
    }

    emit('saved', result)
    emit('close')
  } catch (e: any) {
    const msg = e?.message ?? 'Error al guardar'
    ui.showToast('error', msg)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
    @click.self="emit('close')"
  >
    <div class="card w-full max-w-lg max-h-[90vh] overflow-auto">
      <div class="p-5 border-b border-surface-border flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          {{ contact ? 'Editar contacto' : 'Nuevo contacto' }}
        </h3>
        <button
          class="text-slate-400 hover:text-slate-600 text-xl leading-none"
          @click="emit('close')"
        >
          ×
        </button>
      </div>

      <div class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">
            Nombre completo <span class="text-red-500">*</span>
          </label>
          <input v-model="form.fullName" type="text" class="input" placeholder="Juan Pérez" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1">Email</label>
            <input
              v-model="form.email"
              type="email"
              class="input"
              placeholder="juan@empresa.com"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Teléfono</label>
            <input
              v-model="form.phone"
              type="tel"
              class="input"
              placeholder="+1 809 555-0100"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1">Idioma (locale)</label>
            <input
              v-model="form.locale"
              type="text"
              class="input"
              placeholder="es-DO"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Zona horaria</label>
            <input
              v-model="form.timezone"
              type="text"
              class="input"
              placeholder="America/Santo_Domingo"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Tags</label>
          <TagInput
            v-model="form.tags"
            :suggestions="suggestionsTags"
            placeholder="Agregar tag (Enter)"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Notas internas</label>
          <textarea
            v-model="form.notes"
            class="input resize-none"
            rows="3"
            placeholder="Información útil para el equipo..."
          />
          <p class="text-xs text-slate-400 mt-1">
            Solo visible para tu equipo. El contacto no las ve.
          </p>
        </div>
      </div>

      <div class="p-5 border-t border-surface-border flex justify-end gap-2">
        <button class="btn-secondary" :disabled="saving" @click="emit('close')">
          Cancelar
        </button>
        <button
          class="btn-primary"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Guardando...' : (contact ? 'Guardar cambios' : 'Crear contacto') }}
        </button>
      </div>
    </div>
  </div>
</template>
