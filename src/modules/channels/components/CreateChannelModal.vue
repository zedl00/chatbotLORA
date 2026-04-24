<!-- Ruta: /src/modules/channels/components/CreateChannelModal.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { useUiStore } from '@/stores/ui.store'
import { SupabaseChannelsRepo } from '@/repository/supabase/channels.repo'
import type { ChannelType } from '@/types/channel.types'
import { CHANNEL_TYPES, getChannelMetadata } from '@/types/channel.types'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'created'): void
}>()

const activeOrgId = useActiveOrganizationId()
const ui = useUiStore()
const router = useRouter()
const repo = new SupabaseChannelsRepo()

const step = ref<1 | 2 | 3>(1)
const selectedType = ref<ChannelType | null>(null)
const channelName = ref('')
const creating = ref(false)
const createdChannelId = ref<string | null>(null)

// Reset cuando se cierra
watch(() => props.modelValue, (v) => {
  if (!v) {
    setTimeout(() => {
      step.value = 1
      selectedType.value = null
      channelName.value = ''
      creating.value = false
      createdChannelId.value = null
    }, 300)
  }
})

function close() {
  if (creating.value) return
  emit('update:modelValue', false)
}

function selectType(type: ChannelType) {
  const meta = getChannelMetadata(type)
  if (!meta.available) {
    ui.showToast('info', `${meta.label} estará disponible en ${meta.availableAt}`)
    return
  }
  selectedType.value = type
  // Pre-rellenar nombre con sugerencia
  channelName.value = `Widget principal`
  step.value = 2
}

async function createChannel() {
  if (!activeOrgId.value || !selectedType.value || !channelName.value.trim()) return

  creating.value = true
  try {
    const channel = await repo.create(activeOrgId.value, {
      type: selectedType.value,
      name: channelName.value.trim()
    })
    createdChannelId.value = channel.id
    step.value = 3
    emit('created')
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error creando canal')
    creating.value = false
  } finally {
    creating.value = false
  }
}

function goToConfig() {
  if (createdChannelId.value) {
    emit('update:modelValue', false)
    router.push(`/admin/channels/widget/${createdChannelId.value}`)
  }
}

function finish() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-slate-900/50 z-40 flex items-center justify-center p-4"
        @click.self="close"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-surface-border flex items-center justify-between">
            <div>
              <h3 class="font-bold text-slate-800">
                {{ step === 1 ? 'Crear canal nuevo' : step === 2 ? 'Configurar' : '¡Canal creado!' }}
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">
                Paso {{ step }} de 3
              </p>
            </div>
            <button
              class="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 grid place-items-center"
              :disabled="creating"
              @click="close"
            >
              ✕
            </button>
          </div>

          <!-- Progress bar -->
          <div class="h-1 bg-slate-100">
            <div
              class="h-full bg-brand-500 transition-all duration-300"
              :style="{ width: `${(step / 3) * 100}%` }"
            />
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-auto p-6">
            <!-- STEP 1: Tipo de canal -->
            <div v-if="step === 1">
              <h4 class="text-lg font-semibold text-slate-800 mb-1">¿Qué tipo de canal?</h4>
              <p class="text-sm text-slate-500 mb-5">Elige por dónde recibirás las conversaciones</p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  v-for="meta in CHANNEL_TYPES"
                  :key="meta.type"
                  class="text-left p-4 rounded-xl border-2 transition-all relative"
                  :class="meta.available
                    ? 'border-surface-border hover:border-brand-400 hover:bg-brand-50/30'
                    : 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-75'"
                  :disabled="!meta.available"
                  @click="selectType(meta.type)"
                >
                  <div class="flex items-start gap-3">
                    <div
                      class="w-10 h-10 rounded-lg grid place-items-center text-xl flex-shrink-0"
                      :style="{ backgroundColor: `${meta.color}15`, color: meta.color }"
                    >
                      {{ meta.icon }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-semibold text-slate-800 text-sm">{{ meta.label }}</span>
                        <span
                          v-if="!meta.available"
                          class="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold uppercase"
                        >
                          {{ meta.availableAt }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-500 mt-0.5">{{ meta.tagline }}</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <!-- STEP 2: Nombre -->
            <div v-else-if="step === 2 && selectedType">
              <h4 class="text-lg font-semibold text-slate-800 mb-1">Ponle un nombre</h4>
              <p class="text-sm text-slate-500 mb-5">
                Ejemplos: "Widget principal", "Landing ventas", "Blog", "Checkout"
              </p>

              <div class="flex items-center gap-3 p-4 bg-slate-50 rounded-xl mb-4">
                <div
                  class="w-10 h-10 rounded-lg grid place-items-center text-xl"
                  :style="{
                    backgroundColor: `${getChannelMetadata(selectedType).color}15`,
                    color: getChannelMetadata(selectedType).color
                  }"
                >
                  {{ getChannelMetadata(selectedType).icon }}
                </div>
                <div>
                  <div class="font-semibold text-sm">{{ getChannelMetadata(selectedType).label }}</div>
                  <div class="text-xs text-slate-500">{{ getChannelMetadata(selectedType).tagline }}</div>
                </div>
              </div>

              <label class="block text-sm font-medium text-slate-800 mb-1">
                Nombre del canal <span class="text-red-500">*</span>
              </label>
              <input
                v-model="channelName"
                type="text"
                class="input"
                placeholder="Widget principal"
                autofocus
                @keydown.enter="channelName.trim() && createChannel()"
              />
              <p class="text-xs text-slate-500 mt-1">Este nombre es solo para ti, los clientes no lo ven.</p>

              <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-4">
                <div class="text-xs text-blue-800 leading-relaxed">
                  <strong class="block mb-1">💡 Siguiente paso:</strong>
                  Después de crear, te llevamos a la configuración completa donde ajustas colores, pre-chat, post-chat y obtienes el código de instalación.
                </div>
              </div>
            </div>

            <!-- STEP 3: Éxito -->
            <div v-else-if="step === 3" class="text-center py-6">
              <div class="text-6xl mb-4">🎉</div>
              <h4 class="text-xl font-bold text-slate-800 mb-2">¡Canal creado!</h4>
              <p class="text-sm text-slate-600 mb-6">
                "<strong>{{ channelName }}</strong>" está activo y listo para configurar.
              </p>

              <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 text-left">
                <h5 class="font-semibold text-emerald-900 text-sm mb-2">✓ Próximos pasos recomendados:</h5>
                <ol class="text-xs text-emerald-800 space-y-1 pl-4 list-decimal">
                  <li>Configura apariencia (color, logo)</li>
                  <li>Activa pre-chat si necesitas capturar leads</li>
                  <li>Copia el snippet y pégalo en tu sitio</li>
                  <li>Prueba desde tu sitio o CodePen</li>
                </ol>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div v-if="step === 2" class="px-6 py-4 border-t border-surface-border flex justify-between gap-3">
            <button
              class="px-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
              :disabled="creating"
              @click="step = 1"
            >
              ← Atrás
            </button>
            <button
              class="btn-primary"
              :disabled="!channelName.trim() || creating"
              @click="createChannel"
            >
              {{ creating ? 'Creando...' : 'Crear canal' }}
            </button>
          </div>

          <div v-else-if="step === 3" class="px-6 py-4 border-t border-surface-border flex justify-end gap-3">
            <button
              class="px-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
              @click="finish"
            >
              Cerrar
            </button>
            <button
              class="btn-primary"
              @click="goToConfig"
            >
              Configurar ahora →
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
