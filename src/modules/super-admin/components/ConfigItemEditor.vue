<!-- Ruta: /src/modules/super-admin/components/ConfigItemEditor.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SystemConfigItem } from '@/types/system-config.types'
import { validateConfigValue } from '@/types/system-config.types'

interface Props {
  item: SystemConfigItem
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'save', key: string, value: any): void
  (e: 'reset', key: string): void
}>()

// Convertir el JSONB value a string para input
function jsonToInput(v: any): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

// Convertir input string al tipo correcto para JSONB
function inputToJson(input: string, type: string): any {
  if (type === 'number') return Number(input)
  if (type === 'boolean') return input === 'true'
  if (type === 'json') {
    try { return JSON.parse(input) } catch { return input }
  }
  return input  // string, url, email
}

const localValue = ref(jsonToInput(props.item.value))
const defaultInput = jsonToInput(props.item.defaultValue ?? props.item.value)
const saving = ref(false)
const validationError = ref<string | null>(null)

watch(() => props.item.value, (v) => {
  localValue.value = jsonToInput(v)
})

const isDirty = () => localValue.value !== jsonToInput(props.item.value)

async function save() {
  const parsedValue = inputToJson(localValue.value, props.item.valueType)
  const validation = validateConfigValue(parsedValue, props.item.valueType)

  if (!validation.valid) {
    validationError.value = validation.error ?? 'Valor no válido'
    return
  }

  validationError.value = null
  saving.value = true
  try {
    emit('save', props.item.key, parsedValue)
  } finally {
    saving.value = false
  }
}

function reset() {
  if (!confirm(`¿Restaurar "${props.item.key}" al valor por defecto?\n\nActual: ${localValue.value}\nPor defecto: ${defaultInput}`)) return
  emit('reset', props.item.key)
}

function discard() {
  localValue.value = jsonToInput(props.item.value)
  validationError.value = null
}
</script>

<template>
  <div class="border border-surface-border rounded-xl p-4 bg-white">
    <!-- Header -->
    <div class="flex items-start justify-between gap-3 mb-2">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <code class="text-sm font-mono font-semibold text-slate-800">{{ item.key }}</code>
          <span
            v-if="item.isPublic"
            class="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold uppercase tracking-wide"
            title="Visible públicamente (widget.js y no autenticados)"
          >
            Público
          </span>
          <span
            v-else
            class="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold uppercase tracking-wide"
            title="Solo visible para usuarios autenticados"
          >
            Privado
          </span>
          <span
            class="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 font-semibold uppercase tracking-wide"
          >
            {{ item.valueType }}
          </span>
        </div>
        <p v-if="item.description" class="text-xs text-slate-500 mt-1 leading-relaxed">
          {{ item.description }}
        </p>
      </div>
    </div>

    <!-- Input -->
    <div class="flex items-start gap-2 mt-3">
      <div class="flex-1 min-w-0">
        <!-- Boolean: toggle -->
        <div v-if="item.valueType === 'boolean'" class="flex items-center gap-2">
          <button
            class="w-12 h-6 rounded-full transition-colors"
            :class="localValue === 'true' ? 'bg-emerald-500' : 'bg-slate-300'"
            @click="localValue = localValue === 'true' ? 'false' : 'true'"
          >
            <div
              class="w-5 h-5 bg-white rounded-full transition-all"
              :class="localValue === 'true' ? 'ml-[26px]' : 'ml-0.5'"
            />
          </button>
          <span class="text-sm">{{ localValue === 'true' ? 'Activado' : 'Desactivado' }}</span>
        </div>

        <!-- JSON: textarea -->
        <textarea
          v-else-if="item.valueType === 'json'"
          v-model="localValue"
          rows="3"
          class="input !font-mono !text-xs"
          :placeholder="item.key"
        />

        <!-- Resto: input normal -->
        <input
          v-else
          v-model="localValue"
          :type="item.valueType === 'number' ? 'number' : (item.valueType === 'email' ? 'email' : 'text')"
          class="input !font-mono"
          :placeholder="defaultInput"
          @keydown.enter="isDirty() && save()"
        />

        <p v-if="validationError" class="text-xs text-red-600 mt-1">
          ⚠️ {{ validationError }}
        </p>
      </div>

      <!-- Actions -->
      <div class="flex gap-1 flex-shrink-0">
        <button
          v-if="isDirty()"
          class="px-2 py-1.5 text-xs rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
          title="Descartar cambios"
          @click="discard"
        >
          ↺
        </button>
        <button
          v-if="isDirty()"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Guardando...' : 'Guardar' }}
        </button>
        <button
          v-if="item.defaultValue !== null && item.defaultValue !== undefined"
          class="px-2 py-1.5 text-xs rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100"
          title="Restaurar valor por defecto"
          @click="reset"
        >
          🔄
        </button>
      </div>
    </div>

    <!-- Footer con última modificación -->
    <div class="mt-2 pt-2 border-t border-surface-border flex items-center justify-between text-[10px] text-slate-400">
      <span>Modificado: {{ new Date(item.updatedAt).toLocaleString('es') }}</span>
      <span v-if="item.defaultValue !== null && item.defaultValue !== undefined">
        Default: <code class="bg-slate-50 px-1">{{ defaultInput }}</code>
      </span>
    </div>
  </div>
</template>
