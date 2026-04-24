<!-- Ruta: /src/modules/channels/components/widget-config/WidgetPreChatTab.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PreChatConfig, PreChatField } from '@/types/widget.types'
import HelpTooltip from './help/HelpTooltip.vue'
import WidgetFieldEditor from './WidgetFieldEditor.vue'

interface Props {
  modelValue: PreChatConfig
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', v: PreChatConfig): void }>()

const local = ref<PreChatConfig>({ ...props.modelValue })

watch(() => props.modelValue, v => { local.value = { ...v } }, { deep: true })
watch(local, v => { emit('update:modelValue', v) }, { deep: true })

const sortedFields = computed(() =>
  [...local.value.fields].sort((a, b) => a.order - b.order)
)

const activeFieldsCount = computed(() =>
  local.value.fields.filter(f => f.visible).length
)

function updateField(_index: number, patch: PreChatField) {
  const i = local.value.fields.findIndex(f => f.key === patch.key)
  if (i >= 0) {
    local.value.fields[i] = patch
  }
}

function moveField(fieldKey: string, direction: 'up' | 'down') {
  const sorted = sortedFields.value
  const idx = sorted.findIndex(f => f.key === fieldKey)
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= sorted.length) return

  const a = sorted[idx]
  const b = sorted[targetIdx]

  // Swap orders
  const tmp = a.order
  const updatedFields = local.value.fields.map(f => {
    if (f.key === a.key) return { ...f, order: b.order }
    if (f.key === b.key) return { ...f, order: tmp }
    return f
  })

  local.value.fields = updatedFields
}
</script>

<template>
  <div class="space-y-5">
    <!-- Toggle principal -->
    <div class="bg-brand-50 border border-brand-200 rounded-xl p-4">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <h3 class="font-semibold text-slate-800 flex items-center gap-2">
            Pre-chat activo
            <HelpTooltip text="Si está activo, el cliente ve un formulario antes de chatear. Si no, el chat se inicia directo." />
          </h3>
          <p class="text-xs text-slate-600 mt-1">
            Pide datos al cliente antes de iniciar la conversación. Útil para calificar leads o rutear según motivo.
          </p>
        </div>
        <button
          class="w-12 h-6 rounded-full transition-colors flex-shrink-0"
          :class="local.enabled ? 'bg-brand-600' : 'bg-slate-300'"
          @click="local.enabled = !local.enabled"
        >
          <div
            class="w-5 h-5 bg-white rounded-full transition-all"
            :class="local.enabled ? 'ml-[26px]' : 'ml-0.5'"
          />
        </button>
      </div>
    </div>

    <template v-if="local.enabled">
      <!-- Modo -->
      <div>
        <div class="flex items-center gap-2 mb-2">
          <label class="text-sm font-medium text-slate-800">Modo</label>
          <HelpTooltip text="Obligatorio: bloquea el chat hasta completar. Opcional: muestra botón 'Chatear como invitado' para saltar." />
        </div>
        <div class="flex gap-2">
          <button
            class="flex-1 max-w-xs px-3 py-2.5 text-sm rounded-lg border transition-colors text-left"
            :class="local.mode === 'required'
              ? 'border-red-500 bg-red-50 text-red-900 font-medium'
              : 'border-surface-border text-slate-700 hover:bg-slate-50'"
            @click="local.mode = 'required'"
          >
            🔒 <strong>Obligatorio</strong>
            <div class="text-[11px] font-normal text-slate-500 mt-0.5">Cliente no puede chatear sin completar</div>
          </button>
          <button
            class="flex-1 max-w-xs px-3 py-2.5 text-sm rounded-lg border transition-colors text-left"
            :class="local.mode === 'optional'
              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-medium'
              : 'border-surface-border text-slate-700 hover:bg-slate-50'"
            @click="local.mode = 'optional'"
          >
            🔓 <strong>Opcional</strong>
            <div class="text-[11px] font-normal text-slate-500 mt-0.5">Cliente puede saltar el formulario</div>
          </button>
        </div>
      </div>

      <div class="border-t border-surface-border" />

      <!-- Títulos -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="text-sm font-medium text-slate-800 block mb-1">Título</label>
          <input v-model="local.title" type="text" class="input" placeholder="Antes de empezar" />
        </div>
        <div>
          <label class="text-sm font-medium text-slate-800 block mb-1">Subtítulo</label>
          <input v-model="local.subtitle" type="text" class="input" placeholder="Ayúdanos a atenderte mejor" />
        </div>
      </div>

      <div class="border-t border-surface-border" />

      <!-- Campos -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <div>
            <h3 class="font-semibold text-slate-800">Campos del formulario</h3>
            <p class="text-xs text-slate-500 mt-0.5">
              {{ activeFieldsCount }} de {{ local.fields.length }} campos activos. Usa las flechas para reordenar.
            </p>
          </div>
        </div>

        <div class="space-y-2">
          <WidgetFieldEditor
            v-for="(field, i) in sortedFields"
            :key="field.key"
            :field="field"
            :can-move-up="i > 0"
            :can-move-down="i < sortedFields.length - 1"
            @update="updateField(i, $event)"
            @move-up="moveField(field.key, 'up')"
            @move-down="moveField(field.key, 'down')"
          />
        </div>
      </div>

      <div class="border-t border-surface-border" />

      <!-- Labels de botones -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="text-sm font-medium text-slate-800 block mb-1">Texto del botón principal</label>
          <input v-model="local.submit_label" type="text" class="input" placeholder="Iniciar conversación" />
        </div>
        <div v-if="local.mode === 'optional'">
          <label class="text-sm font-medium text-slate-800 block mb-1">Texto del botón "Saltar"</label>
          <input v-model="local.skip_label" type="text" class="input" placeholder="Chatear como invitado" />
        </div>
      </div>

      <!-- Tip premium -->
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h4 class="font-semibold text-amber-900 text-sm flex items-center gap-2">
          💎 Tip premium sobre conversión
        </h4>
        <p class="text-xs text-amber-800 mt-1 leading-relaxed">
          <strong>Cada campo que pides reduce conversión ~15-20%.</strong> Empieza con el mínimo (nombre + email) y agrega más solo si los agentes lo necesitan para atender bien.
          Regla de oro: obligatorio solo para B2B de alto valor, opcional o nada para e-commerce.
        </p>
      </div>
    </template>

    <div v-else class="text-center py-12 text-slate-400">
      <div class="text-4xl mb-2">💬</div>
      <p class="text-sm">Pre-chat desactivado. Los clientes inician chat directamente.</p>
    </div>
  </div>
</template>
