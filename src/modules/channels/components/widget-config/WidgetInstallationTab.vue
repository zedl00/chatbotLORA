<!-- Ruta: /src/modules/channels/components/widget-config/WidgetInstallationTab.vue -->
<!-- 🆕 Sprint 11.6 (fix3): usa store directamente, sin destructurar -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useSystemConfigStore } from '@/stores/system-config.store'

interface Props {
  channelId: string
  widgetUrl?: string  // override opcional, si no usa el del store
}

const props = withDefaults(defineProps<Props>(), {
  widgetUrl: undefined
})

const ui = useUiStore()
const configStore = useSystemConfigStore()

// Si llega como prop, lo usa; si no, lo lee de la config global
const effectiveWidgetUrl = computed(() => props.widgetUrl ?? configStore.widgetUrl)

const snippet = computed(() => `<!-- LORA Chat Widget -->
<script>
  window.LoraChat = {
    channelId: '${props.channelId}'
  };
<\/script>
<script async src="${effectiveWidgetUrl.value}"><\/script>`)

const copied = ref(false)

async function copySnippet() {
  try {
    await navigator.clipboard.writeText(snippet.value)
    copied.value = true
    ui.showToast('success', 'Código copiado al portapapeles')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    ui.showToast('error', 'No se pudo copiar')
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Intro -->
    <div>
      <h3 class="text-lg font-semibold text-slate-800">Instalación del widget</h3>
      <p class="text-sm text-slate-500 mt-1">
        Copia este código y pégalo justo antes del cierre de <code class="bg-slate-100 px-1 py-0.5 rounded text-xs">&lt;/body&gt;</code> en tu sitio web.
      </p>
    </div>

    <!-- Snippet -->
    <div class="relative">
      <pre class="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed"><code>{{ snippet }}</code></pre>
      <button
        class="absolute top-3 right-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
        :class="copied
          ? 'bg-emerald-500 text-white'
          : 'bg-slate-700 text-white hover:bg-slate-600'"
        @click="copySnippet"
      >
        {{ copied ? '✓ Copiado' : '📋 Copiar' }}
      </button>
    </div>

    <!-- Pasos -->
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <h4 class="font-semibold text-blue-900 text-sm mb-2">📝 Pasos</h4>
      <ol class="space-y-1.5 text-xs text-blue-900 pl-4 list-decimal leading-relaxed">
        <li>Copia el código de arriba.</li>
        <li>Abre el archivo <strong>index.html</strong> de tu sitio (o el template global de tu CMS).</li>
        <li>Pega el código <strong>justo antes</strong> de <code class="bg-blue-100 px-1 rounded">&lt;/body&gt;</code>.</li>
        <li>Guarda y publica los cambios.</li>
        <li>Visita tu sitio: el botón flotante 💬 debería aparecer en la esquina.</li>
      </ol>
    </div>

    <!-- Detalles técnicos -->
    <details class="group">
      <summary class="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900 select-none">
        <span class="group-open:hidden">▶</span><span class="hidden group-open:inline">▼</span> Detalles técnicos
      </summary>
      <div class="mt-3 space-y-3 text-xs text-slate-600 bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div>
          <strong class="text-slate-800">Channel ID:</strong>
          <code class="ml-1 bg-white px-1.5 py-0.5 rounded border border-slate-200">{{ channelId }}</code>
        </div>
        <div>
          <strong class="text-slate-800">URL del widget:</strong>
          <code class="ml-1 bg-white px-1.5 py-0.5 rounded border border-slate-200">{{ effectiveWidgetUrl }}</code>
        </div>
        <div>
          <strong class="text-slate-800">Tamaño del script:</strong> ~30 KB minificado
        </div>
        <div>
          <strong class="text-slate-800">Carga:</strong> async (no bloquea el render)
        </div>
        <div>
          <strong class="text-slate-800">Compatibilidad:</strong> Todos los navegadores modernos
        </div>
      </div>
    </details>

    <!-- CodePen test -->
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <h4 class="font-semibold text-amber-900 text-sm mb-2">🧪 ¿Probar antes de publicar?</h4>
      <p class="text-xs text-amber-900 leading-relaxed">
        Crea un Pen en <a href="https://codepen.io" target="_blank" rel="noopener" class="underline">CodePen</a>,
        pega el snippet en la sección HTML, y guarda. El widget debería aparecer en la vista previa.
      </p>
    </div>
  </div>
</template>
