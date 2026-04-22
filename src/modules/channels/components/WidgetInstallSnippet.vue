<!-- Ruta: /src/modules/channels/components/WidgetInstallSnippet.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{ channelId: string }>()

const copied = ref(false)

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// URL del widget.js - en producción sería el CDN/host del widget compilado
const widgetUrl = computed(() => {
  const origin = window.location.origin
  return `${origin}/widget.js`
})

const snippet = computed(() => {
  return `<!-- ChatBot IA Widget -->
<script
  src="${widgetUrl.value}"
  data-channel-id="${props.channelId}"
  data-supabase-url="${supabaseUrl}"
  data-supabase-anon-key="${supabaseAnon}"
  async
><` + `/script>`
})

async function copy() {
  try {
    await navigator.clipboard.writeText(snippet.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    alert('No se pudo copiar. Selecciona el texto manualmente.')
  }
}
</script>

<template>
  <div class="mt-4 pt-4 border-t border-surface-border space-y-3">
    <div class="flex items-center justify-between">
      <h4 class="font-semibold text-slate-700 text-sm">📋 Código de instalación</h4>
      <button
        class="text-xs px-3 py-1 rounded-lg bg-brand-600 text-white"
        @click="copy"
      >
        {{ copied ? '✓ Copiado' : 'Copiar' }}
      </button>
    </div>

    <p class="text-xs text-slate-600">
      Pega este código antes del cierre de <code class="bg-slate-100 px-1 rounded">&lt;/body&gt;</code> en tu sitio web.
      Funciona en cualquier página HTML, WordPress, Shopify, etc.
    </p>

    <pre class="bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre"><code>{{ snippet }}</code></pre>

    <div class="text-xs text-slate-500 space-y-1">
      <p>
        <strong>⚠️ Para producción:</strong>
      </p>
      <ul class="list-disc ml-5 space-y-0.5">
        <li>Aloja el archivo <code>widget.js</code> en un CDN o en tu servidor.</li>
        <li>Configura los <code>allowed_origins</code> del widget para restringir dominios.</li>
        <li>La <code>anon_key</code> es segura para el cliente (RLS la limita).</li>
      </ul>
    </div>
  </div>
</template>
