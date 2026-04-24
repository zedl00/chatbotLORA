<!-- Ruta: /src/modules/channels/components/widget-config/help/HelpTooltip.vue -->
<!-- Tooltip compacto con icono ℹ️, hover para mostrar -->
<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ text: string }>()

const show = ref(false)
</script>

<template>
  <div class="relative inline-flex items-center">
    <button
      class="w-4 h-4 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 flex items-center justify-center text-[10px] font-semibold transition-colors"
      type="button"
      @mouseenter="show = true"
      @mouseleave="show = false"
      @focus="show = true"
      @blur="show = false"
    >
      ℹ
    </button>
    <div
      v-if="show"
      class="absolute left-6 top-1/2 -translate-y-1/2 z-30 w-64 p-2.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg leading-snug pointer-events-none"
    >
      {{ text }}
      <span class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-slate-800 rotate-45" />
    </div>
  </div>
</template>
