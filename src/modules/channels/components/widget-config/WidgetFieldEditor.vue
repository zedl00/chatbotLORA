<!-- Ruta: /src/modules/channels/components/widget-config/WidgetFieldEditor.vue -->
<script setup lang="ts">
import type { PreChatField } from '@/types/widget.types'
import { FIELD_METADATA } from '@/types/widget.types'

interface Props {
  field: PreChatField
  canMoveUp: boolean
  canMoveDown: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update', field: PreChatField): void
  (e: 'moveUp'): void
  (e: 'moveDown'): void
}>()

function updateField(patch: Partial<PreChatField>) {
  emit('update', { ...props.field, ...patch })
}
</script>

<template>
  <div
    class="border border-surface-border rounded-xl p-3 transition-colors"
    :class="field.visible ? 'bg-white' : 'bg-slate-50 opacity-75'"
  >
    <div class="flex items-start gap-3">
      <!-- Icono + info -->
      <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 grid place-items-center text-xl">
        {{ FIELD_METADATA[field.key].icon }}
      </div>

      <!-- Info principal -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <input
            :value="field.label"
            type="text"
            class="text-sm font-semibold text-slate-800 bg-transparent border-none outline-none hover:bg-slate-50 focus:bg-slate-50 px-1 py-0.5 rounded w-full max-w-[200px]"
            @input="updateField({ label: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <p class="text-xs text-slate-500">{{ FIELD_METADATA[field.key].description }}</p>

        <!-- Options para reason -->
        <div v-if="field.key === 'reason' && field.visible" class="mt-2">
          <div class="text-xs text-slate-500 mb-1">Opciones del desplegable (separadas por coma):</div>
          <input
            :value="(field.options ?? []).join(', ')"
            type="text"
            class="input text-xs"
            placeholder="Ventas, Soporte, Facturación, Otro"
            @input="updateField({ options: ($event.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean) })"
          />
        </div>
      </div>

      <!-- Toggles: visible y obligatorio -->
      <div class="flex flex-col gap-2 items-end flex-shrink-0">
        <label class="flex items-center gap-1.5 cursor-pointer select-none text-xs">
          <span class="text-slate-600">Mostrar</span>
          <div
            class="relative w-8 h-4 rounded-full transition-colors"
            :class="field.visible ? 'bg-brand-500' : 'bg-slate-300'"
            @click="updateField({ visible: !field.visible })"
          >
            <div
              class="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all"
              :class="field.visible ? 'left-[18px]' : 'left-0.5'"
            />
          </div>
        </label>
        <label
          class="flex items-center gap-1.5 select-none text-xs"
          :class="field.visible ? 'cursor-pointer text-slate-600' : 'cursor-not-allowed text-slate-300'"
        >
          <span>Obligatorio</span>
          <div
            class="relative w-8 h-4 rounded-full transition-colors"
            :class="field.visible && field.required ? 'bg-red-500' : 'bg-slate-300'"
            @click="field.visible && updateField({ required: !field.required })"
          >
            <div
              class="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all"
              :class="field.visible && field.required ? 'left-[18px]' : 'left-0.5'"
            />
          </div>
        </label>
      </div>

      <!-- Orden: flechas -->
      <div class="flex flex-col flex-shrink-0 border-l border-surface-border pl-2">
        <button
          class="w-6 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded text-xs disabled:opacity-30 disabled:cursor-not-allowed"
          :disabled="!canMoveUp"
          @click="emit('moveUp')"
        >
          ▲
        </button>
        <button
          class="w-6 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded text-xs disabled:opacity-30 disabled:cursor-not-allowed"
          :disabled="!canMoveDown"
          @click="emit('moveDown')"
        >
          ▼
        </button>
      </div>
    </div>
  </div>
</template>
