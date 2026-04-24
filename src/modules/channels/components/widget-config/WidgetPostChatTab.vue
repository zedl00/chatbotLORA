<!-- Ruta: /src/modules/channels/components/widget-config/WidgetPostChatTab.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PostChatConfig } from '@/types/widget.types'
import HelpTooltip from './help/HelpTooltip.vue'

interface Props {
  modelValue: PostChatConfig
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', v: PostChatConfig): void }>()

const local = ref<PostChatConfig>({ ...props.modelValue })

watch(() => props.modelValue, v => { local.value = { ...v } }, { deep: true })
watch(local, v => { emit('update:modelValue', v) }, { deep: true })
</script>

<template>
  <div class="space-y-5">
    <!-- Toggle principal -->
    <div class="bg-brand-50 border border-brand-200 rounded-xl p-4">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <h3 class="font-semibold text-slate-800 flex items-center gap-2">
            Post-chat activo
            <HelpTooltip text="Al cerrar una conversación, muestra una encuesta de satisfacción (estrellas)." />
          </h3>
          <p class="text-xs text-slate-600 mt-1">
            Pide al cliente que valore la atención con estrellas. Los resultados aparecen en Analytics.
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
      <!-- CSAT toggle -->
      <div class="flex items-center justify-between gap-4 bg-slate-50 border border-surface-border rounded-xl p-4">
        <div class="flex-1">
          <h4 class="font-medium text-slate-800 text-sm flex items-center gap-2">
            Pedir calificación con estrellas
            <HelpTooltip text="Sistema clásico 1-5 estrellas. Llena el campo csat_score en tu DB." />
          </h4>
          <p class="text-xs text-slate-500 mt-0.5">Si está desactivado, solo muestra mensaje de agradecimiento.</p>
        </div>
        <button
          class="w-10 h-5 rounded-full transition-colors flex-shrink-0"
          :class="local.ask_csat ? 'bg-amber-500' : 'bg-slate-300'"
          @click="local.ask_csat = !local.ask_csat"
        >
          <div
            class="w-4 h-4 bg-white rounded-full transition-all"
            :class="local.ask_csat ? 'ml-[22px]' : 'ml-0.5'"
          />
        </button>
      </div>

      <!-- Comentario opcional -->
      <div class="flex items-center justify-between gap-4 bg-slate-50 border border-surface-border rounded-xl p-4">
        <div class="flex-1">
          <h4 class="font-medium text-slate-800 text-sm flex items-center gap-2">
            Permitir comentario
            <HelpTooltip text="Añade un textarea opcional para que el cliente deje un comentario. Llena csat_feedback." />
          </h4>
          <p class="text-xs text-slate-500 mt-0.5">El cliente puede agregar texto adicional. Siempre opcional.</p>
        </div>
        <button
          class="w-10 h-5 rounded-full transition-colors flex-shrink-0"
          :class="local.comment_enabled ? 'bg-brand-600' : 'bg-slate-300'"
          @click="local.comment_enabled = !local.comment_enabled"
        >
          <div
            class="w-4 h-4 bg-white rounded-full transition-all"
            :class="local.comment_enabled ? 'ml-[22px]' : 'ml-0.5'"
          />
        </button>
      </div>

      <div class="border-t border-surface-border" />

      <!-- Textos -->
      <div class="space-y-3">
        <div>
          <label class="text-sm font-medium text-slate-800 block mb-1">Título</label>
          <input v-model="local.title" type="text" class="input" placeholder="¿Cómo fue tu atención?" />
        </div>
        <div>
          <label class="text-sm font-medium text-slate-800 block mb-1">Subtítulo</label>
          <input v-model="local.subtitle" type="text" class="input" placeholder="Tu opinión nos ayuda a mejorar" />
        </div>
        <div v-if="local.comment_enabled">
          <label class="text-sm font-medium text-slate-800 block mb-1">Placeholder del comentario</label>
          <input v-model="local.comment_placeholder" type="text" class="input" placeholder="Cuéntanos más (opcional)" />
        </div>
        <div>
          <label class="text-sm font-medium text-slate-800 block mb-1">Mensaje final de agradecimiento</label>
          <input v-model="local.thank_you_message" type="text" class="input" placeholder="¡Gracias por tu tiempo!" />
        </div>
      </div>

      <!-- Tip premium -->
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h4 class="font-semibold text-amber-900 text-sm flex items-center gap-2">
          💎 Tip premium
        </h4>
        <p class="text-xs text-amber-800 mt-1 leading-relaxed">
          <strong>CSAT sin coacción.</strong> El cliente puede cerrar sin responder. Los CSAT obligatorios dan data falsa (4★ por obligación). Mejor respuestas sinceras de menos gente.
          Target realista: <strong>40-60% de respuesta</strong>, <strong>CSAT promedio 4.2-4.6</strong>.
        </p>
      </div>
    </template>

    <div v-else class="text-center py-12 text-slate-400">
      <div class="text-4xl mb-2">⭐</div>
      <p class="text-sm">Post-chat desactivado. No se pide feedback al cerrar.</p>
    </div>
  </div>
</template>
