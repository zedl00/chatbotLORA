<!-- Ruta: /src/modules/channels/components/widget-config/WidgetAppearanceTab.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { WidgetBrandingConfig } from '@/types/widget.types'
import HelpTooltip from './help/HelpTooltip.vue'

interface Props {
  modelValue: WidgetBrandingConfig
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', v: WidgetBrandingConfig): void }>()

const local = ref<WidgetBrandingConfig>({ ...props.modelValue })

watch(() => props.modelValue, v => { local.value = { ...v } }, { deep: true })
watch(local, v => { emit('update:modelValue', v) }, { deep: true })

const COLOR_PRESETS = [
  { label: 'Azul LORA',   color: '#0071E3' },
  { label: 'Verde',       color: '#10b981' },
  { label: 'Morado',      color: '#8b5cf6' },
  { label: 'Rosa',        color: '#ec4899' },
  { label: 'Naranja',     color: '#f97316' },
  { label: 'Negro',       color: '#1e293b' }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Color primario -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <label class="text-sm font-medium text-slate-800">Color primario</label>
        <HelpTooltip text="El color del botón flotante y los bubbles de mensaje del agente. Usa el color principal de tu marca." />
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <input
          v-model="local.primary_color"
          type="color"
          class="w-14 h-10 rounded-lg border border-surface-border cursor-pointer"
        />
        <input
          v-model="local.primary_color"
          type="text"
          class="input w-32 !font-mono text-sm"
          maxlength="7"
          placeholder="#0071E3"
        />
        <div class="flex gap-1 flex-wrap">
          <button
            v-for="p in COLOR_PRESETS"
            :key="p.color"
            class="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
            :style="{
              backgroundColor: p.color,
              borderColor: local.primary_color === p.color ? '#1e293b' : 'transparent'
            }"
            :title="p.label"
            @click="local.primary_color = p.color"
          />
        </div>
      </div>
    </div>

    <div class="border-t border-surface-border" />

    <!-- Posición -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <label class="text-sm font-medium text-slate-800">Posición</label>
        <HelpTooltip text="¿En qué lado de la pantalla aparece el botón del chat?" />
      </div>
      <div class="flex gap-2">
        <button
          class="px-4 py-2 text-sm rounded-lg border transition-colors"
          :class="local.position === 'left'
            ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
            : 'border-surface-border text-slate-700 hover:bg-slate-50'"
          @click="local.position = 'left'"
        >
          ◀ Izquierda
        </button>
        <button
          class="px-4 py-2 text-sm rounded-lg border transition-colors"
          :class="local.position === 'right'
            ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
            : 'border-surface-border text-slate-700 hover:bg-slate-50'"
          @click="local.position = 'right'"
        >
          Derecha ▶
        </button>
      </div>
    </div>

    <div class="border-t border-surface-border" />

    <!-- Offsets -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <label class="text-sm font-medium text-slate-800">Separación de bordes (px)</label>
        <HelpTooltip text="Distancia desde los bordes de la ventana. Útil si tu sitio tiene otros elementos flotantes." />
      </div>
      <div class="grid grid-cols-2 gap-3 max-w-sm">
        <div>
          <label class="text-xs text-slate-500 mb-1 block">Horizontal</label>
          <input v-model.number="local.offset_x" type="number" min="0" max="100" class="input" />
        </div>
        <div>
          <label class="text-xs text-slate-500 mb-1 block">Vertical</label>
          <input v-model.number="local.offset_y" type="number" min="0" max="100" class="input" />
        </div>
      </div>
    </div>

    <div class="border-t border-surface-border" />

    <!-- Marca -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <label class="text-sm font-medium text-slate-800">Nombre de tu marca</label>
        <HelpTooltip text="Aparece como encabezado del widget cuando está abierto. Ejemplo: 'Soporte Norson'." />
      </div>
      <input v-model="local.brand_name" type="text" class="input max-w-md" placeholder="Asistente" />
    </div>

    <!-- Logo -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <label class="text-sm font-medium text-slate-800">URL del logo (opcional)</label>
        <HelpTooltip text="URL pública de tu logo. Si se deja vacío, se muestra la inicial del nombre." />
      </div>
      <input
        v-model="local.logo_url"
        type="text"
        class="input max-w-xl"
        placeholder="https://tudominio.com/logo.png"
      />
      <p class="text-xs text-slate-400 mt-1">Se recomienda PNG 128×128px con fondo transparente</p>
    </div>

    <!-- Mensaje de bienvenida -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <label class="text-sm font-medium text-slate-800">Mensaje de bienvenida</label>
        <HelpTooltip text="Primer mensaje que ve el cliente al abrir el widget. Mantenlo breve y amigable." />
      </div>
      <textarea
        v-model="local.welcome_message"
        rows="2"
        class="input max-w-xl"
        placeholder="¡Hola! ¿En qué puedo ayudarte?"
      />
    </div>

    <!-- Placeholder del input -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <label class="text-sm font-medium text-slate-800">Placeholder del input</label>
        <HelpTooltip text="Texto que aparece en el input de mensaje cuando está vacío." />
      </div>
      <input
        v-model="local.placeholder"
        type="text"
        class="input max-w-md"
        placeholder="Escribe tu mensaje..."
      />
    </div>
  </div>
</template>
