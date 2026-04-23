<!-- Ruta: /src/modules/channels/components/WidgetInstallSnippet.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     MODIFICADO en Rebranding público (Sprint 7.5):
       - Snippet en producción apunta a admin.lorachat.net/widget.js
       - Comentario del snippet ahora dice "LORA Chat Widget"
       - Feedback visual mejorado al copiar (botón verde temporal)
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{ channelId: string }>()
const copied = ref(false)

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// URL del widget.js:
// - En producción: siempre apunta al dominio oficial del admin
// - En desarrollo: usa el mismo origin (localhost:5173) para testing local
const widgetUrl = computed(() => {
  if (import.meta.env.PROD) {
    return 'https://admin.lorachat.net/widget.js'
  }
  return `${window.location.origin}/widget.js`
})

const snippet = computed(() => {
  return `<!-- LORA Chat Widget -->
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
        class="text-xs px-3 py-1 rounded-lg text-white transition-colors"
        :class="copied ? 'bg-emerald-600' : 'bg-brand-600 hover:bg-brand-700'"
        @click="copy"
      >
        {{ copied ? '✓ Copiado' : 'Copiar' }}
      </button>
    </div>

    <p class="text-xs text-slate-600">
      Pega este código antes del cierre de
      <code class="bg-slate-100 px-1 rounded">&lt;/body&gt;</code>
      en tu sitio web. Funciona en cualquier página HTML, WordPress, Shopify, Wix, etc.
    </p>

    <pre class="bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre"><code>{{ snippet }}</code></pre>

    <div class="text-xs text-slate-500 space-y-1">
      <p><strong>ℹ️ Tips:</strong></p>
      <ul class="list-disc ml-5 space-y-0.5">
        <li>El widget se carga de forma asíncrona y no bloquea tu sitio.</li>
        <li>Configura los <code>allowed_origins</code> para restringir desde qué dominios puede usarse.</li>
        <li>La <code>anon_key</code> es segura para el cliente; las políticas RLS la limitan.</li>
        <li>Cambios en la configuración del widget se reflejan al instante, sin reinstalar.</li>
      </ul>
    </div>
  </div>
</template>
