<!-- Ruta: /src/modules/super-admin/components/CreateOrganizationWizard.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Wizard modal de 4 pasos para crear una nueva organización.
     Sprint 5 · Bloque 6.

     Pasos:
       1. Nombre de la empresa + email del admin inicial
       2. Subdomain (con validación en vivo)
       3. Branding (color + mensaje bienvenida con preview en vivo)
       4. Confirmación → crea y muestra link de invitación
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import SubdomainInput from './SubdomainInput.vue'
import WidgetPreview from './WidgetPreview.vue'
import { SupabaseOrganizationsRepo } from '@/repository/supabase/organizations.repo'
import type {
  CreateOrganizationInput,
  CreateOrganizationResult,
  SubdomainValidation
} from '@/types/organization.types'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', result: CreateOrganizationResult): void
}>()

const repo = new SupabaseOrganizationsRepo()

// ── STATE ─────────────────────────────────────────────────
const step = ref<1 | 2 | 3 | 4 | 5>(1)
const loading = ref(false)
const error = ref<string | null>(null)

// Datos del form
const form = ref<CreateOrganizationInput>({
  name: '',
  subdomain: '',
  primaryColor: '#0071E3',
  adminEmail: '',
  welcomeMessage: '¡Hola! ¿En qué te podemos ayudar?',
  brandName: null,
  logoUrl: null
})

const subdomainValidation = ref<SubdomainValidation>({ status: 'idle', message: '' })

// Resultado después de crear
const result = ref<CreateOrganizationResult | null>(null)
const copiedInvitation = ref(false)
const copiedUrl = ref(false)

// ── VALIDACIONES DE PASO ──────────────────────────────────
const canProceedStep1 = computed(() => {
  if (!form.value.name.trim() || form.value.name.trim().length < 2) return false
  if (form.value.adminEmail && form.value.adminEmail.trim()) {
    const email = form.value.adminEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false
  }
  return true
})

const canProceedStep2 = computed(() => {
  return subdomainValidation.value.status === 'available'
})

const canProceedStep3 = computed(() => {
  return form.value.primaryColor.match(/^#[0-9A-Fa-f]{6}$/) !== null &&
         form.value.welcomeMessage.trim().length > 0
})

// ── NAVEGACIÓN ────────────────────────────────────────────
function next() {
  if (step.value === 1 && !canProceedStep1.value) return
  if (step.value === 2 && !canProceedStep2.value) return
  if (step.value === 3 && !canProceedStep3.value) return
  if (step.value < 4) step.value++ as any
}

function back() {
  if (step.value > 1 && step.value < 5) step.value-- as any
}

function close() {
  if (loading.value) return
  emit('close')
}

// Auto-sugerir subdomain al entrar al paso 2 si está vacío
function autoSuggestSubdomain() {
  if (form.value.subdomain) return
  const suggested = form.value.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30)
  if (suggested.length >= 2) {
    form.value.subdomain = suggested
  }
}

function goToStep2() {
  if (canProceedStep1.value) {
    autoSuggestSubdomain()
    step.value = 2
  }
}

// ── CREACIÓN ──────────────────────────────────────────────
async function createOrg() {
  loading.value = true
  error.value = null

  try {
    const r = await repo.create(form.value)
    result.value = r
    step.value = 5
    emit('created', r)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error desconocido al crear la empresa'
  } finally {
    loading.value = false
  }
}

// ── COPIAR AL PORTAPAPELES ────────────────────────────────
async function copyInvitation() {
  if (!result.value?.invitationUrl) return
  try {
    await navigator.clipboard.writeText(result.value.invitationUrl)
    copiedInvitation.value = true
    setTimeout(() => { copiedInvitation.value = false }, 2000)
  } catch {
    alert('No se pudo copiar automáticamente. Seleccionalo manualmente.')
  }
}

async function copyUrl() {
  if (!result.value?.subdomainUrl) return
  try {
    await navigator.clipboard.writeText(result.value.subdomainUrl)
    copiedUrl.value = true
    setTimeout(() => { copiedUrl.value = false }, 2000)
  } catch {
    alert('No se pudo copiar automáticamente.')
  }
}

