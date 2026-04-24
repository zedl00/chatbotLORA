<!-- Ruta: /src/modules/channels/components/widget-config/help/WidgetConfigHelpPanel.vue -->
<!-- Panel lateral slide-in con documentación premium del widget config -->
<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

// Sección activa (solo una expandida por UX)
const activeSection = ref<string>('overview')

function toggle(id: string) {
  activeSection.value = activeSection.value === id ? '' : id
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-slate-900/30 z-40"
        @click="close"
      />
    </Transition>

    <!-- Panel -->
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="modelValue"
        class="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-xl z-50 overflow-auto"
      >
        <!-- Header -->
        <div class="sticky top-0 bg-white border-b border-surface-border px-5 py-4 flex items-center justify-between z-10">
          <h3 class="font-semibold text-slate-800 flex items-center gap-2">
            <span class="text-xl">💡</span>
            Guía del Widget
          </h3>
          <button
            class="w-8 h-8 rounded-lg hover:bg-slate-100 grid place-items-center text-slate-500 hover:text-slate-800"
            @click="close"
          >
            ✕
          </button>
        </div>

        <!-- Content -->
        <div class="px-5 py-4 space-y-2">
          <!-- Overview -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between transition-colors"
              @click="toggle('overview')"
            >
              <span class="font-semibold text-sm text-slate-800">🎯 ¿Qué es este widget?</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'overview' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'overview'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <p>El widget es la "ventana de chat" que aparece flotando en tu sitio web. Es el punto de entrada donde tus clientes interactúan primero con el bot IA y luego (si es necesario) con un agente humano.</p>
              <p>Todo lo que configuras aquí se aplica en tiempo real: no necesitas reinstalarlo en tu sitio cuando cambias algo.</p>
            </div>
          </div>

          <!-- Pre-chat -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between transition-colors"
              @click="toggle('prechat')"
            >
              <span class="font-semibold text-sm text-slate-800">📝 ¿Cuándo activar el pre-chat?</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'prechat' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'prechat'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <p class="font-medium text-emerald-700">✅ Recomendado activar si:</p>
              <ul class="space-y-1 pl-4 list-disc">
                <li>Tu negocio es B2B y calificas leads</li>
                <li>Ofreces servicios que requieren seguimiento</li>
                <li>Quieres reducir spam o consultas triviales</li>
                <li>Tienes equipos por departamento (Ventas, Soporte, etc.)</li>
              </ul>
              <p class="font-medium text-red-700 mt-3">❌ NO recomendado si:</p>
              <ul class="space-y-1 pl-4 list-disc">
                <li>Eres e-commerce con consultas rápidas de producto</li>
                <li>Tu tráfico es mayoritariamente mobile</li>
                <li>Quieres maximizar volumen de conversaciones</li>
              </ul>
            </div>
          </div>

          <!-- Campos -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between transition-colors"
              @click="toggle('fields')"
            >
              <span class="font-semibold text-sm text-slate-800">🎚️ ¿Qué campos debo pedir?</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'fields' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'fields'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <p>Regla de oro: <strong>cada campo adicional reduce conversión 15-20%</strong>.</p>
              <div class="space-y-2 mt-3">
                <div class="bg-white rounded-lg p-3 border border-surface-border">
                  <div class="font-medium text-slate-800">👤 Nombre</div>
                  <div class="text-xs text-slate-500 mt-0.5">Personalización. Siempre recomendado.</div>
                </div>
                <div class="bg-white rounded-lg p-3 border border-surface-border">
                  <div class="font-medium text-slate-800">📧 Email</div>
                  <div class="text-xs text-slate-500 mt-0.5">Esencial para seguimiento. Aumenta lead quality 3×.</div>
                </div>
                <div class="bg-white rounded-lg p-3 border border-surface-border">
                  <div class="font-medium text-slate-800">📱 Teléfono</div>
                  <div class="text-xs text-slate-500 mt-0.5">Solo si haces outbound calls. Muy intrusivo.</div>
                </div>
                <div class="bg-white rounded-lg p-3 border border-surface-border">
                  <div class="font-medium text-slate-800">🏷️ Motivo</div>
                  <div class="text-xs text-slate-500 mt-0.5">Permite rutear automáticamente según el tema.</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Post-chat -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between transition-colors"
              @click="toggle('postchat')"
            >
              <span class="font-semibold text-sm text-slate-800">⭐ ¿Vale la pena el post-chat CSAT?</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'postchat' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'postchat'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <p><strong>Sí, activarlo siempre.</strong></p>
              <p>El CSAT llena el campo <code class="text-xs bg-slate-200 px-1.5 py-0.5 rounded">csat_score</code> que usamos en tu dashboard de Analytics para calcular la satisfacción promedio y las tendencias por agente.</p>
              <p class="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-900">
                💡 Sin CSAT, tu Analytics no sabe qué agentes son mejores. Las estrellas son el feedback más valioso que puedes obtener.
              </p>
              <p class="text-xs text-slate-500 mt-2">
                <strong>Targets realistas:</strong><br>
                • Respuesta: 40-60% de clientes responden<br>
                • CSAT promedio saludable: 4.2-4.6 ★<br>
                • &lt;3.5 ★ sostenido → algo anda mal (revisa los comentarios)
              </p>
            </div>
          </div>

          <!-- Instalación -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between transition-colors"
              @click="toggle('install')"
            >
              <span class="font-semibold text-sm text-slate-800">🚀 Primera instalación</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'install' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'install'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <ol class="space-y-2 pl-5 list-decimal">
                <li>Configura primero la apariencia y pre-chat</li>
                <li>Ve a la pestaña "Instalación"</li>
                <li>Copia el snippet</li>
                <li>Pégalo antes de <code class="text-xs bg-slate-200 px-1.5 py-0.5 rounded">&lt;/body&gt;</code></li>
                <li>Prueba en una página antes de publicar</li>
              </ol>
              <p class="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 mt-3">
                ⚠️ Si cambias el <code class="text-[10px] bg-amber-100 px-1 rounded">channelId</code> después de instalar, las conversaciones previas se mantienen pero nuevas van a otro canal.
              </p>
            </div>
          </div>

          <!-- Glosario -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between transition-colors"
              @click="toggle('glossary')"
            >
              <span class="font-semibold text-sm text-slate-800">📚 Glosario</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'glossary' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'glossary'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-3 leading-relaxed">
              <div>
                <div class="font-semibold">Pre-chat</div>
                <p class="text-xs text-slate-500">Formulario que ve el cliente antes de iniciar la conversación.</p>
              </div>
              <div>
                <div class="font-semibold">Post-chat</div>
                <p class="text-xs text-slate-500">Encuesta que aparece al cerrarse la conversación.</p>
              </div>
              <div>
                <div class="font-semibold">CSAT (Customer Satisfaction)</div>
                <p class="text-xs text-slate-500">Métrica 1-5 estrellas que mide satisfacción del cliente.</p>
              </div>
              <div>
                <div class="font-semibold">Conversión</div>
                <p class="text-xs text-slate-500">% de visitantes de tu sitio que inician una conversación.</p>
              </div>
              <div>
                <div class="font-semibold">Lead quality</div>
                <p class="text-xs text-slate-500">Qué tan calificado (con datos e intención) llega un contacto.</p>
              </div>
              <div>
                <div class="font-semibold">Handoff</div>
                <p class="text-xs text-slate-500">Momento en que el bot IA pasa la conversación a un humano.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>
