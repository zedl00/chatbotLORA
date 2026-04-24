<!-- Ruta: /src/modules/channels/components/help/ChannelsHelpPanel.vue -->
<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const activeSection = ref('what')

function toggle(id: string) {
  activeSection.value = activeSection.value === id ? '' : id
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div v-if="modelValue" class="fixed inset-0 bg-slate-900/30 z-40" @click="close" />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-x-full"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="modelValue"
        class="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-xl z-50 overflow-auto"
      >
        <div class="sticky top-0 bg-white border-b border-surface-border px-5 py-4 flex items-center justify-between z-10">
          <h3 class="font-semibold text-slate-800 flex items-center gap-2">
            <span class="text-xl">💡</span>
            Guía de Canales
          </h3>
          <button class="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 grid place-items-center" @click="close">✕</button>
        </div>

        <div class="px-5 py-4 space-y-2">
          <!-- Qué es -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
              @click="toggle('what')"
            >
              <span class="font-semibold text-sm text-slate-800">🔌 ¿Qué es un canal?</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'what' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'what'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <p>Un <strong>canal</strong> es la vía por donde llegan conversaciones: un widget en tu sitio web, una cuenta de WhatsApp, un bot de Telegram, etc.</p>
              <p>Cada canal tiene su propia configuración, bot IA y métricas, pero todas las conversaciones aparecen unificadas en tu <strong>Bandeja</strong>.</p>
              <p class="text-xs text-slate-500 italic">Una empresa puede tener varios canales activos simultáneamente (ejemplo: widget web + WhatsApp + Telegram).</p>
            </div>
          </div>

          <!-- Cuántos canales crear -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
              @click="toggle('howmany')"
            >
              <span class="font-semibold text-sm text-slate-800">🎯 ¿Cuántos canales crear?</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'howmany' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'howmany'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <p class="font-medium">Lo más común: <strong>1 canal por tipo y por "uso"</strong>.</p>
              <div class="space-y-2 mt-2">
                <div class="bg-white rounded-lg p-3 border border-surface-border">
                  <div class="font-medium text-slate-800">Empresa simple (1-5 canales)</div>
                  <p class="text-xs text-slate-500 mt-1">Widget principal + WhatsApp + Instagram</p>
                </div>
                <div class="bg-white rounded-lg p-3 border border-surface-border">
                  <div class="font-medium text-slate-800">Empresa con varios sitios (3-10 canales)</div>
                  <p class="text-xs text-slate-500 mt-1">Widget blog + Widget checkout + Widget landing ventas + WhatsApp</p>
                </div>
                <div class="bg-white rounded-lg p-3 border border-surface-border">
                  <div class="font-medium text-slate-800">Empresa grande (10+ canales)</div>
                  <p class="text-xs text-slate-500 mt-1">Uno por producto, por idioma, por región, etc.</p>
                </div>
              </div>
              <div class="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 mt-3">
                💡 <strong>Tip:</strong> cada canal tiene su config independiente, así puedes tener un widget azul en el blog y uno rojo en checkout.
              </div>
            </div>
          </div>

          <!-- Métricas -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
              @click="toggle('metrics')"
            >
              <span class="font-semibold text-sm text-slate-800">📊 ¿Qué significan las métricas?</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'metrics' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'metrics'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-3 leading-relaxed">
              <div>
                <div class="font-semibold">Conversaciones</div>
                <p class="text-xs text-slate-500">Total histórico de conversaciones recibidas en este canal.</p>
              </div>
              <div>
                <div class="font-semibold">+N últimos 30d</div>
                <p class="text-xs text-slate-500">Cantidad nueva en los últimos 30 días. Si es 0 prolongado, el canal está "silencioso".</p>
              </div>
              <div>
                <div class="font-semibold">CSAT (30d)</div>
                <p class="text-xs text-slate-500">Satisfacción promedio del cliente. Target saludable: 4.2-4.6 ★.</p>
              </div>
              <div>
                <div class="font-semibold">Actividad</div>
                <p class="text-xs text-slate-500">Cuándo llegó la última conversación. Útil para saber si un canal está olvidado.</p>
              </div>
            </div>
          </div>

          <!-- Acciones -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
              @click="toggle('actions')"
            >
              <span class="font-semibold text-sm text-slate-800">⚙️ Acciones disponibles</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'actions' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'actions'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <div>
                <div class="font-semibold">⚙️ Configurar</div>
                <p class="text-xs text-slate-500">Abre toda la config del canal: apariencia, pre-chat, post-chat, instalación.</p>
              </div>
              <div>
                <div class="font-semibold">📋 Copiar código</div>
                <p class="text-xs text-slate-500">Copia el snippet de instalación al portapapeles para pegarlo en tu sitio.</p>
              </div>
              <div>
                <div class="font-semibold">✏️ Renombrar</div>
                <p class="text-xs text-slate-500">Cambia solo el nombre interno. El código ya instalado sigue funcionando.</p>
              </div>
              <div>
                <div class="font-semibold">📑 Duplicar</div>
                <p class="text-xs text-slate-500">Copia toda la config a un canal nuevo. Útil para clonar configs probadas.</p>
              </div>
              <div>
                <div class="font-semibold">⏸️ Desactivar</div>
                <p class="text-xs text-slate-500">Detiene el canal sin borrarlo. Las conversaciones existentes se conservan.</p>
              </div>
              <div>
                <div class="font-semibold">🗑️ Eliminar</div>
                <p class="text-xs text-slate-500 text-red-600">Solo canales sin conversaciones. Acción irreversible.</p>
              </div>
            </div>
          </div>

          <!-- Qué tipo elegir -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
              @click="toggle('whichtype')"
            >
              <span class="font-semibold text-sm text-slate-800">🎚️ ¿Qué tipo de canal empezar?</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'whichtype' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'whichtype'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <p class="font-medium">Recomendación: <strong>empieza con Widget Web</strong>.</p>
              <ul class="space-y-1 pl-4 list-disc text-xs">
                <li>Setup en 2 minutos (copia snippet y pega)</li>
                <li>Sin aprobaciones de terceros</li>
                <li>Control total sobre apariencia y comportamiento</li>
                <li>Gratis, sin cuotas mensuales por mensaje</li>
              </ul>
              <p class="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-900 mt-3">
                💡 Después, según tu canal principal de clientes, agrega WhatsApp (LATAM/España) o Instagram (retail/moda).
              </p>
            </div>
          </div>

          <!-- Glosario -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
              @click="toggle('glossary')"
            >
              <span class="font-semibold text-sm text-slate-800">📚 Glosario</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'glossary' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'glossary'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-3 leading-relaxed">
              <div>
                <div class="font-semibold">Canal</div>
                <p class="text-xs text-slate-500">Vía por donde llegan conversaciones (widget, WhatsApp, Telegram, etc.).</p>
              </div>
              <div>
                <div class="font-semibold">Snippet</div>
                <p class="text-xs text-slate-500">Código HTML que pegas en tu sitio para que aparezca el widget.</p>
              </div>
              <div>
                <div class="font-semibold">Channel ID</div>
                <p class="text-xs text-slate-500">Identificador único del canal. Aparece en el código de instalación.</p>
              </div>
              <div>
                <div class="font-semibold">Desactivar vs Eliminar</div>
                <p class="text-xs text-slate-500">Desactivar pausa el canal (conversaciones se conservan). Eliminar lo borra permanentemente (solo canales sin historial).</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