function shareWhatsApp() {
  if (!result.value?.invitationUrl) return
  const msg = encodeURIComponent(
    `¡Hola! Te invito a administrar ${form.value.name} en LORA Chat. ` +
    `Usa este link para activar tu cuenta (válido 7 días):\n\n${result.value.invitationUrl}`
  )
  window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener')
}
</script>

<template>
  <!-- Overlay -->
  <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" @click.self="close">
    <!-- Modal -->
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in">
      <!-- Header con stepper -->
      <div class="flex items-center justify-between p-5 border-b border-surface-border">
        <div>
          <h2 class="text-xl font-bold text-slate-900 tracking-tight">
            {{ step === 5 ? '¡Empresa creada! 🎉' : 'Nueva empresa' }}
          </h2>
          <p v-if="step < 5" class="text-xs text-slate-500 mt-0.5">
            Paso {{ step }} de 4
          </p>
        </div>
        <button
          class="w-8 h-8 rounded-full hover:bg-slate-100 grid place-items-center text-slate-500"
          :disabled="loading"
          @click="close"
        >
          ✕
        </button>
      </div>

      <!-- Progress bar (solo pasos 1-4) -->
      <div v-if="step < 5" class="px-5 pt-4">
        <div class="flex gap-1.5">
          <div
            v-for="s in 4"
            :key="s"
            class="h-1 flex-1 rounded-full transition-all duration-300"
            :class="s <= step ? 'bg-brand-600' : 'bg-slate-200'"
          />
        </div>
      </div>

      <!-- Contenido dinámico -->
      <div class="p-5 min-h-[300px]">
        <!-- ══════════════════════════════════════════════════ -->
        <!-- PASO 1: Nombre + Email del admin -->
        <!-- ══════════════════════════════════════════════════ -->
        <div v-if="step === 1" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
              Nombre de la empresa
            </label>
            <input
              v-model="form.name"
              type="text"
              class="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              placeholder="Ej: Capitali"
              maxlength="100"
              autofocus
            />
            <p class="text-xs text-slate-500 mt-1">
              Se mostrará en el panel del cliente y como marca del widget.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
              Email del admin inicial
              <span class="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              v-model="form.adminEmail"
              type="email"
              class="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              placeholder="admin@empresa.com"
              autocomplete="off"
            />
            <p class="text-xs text-slate-500 mt-1">
              Si lo dejas vacío, puedes invitarlo después desde la gestión de usuarios.
            </p>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════ -->
        <!-- PASO 2: Subdomain -->
        <!-- ══════════════════════════════════════════════════ -->
        <div v-if="step === 2" class="space-y-4">
          <div>
            <h3 class="text-sm font-semibold text-slate-900 mb-1">Elige el subdomain</h3>
            <p class="text-xs text-slate-500 mb-3">
              Este será el URL único de la empresa. El admin y su equipo accederán desde ahí.
            </p>
          </div>

          <SubdomainInput
            v-model="form.subdomain"
            @validation="v => subdomainValidation = v"
          />

          <div class="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p><strong>Reglas del subdomain:</strong></p>
            <ul class="list-disc ml-4 space-y-0.5">
              <li>Solo minúsculas, números y guiones</li>
              <li>Entre 2 y 63 caracteres</li>
              <li>No puede empezar ni terminar con guión</li>
              <li>No se puede cambiar después (permanente)</li>
            </ul>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════ -->
        <!-- PASO 3: Branding (color + mensaje) con preview -->
        <!-- ══════════════════════════════════════════════════ -->
        <div v-if="step === 3" class="space-y-4">
          <div>
            <h3 class="text-sm font-semibold text-slate-900 mb-1">Branding del widget</h3>
            <p class="text-xs text-slate-500">
              Estos valores se pueden editar después desde el panel del cliente.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Columna izquierda: controles -->
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Color primario</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    v-model="form.primaryColor"
                    class="w-12 h-10 rounded-lg border border-surface-border cursor-pointer"
                  />
                  <input
                    v-model="form.primaryColor"
                    type="text"
                    class="flex-1 border border-surface-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-500"
                    placeholder="#0071E3"
                    maxlength="7"
                  />
                </div>
                <div class="flex gap-1.5 mt-2">
                  <button
                    v-for="c in ['#0071E3', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#64748B']"
                    :key="c"
                    :style="{ background: c }"
                    class="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
                    :class="form.primaryColor === c ? 'ring-2 ring-slate-400' : ''"
                    :title="c"
                    @click="form.primaryColor = c"
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">
                  Mensaje de bienvenida
                </label>
                <textarea
                  v-model="form.welcomeMessage"
                  rows="3"
                  class="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-none"
                  placeholder="¡Hola! ¿En qué te podemos ayudar?"
                  maxlength="200"
                />
                <p class="text-xs text-slate-400 mt-1 text-right">
                  {{ form.welcomeMessage.length }}/200
                </p>
              </div>
            </div>

            <!-- Columna derecha: preview en vivo -->
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">
                Vista previa del widget
              </label>
              <WidgetPreview
                :primary-color="form.primaryColor"
                :brand-name="form.name"
                :welcome-message="form.welcomeMessage"
              />
            </div>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════ -->
        <!-- PASO 4: Confirmación -->
        <!-- ══════════════════════════════════════════════════ -->
        <div v-if="step === 4" class="space-y-4">
          <div>
            <h3 class="text-sm font-semibold text-slate-900 mb-1">Confirmar creación</h3>
            <p class="text-xs text-slate-500">
              Revisa los datos antes de crear la empresa.
            </p>
          </div>

          <div class="border border-surface-border rounded-lg divide-y divide-surface-border">
            <div class="px-4 py-3 flex justify-between items-center">
              <span class="text-xs font-medium text-slate-500">Empresa</span>
              <span class="text-sm text-slate-900 font-medium">{{ form.name }}</span>
            </div>
            <div class="px-4 py-3 flex justify-between items-center">
              <span class="text-xs font-medium text-slate-500">URL</span>
              <code class="text-sm text-brand-600 font-mono">
                https://{{ form.subdomain }}.lorachat.net
              </code>
            </div>
            <div class="px-4 py-3 flex justify-between items-center">
              <span class="text-xs font-medium text-slate-500">Color primario</span>
              <div class="flex items-center gap-2">
                <div :style="{ background: form.primaryColor }" class="w-5 h-5 rounded border border-surface-border"></div>
                <code class="text-sm font-mono text-slate-700">{{ form.primaryColor }}</code>
              </div>
            </div>
            <div class="px-4 py-3 flex justify-between items-center">
              <span class="text-xs font-medium text-slate-500">Admin inicial</span>
              <span class="text-sm text-slate-900">
                {{ form.adminEmail || 'Sin invitación automática' }}
              </span>
            </div>
          </div>

          <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
            <p class="font-semibold mb-1">📌 Qué se creará automáticamente:</p>
            <ul class="list-disc ml-4 space-y-0.5">
              <li>La organización con su subdomain</li>
              <li>Un canal "Widget Web" con configuración inicial</li>
              <li>El rol "admin" con permisos completos para esta empresa</li>
              <li v-if="form.adminEmail">Una invitación válida por 7 días para el admin</li>
            </ul>
          </div>

          <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {{ error }}
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════ -->
        <!-- PASO 5: Resultado con links -->
        <!-- ══════════════════════════════════════════════════ -->
        <div v-if="step === 5 && result" class="space-y-5">
          <div class="text-center py-2">
            <div class="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 grid place-items-center text-3xl mb-3">
              ✓
            </div>
            <p class="text-slate-600 text-sm">
              <strong class="text-slate-900">{{ form.name }}</strong> está lista para usarse.
            </p>
          </div>

          <!-- URL del subdomain -->
          <div>
            <label class="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              URL del panel
            </label>
            <div class="flex gap-2">
              <code class="flex-1 bg-slate-50 border border-surface-border rounded-lg px-3 py-2 text-sm font-mono text-brand-600 truncate">
                {{ result.subdomainUrl }}
              </code>
              <button
                class="px-3 py-2 text-xs rounded-lg transition-colors"
                :class="copiedUrl ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
                @click="copyUrl"
              >
                {{ copiedUrl ? '✓ Copiado' : 'Copiar' }}
              </button>
            </div>
          </div>

          <!-- Link de invitación (si hay) -->
          <div v-if="result.invitationUrl">
            <label class="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Link de invitación del admin
            </label>
            <div class="bg-brand-50 border border-brand-200 rounded-lg p-3 space-y-2">
              <div class="text-xs text-brand-900 font-mono break-all select-all leading-relaxed">
                {{ result.invitationUrl }}
              </div>
              <div class="flex gap-2">
                <button
                  class="flex-1 px-3 py-2 text-xs rounded-lg transition-colors"
                  :class="copiedInvitation ? 'bg-emerald-600 text-white' : 'bg-brand-600 hover:bg-brand-700 text-white'"
                  @click="copyInvitation"
                >
                  {{ copiedInvitation ? '✓ Copiado' : '📋 Copiar link' }}
                </button>
                <button
                  class="px-3 py-2 text-xs rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white transition-colors"
                  @click="shareWhatsApp"
                >
                  📱 WhatsApp
                </button>
              </div>
            </div>
            <p class="text-xs text-slate-500 mt-2">
              ⚠️ Este link expira en <strong>7 días</strong>. Guárdalo o cópialo ahora.
            </p>
          </div>

          <div v-else class="bg-slate-50 border border-surface-border rounded-lg p-3 text-xs text-slate-600">
            No se generó invitación automática. Puedes invitar admins desde el panel
            cuando accedas a <code class="text-brand-600">{{ result.subdomainUrl }}</code>.
          </div>
        </div>
      </div>

      <!-- Footer con botones -->
      <div class="px-5 py-4 border-t border-surface-border bg-slate-50 flex justify-between items-center gap-2">
        <div class="text-xs text-slate-500">
          <span v-if="step < 5">Los datos no se guardan hasta crear la empresa.</span>
        </div>

        <div class="flex gap-2">
          <!-- Paso 1 -->
          <template v-if="step === 1">
            <button class="btn-secondary text-sm" @click="close">Cancelar</button>
            <button
              class="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg disabled:opacity-50 hover:bg-brand-700 transition-colors"
              :disabled="!canProceedStep1"
              @click="goToStep2"
            >
              Siguiente →
            </button>
          </template>

          <!-- Pasos 2-3 -->
          <template v-if="step === 2 || step === 3">
            <button class="btn-secondary text-sm" @click="back">← Atrás</button>
            <button
              class="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg disabled:opacity-50 hover:bg-brand-700 transition-colors"
              :disabled="(step === 2 && !canProceedStep2) || (step === 3 && !canProceedStep3)"
              @click="next"
            >
              Siguiente →
            </button>
          </template>

          <!-- Paso 4 (confirmación) -->
          <template v-if="step === 4">
            <button class="btn-secondary text-sm" :disabled="loading" @click="back">← Atrás</button>
            <button
              class="px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg disabled:opacity-50 hover:bg-emerald-700 transition-colors font-medium"
              :disabled="loading"
              @click="createOrg"
            >
              {{ loading ? 'Creando...' : '✨ Crear empresa' }}
            </button>
          </template>

          <!-- Paso 5 (resultado) -->
          <template v-if="step === 5">
            <button
              class="px-5 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
              @click="close"
            >
              Listo
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-in {
  animation: modal-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes modal-in {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.btn-secondary {
  padding: 8px 14px;
  border-radius: 8px;
  background: white;
  color: #475569;
  border: 1px solid #e2e8f0;
  transition: background 0.15s;
}
.btn-secondary:hover:not(:disabled) {
  background: #f8fafc;
}
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
