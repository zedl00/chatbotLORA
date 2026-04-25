<!-- Ruta: /src/modules/super-admin/components/help/SystemConfigHelpPanel.vue -->
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
            Guía: Config del Sistema
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
              <span class="font-semibold text-sm text-slate-800">🔧 ¿Qué controla esta pantalla?</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'what' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'what'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <p>Aquí se configuran los <strong>parámetros globales</strong> de LORA que aplican a toda la plataforma y a todos los tenants (empresas clientes).</p>
              <p>Ejemplos:</p>
              <ul class="space-y-1 pl-4 list-disc text-xs">
                <li>URL oficial del panel admin</li>
                <li>URL del widget.js embebible</li>
                <li>Email y URL de soporte</li>
                <li>Nombre de marca y tagline</li>
                <li>Límites del sistema (rate limits, cuotas)</li>
              </ul>
              <p class="text-xs text-slate-500 italic mt-2">Solo usuarios con rol <strong>super_admin</strong> pueden acceder a esta pantalla.</p>
            </div>
          </div>

          <!-- Público vs Privado -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
              @click="toggle('public')"
            >
              <span class="font-semibold text-sm text-slate-800">🔓 "Público" vs "Privado"</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'public' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'public'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <div class="bg-white rounded-lg p-3 border border-emerald-200">
                <div class="font-semibold text-emerald-800">🟢 Público</div>
                <p class="text-xs text-slate-600 mt-1">Accesible sin autenticación. El widget.js en los sitios de clientes puede leerlo.</p>
                <p class="text-xs text-slate-500 mt-1 italic">Ejemplo: <code>widget_url</code>, <code>brand_name</code>, <code>support_email</code>.</p>
              </div>
              <div class="bg-white rounded-lg p-3 border border-slate-200 mt-2">
                <div class="font-semibold text-slate-700">🔒 Privado</div>
                <p class="text-xs text-slate-600 mt-1">Solo visible para usuarios autenticados del panel admin. Nunca se expone al widget.</p>
                <p class="text-xs text-slate-500 mt-1 italic">Ejemplo: <code>admin_url</code> (no necesita estar en el widget).</p>
              </div>
              <p class="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 mt-3">
                ⚠️ <strong>Nunca pongas credenciales (API keys, tokens) con is_public = true.</strong>
              </p>
            </div>
          </div>

          <!-- Tipos de valor -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
              @click="toggle('types')"
            >
              <span class="font-semibold text-sm text-slate-800">📝 Tipos de valor</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'types' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'types'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <div class="space-y-2">
                <div class="bg-white rounded-lg p-2.5 border border-surface-border">
                  <strong>string:</strong> texto libre (nombres, taglines)
                </div>
                <div class="bg-white rounded-lg p-2.5 border border-surface-border">
                  <strong>url:</strong> URL válida con http/https
                </div>
                <div class="bg-white rounded-lg p-2.5 border border-surface-border">
                  <strong>email:</strong> dirección de email
                </div>
                <div class="bg-white rounded-lg p-2.5 border border-surface-border">
                  <strong>number:</strong> valor numérico (límites, timeouts)
                </div>
                <div class="bg-white rounded-lg p-2.5 border border-surface-border">
                  <strong>boolean:</strong> true / false (features flags)
                </div>
                <div class="bg-white rounded-lg p-2.5 border border-surface-border">
                  <strong>json:</strong> estructura compleja (arrays, objetos)
                </div>
              </div>
            </div>
          </div>

          <!-- Cambios y propagación -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
              @click="toggle('propagation')"
            >
              <span class="font-semibold text-sm text-slate-800">⏱️ ¿Cuándo se aplican los cambios?</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'propagation' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'propagation'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <p class="font-medium">La propagación tiene 3 niveles:</p>
              <div class="space-y-2">
                <div class="bg-white rounded-lg p-3 border border-surface-border">
                  <div class="font-semibold text-slate-800">1. Panel admin: instantáneo</div>
                  <p class="text-xs text-slate-500 mt-1">Otras pantallas abiertas ven los cambios al recargar.</p>
                </div>
                <div class="bg-white rounded-lg p-3 border border-surface-border">
                  <div class="font-semibold text-slate-800">2. Widget.js en sitios de clientes: hasta 5 min</div>
                  <p class="text-xs text-slate-500 mt-1">Por el cache HTTP. Los widgets ya cargados usan los valores viejos hasta la siguiente carga.</p>
                </div>
                <div class="bg-white rounded-lg p-3 border border-surface-border">
                  <div class="font-semibold text-slate-800">3. Cambios que requieren rebuild: nunca automáticos</div>
                  <p class="text-xs text-slate-500 mt-1">Si cambias una URL hardcodeada en código, necesitas rebuild + deploy.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Restaurar -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
              @click="toggle('reset')"
            >
              <span class="font-semibold text-sm text-slate-800">🔄 Botón "Restaurar default"</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'reset' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'reset'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-2 leading-relaxed">
              <p>Cada config tiene un <strong>valor por defecto</strong> definido en la migración SQL original.</p>
              <p>El botón 🔄 te devuelve a ese valor, útil si:</p>
              <ul class="space-y-1 pl-4 list-disc text-xs">
                <li>Pusiste un valor incorrecto por error</li>
                <li>Quieres volver al "estado de fábrica"</li>
                <li>El valor se corrompió</li>
              </ul>
              <p class="text-xs text-slate-500 italic mt-2">El botón solo aparece si la config tiene default_value definido en la DB.</p>
            </div>
          </div>

          <!-- Glosario -->
          <div class="rounded-xl border border-surface-border overflow-hidden">
            <button
              class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
              @click="toggle('glossary')"
            >
              <span class="font-semibold text-sm text-slate-800">📚 Glosario de claves</span>
              <span class="text-slate-400 text-xs">{{ activeSection === 'glossary' ? '▲' : '▼' }}</span>
            </button>
            <div v-if="activeSection === 'glossary'" class="px-4 py-3 bg-slate-50 text-sm text-slate-700 space-y-3 leading-relaxed">
              <div>
                <code class="font-semibold">admin_url</code>
                <p class="text-xs text-slate-500">URL donde está hospedado el panel administrativo.</p>
              </div>
              <div>
                <code class="font-semibold">widget_url</code>
                <p class="text-xs text-slate-500">URL pública del widget.js que se instala en sitios de clientes.</p>
              </div>
              <div>
                <code class="font-semibold">api_url</code>
                <p class="text-xs text-slate-500">URL base del API de Supabase. Usada por el widget y backend.</p>
              </div>
              <div>
                <code class="font-semibold">brand_name</code>
                <p class="text-xs text-slate-500">Nombre del producto que ve el usuario final.</p>
              </div>
              <div>
                <code class="font-semibold">support_email / support_url</code>
                <p class="text-xs text-slate-500">Canales oficiales de soporte al cliente.</p>
              </div>
              <div>
                <code class="font-semibold">landing_url</code>
                <p class="text-xs text-slate-500">URL del sitio comercial/marketing.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
