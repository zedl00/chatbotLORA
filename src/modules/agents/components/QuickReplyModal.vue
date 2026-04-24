<!-- Ruta: /src/modules/agents/components/QuickReplyModal.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Modal para crear/editar un quick reply.
     - is_shared solo habilitado para quienes tengan 'quick_replies.share'
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { useCan } from '@/composables/useCan'
import { useUiStore } from '@/stores/ui.store'
import { useQuickReplyStore } from '@/stores/quick-reply.store'
import type { QuickReply } from '@/types/agent.types'
import { QUICK_REPLY_CATEGORIES } from '@/types/agent.types'

interface Props {
  quickReply?: QuickReply | null
}

const props = withDefaults(defineProps<Props>(), { quickReply: null })

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', qr: QuickReply): void
}>()

const auth = useAuthStore()
const activeOrgId = useActiveOrganizationId()
const { can } = useCan()
const ui = useUiStore()
const store = useQuickReplyStore()

const canShare = can('quick_replies.share')

const saving = ref(false)
const form = ref({
  shortcut: '',
  title: '',
  content: '',
  category: 'otro' as string | null,
  isShared: false
})

function resetForm() {
  if (props.quickReply) {
    form.value = {
      shortcut: props.quickReply.shortcut,
      title: props.quickReply.title,
      content: props.quickReply.content,
      category: props.quickReply.category ?? 'otro',
      isShared: props.quickReply.isShared
    }
  } else {
    form.value = {
      shortcut: '',
      title: '',
      content: '',
      category: 'otro',
      isShared: false
    }
  }
}

watch(() => props.quickReply, resetForm, { immediate: true })

function validate(): boolean {
  if (!form.value.shortcut.trim()) {
    ui.showToast('error', 'El shortcut es requerido')
    return false
  }
  if (!/^[a-z0-9_-]+$/i.test(form.value.shortcut.trim())) {
    ui.showToast('error', 'El shortcut solo acepta letras, números, _ y -')
    return false
  }
  if (!form.value.title.trim()) {
    ui.showToast('error', 'El título es requerido')
    return false
  }
  if (!form.value.content.trim()) {
    ui.showToast('error', 'El contenido es requerido')
    return false
  }
  if (form.value.isShared && !canShare) {
    ui.showToast('error', 'No tienes permiso para crear snippets compartidos')
    return false
  }
  return true
}

async function save() {
  if (!validate()) return
  if (!activeOrgId.value || !auth.user?.id) {
    ui.showToast('error', 'Sesión no válida')
    return
  }

  saving.value = true
  try {
    const payload = {
      shortcut: form.value.shortcut,
      title: form.value.title,
      content: form.value.content,
      category: form.value.category || null,
      isShared: form.value.isShared
    }

    let saved: QuickReply
    if (props.quickReply) {
      saved = await store.update(props.quickReply.id, payload)
      ui.showToast('success', 'Snippet actualizado')
    } else {
      saved = await store.create({
        organizationId: activeOrgId.value,
        ownerId: auth.user.id,
        ...payload
      })
      ui.showToast('success', 'Snippet creado')
    }

    emit('saved', saved)
    emit('close')
  } catch (e: any) {
    const msg = e?.message ?? 'Error al guardar'
    // Detectar conflicto de shortcut duplicado
    if (msg.includes('duplicate') || msg.includes('idx_quick_replies_shortcut_unique')) {
      ui.showToast('error', `Ya existe un snippet con el shortcut "${form.value.shortcut}"`)
    } else {
      ui.showToast('error', msg)
    }
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
    <div class="card w-full max-w-xl max-h-[90vh] overflow-auto">
      <div class="p-5 border-b border-surface-border flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          {{ quickReply ? 'Editar snippet' : 'Nuevo snippet' }}
        </h3>
        <button
          class="text-slate-400 hover:text-slate-600 text-xl leading-none"
          @click="emit('close')"
        >
          ×
        </button>
      </div>

      <div class="p-5 space-y-4">
        <div class="grid grid-cols-[1fr,2fr] gap-3">
          <div>
            <label class="block text-sm font-medium mb-1">
              Shortcut <span class="text-red-500">*</span>
            </label>
            <div class="flex items-center">
              <span class="text-slate-400 text-sm mr-1">/</span>
              <input
                v-model="form.shortcut"
                type="text"
                class="input"
                placeholder="saludo"
                maxlength="50"
              />
            </div>
            <p class="text-[11px] text-slate-400 mt-1">
              Se invoca escribiendo /{{ form.shortcut || 'shortcut' }} en el chat
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">
              Título <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.title"
              type="text"
              class="input"
              placeholder="Saludo inicial al cliente"
              maxlength="100"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">
            Contenido <span class="text-red-500">*</span>
          </label>
          <textarea
            v-model="form.content"
            class="input resize-y"
            rows="5"
            placeholder="Hola! 👋 Bienvenido/a a [Empresa]. ¿En qué puedo ayudarte hoy?"
          />
          <p class="text-[11px] text-slate-400 mt-1">
            Este es el texto que se insertará en el chat cuando el agente use el snippet.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1">Categoría</label>
            <select v-model="form.category" class="input">
              <option v-for="cat in QUICK_REPLY_CATEGORIES" :key="cat.value" :value="cat.value">
                {{ cat.emoji }} {{ cat.label }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Visibilidad</label>
            <div class="input flex items-center gap-3 cursor-pointer"
                 :class="!canShare && 'opacity-60 cursor-not-allowed'"
                 @click="canShare && (form.isShared = !form.isShared)">
              <div
                class="w-10 h-5 rounded-full transition-colors flex-shrink-0 relative"
                :class="form.isShared ? 'bg-brand-600' : 'bg-slate-300'"
              >
                <div
                  class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all"
                  :class="form.isShared ? 'left-5' : 'left-0.5'"
                />
              </div>
              <span class="text-sm">
                {{ form.isShared ? 'Compartido con el equipo' : 'Solo para mí' }}
              </span>
            </div>
            <p v-if="!canShare" class="text-[11px] text-amber-600 mt-1">
              Solo supervisores y admins pueden crear snippets compartidos
            </p>
          </div>
        </div>
      </div>

      <div class="p-5 border-t border-surface-border flex justify-end gap-2">
        <button class="btn-secondary" :disabled="saving" @click="emit('close')">
          Cancelar
        </button>
        <button class="btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Guardando...' : (quickReply ? 'Guardar cambios' : 'Crear snippet') }}
        </button>
      </div>
    </div>
  </div>
</template>
