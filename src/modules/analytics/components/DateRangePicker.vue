<!-- Ruta: /src/modules/analytics/components/DateRangePicker.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Selector de rango de fechas con presets rápidos + personalizado
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { DateRange, DateRangePreset } from '@/types/analytics.types'
import { DATE_PRESET_LABELS, computeDateRange } from '@/types/analytics.types'

interface Props {
  modelValue: DateRange
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', range: DateRange): void
}>()

const open = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const customStart = ref('')
const customEnd = ref('')

// Presets organizados en grupos
const quickPresets: DateRangePreset[] = ['today', 'yesterday']
const weekPresets: DateRangePreset[] = ['this_week', 'last_week']
const monthPresets: DateRangePreset[] = ['this_month', 'last_month']
const rollingPresets: DateRangePreset[] = ['last_7_days', 'last_30_days', 'last_90_days']
//const yearPresets: DateRangePreset[] = ['this_year']

const displayLabel = computed(() => {
  const label = DATE_PRESET_LABELS[props.modelValue.preset]
  if (props.modelValue.preset === 'custom') {
    const fmt = (d: Date) => d.toLocaleDateString('es', { day: '2-digit', month: 'short' })
    return `${fmt(props.modelValue.start)} – ${fmt(props.modelValue.end)}`
  }
  return label
})

function selectPreset(preset: DateRangePreset) {
  emit('update:modelValue', computeDateRange(preset))
  open.value = false
}

function applyCustom() {
  if (!customStart.value || !customEnd.value) return
  const range = computeDateRange('custom', new Date(customStart.value), new Date(customEnd.value))
  emit('update:modelValue', range)
  open.value = false
}

function toggleOpen(e: Event) {
  e.stopPropagation()
  if (!open.value) {
    // Precargar custom con valores actuales
    customStart.value = props.modelValue.start.toISOString().slice(0, 10)
    customEnd.value = props.modelValue.end.toISOString().slice(0, 10)
  }
  open.value = !open.value
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="dropdownRef" class="relative inline-block">
    <button
      class="flex items-center gap-2 px-3 py-1.5 text-sm border border-surface-border rounded-lg hover:bg-slate-50 transition-colors bg-white"
      @click="toggleOpen"
    >
      <span>📅</span>
      <span class="font-medium">{{ displayLabel }}</span>
      <span class="text-slate-400 text-xs">▾</span>
    </button>

    <div
      v-if="open"
      class="absolute top-full left-0 mt-1 w-80 bg-white border border-surface-border rounded-xl shadow-card z-40 overflow-hidden"
    >
      <!-- Presets rápidos -->
      <div class="p-3 border-b border-surface-border">
        <div class="text-[10px] uppercase tracking-wide font-medium text-slate-500 mb-1.5">Rápidos</div>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="p in [...quickPresets, ...weekPresets]"
            :key="p"
            class="px-2 py-1.5 text-xs rounded-md border transition-colors"
            :class="modelValue.preset === p
              ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
              : 'border-surface-border text-slate-700 hover:bg-slate-50'"
            @click="selectPreset(p)"
          >
            {{ DATE_PRESET_LABELS[p] }}
          </button>
        </div>
      </div>

      <!-- Mes -->
      <div class="p-3 border-b border-surface-border">
        <div class="text-[10px] uppercase tracking-wide font-medium text-slate-500 mb-1.5">Por mes</div>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="p in monthPresets"
            :key="p"
            class="px-2 py-1.5 text-xs rounded-md border transition-colors"
            :class="modelValue.preset === p
              ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
              : 'border-surface-border text-slate-700 hover:bg-slate-50'"
            @click="selectPreset(p)"
          >
            {{ DATE_PRESET_LABELS[p] }}
          </button>
        </div>
      </div>

      <!-- Rolling -->
      <div class="p-3 border-b border-surface-border">
        <div class="text-[10px] uppercase tracking-wide font-medium text-slate-500 mb-1.5">Últimos N días</div>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="p in rollingPresets"
            :key="p"
            class="px-2 py-1.5 text-xs rounded-md border transition-colors"
            :class="modelValue.preset === p
              ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
              : 'border-surface-border text-slate-700 hover:bg-slate-50'"
            @click="selectPreset(p)"
          >
            {{ DATE_PRESET_LABELS[p].replace('Últimos ', '').replace(' días', 'd') }}
          </button>
        </div>
      </div>

      <!-- Año -->
      <div class="p-3 border-b border-surface-border">
        <button
          class="w-full px-2 py-1.5 text-xs rounded-md border transition-colors"
          :class="modelValue.preset === 'this_year'
            ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
            : 'border-surface-border text-slate-700 hover:bg-slate-50'"
          @click="selectPreset('this_year')"
        >
          {{ DATE_PRESET_LABELS.this_year }}
        </button>
      </div>

      <!-- Custom -->
      <div class="p-3">
        <div class="text-[10px] uppercase tracking-wide font-medium text-slate-500 mb-1.5">Personalizado</div>
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <label class="text-xs text-slate-500 w-14">Desde:</label>
            <input v-model="customStart" type="date" class="input !text-xs !py-1 flex-1" />
          </div>
          <div class="flex items-center gap-2">
            <label class="text-xs text-slate-500 w-14">Hasta:</label>
            <input v-model="customEnd" type="date" class="input !text-xs !py-1 flex-1" />
          </div>
          <button
            class="w-full btn-primary !text-xs !py-1.5"
            :disabled="!customStart || !customEnd"
            @click="applyCustom"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
