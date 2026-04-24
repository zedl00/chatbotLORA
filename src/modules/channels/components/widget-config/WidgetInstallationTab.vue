<!-- Ruta: /src/modules/channels/components/widget-config/WidgetInstallationTab.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import HelpTooltip from './help/HelpTooltip.vue'

interface Props {
  channelId: string
  widgetUrl?: string  // e.g. https://lora.jabenter.com/widget.js
}

const props = withDefaults(defineProps<Props>(), {
  widgetUrl: 'https://lora.jabenter.com/widget.js'
})

const ui = useUiStore()

const snippet = computed(() => `<!-- LORA Chat Widget -->
<script>
  window.LoraChat = {
    channelId: '${props.channelId}'
  };
<\/script>
<script async src="${props.widgetUrl}"><\/script>`)

const copied = ref(false)

async function copySnippet() {
  try {
    await navigator.clipboard.writeText(snippet.value)
    copied.value = true
    ui.showToast('success', 'Código copiado al portapapeles')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    ui.showToast('error', 'No se pudo copiar. Copia manualmente.')
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-start gap-2">
      <h3 class="font-semibold text-slate-800">Código de instalación</h3>
      <HelpTooltip text="Pega este código antes del </body> en tu sitio web. El widget aparecerá automáticamente con la config actual." />
    </div>

    <!-- Code block -->
    <div class="relative">
      <pre class="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-x-auto font-mono leading-relaxed">{{ snippet }}</pre>
      <button
        class="absolute top-3 right-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
        :class="copied
          ? 'bg-emerald-500 text-white'
          : 'bg-slate-700 text-slate-200 hover:bg-slate-600'"
        @click="copySnippet"
      >
        {{ copied ? '✓ Copiado' : '📋 Copiar' }}
      </button>
    </div>

    <!-- Instrucciones -->
    <div>
      <h4 class="font-medium text-slate-800 text-sm mb-2">Pasos para instalar</h4>
      <ol class="space-y-2 text-sm text-slate-600">
        <li class="flex gap-2">
          <span class="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">1</span>
          Copia el código con el botón <strong>Copiar</strong>
        </li>
        <li class="flex gap-2">
          <span class="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">2</span>
          Abre el HTML de tu sitio web
        </li>
        <li class="flex gap-2">
          <span class="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">3</span>
          Pega el código <strong>justo antes de</strong> <code class="text-xs bg-slate-100 px-1.5 py-0.5 rounded">&lt;/body&gt;</code>
        </li>
        <li class="flex gap-2">
          <span class="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">4</span>
          Guarda y visita tu sitio: el widget aparece automáticamente
        </li>
      </ol>
    </div>

    <!-- Compatibilidad -->
    <div class="bg-slate-50 border border-surface-border rounded-xl p-4">
      <h4 class="font-medium text-slate-800 text-sm mb-2">¿Dónde se puede instalar?</h4>
      <div class="text-xs text-slate-600 space-y-1">
        <div>✅ Sitios HTML estáticos</div>
        <div>✅ WordPress (usa un plugin de "Insert Headers and Footers")</div>
        <div>✅ Shopify (Temas → Editar código → theme.liquid)</div>
        <div>✅ Wix, Squarespace (usa bloque "Código embebido")</div>
        <div>✅ React, Vue, Next.js (pégalo en el component principal o index.html)</div>
      </div>
    </div>

    <!-- Tip de prueba -->
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <h4 class="font-medium text-blue-900 text-sm flex items-center gap-2">
        💡 Cómo probarlo rápido
      </h4>
      <p class="text-xs text-blue-800 mt-1 leading-relaxed">
        Usa <a href="https://codepen.io/pen" target="_blank" class="underline font-medium">CodePen.io</a> → crea un pen nuevo → pega el código en la sección HTML.
        Verás el widget aparecer inmediatamente sin necesidad de deploy.
      </p>
    </div>
  </div>
</template>
