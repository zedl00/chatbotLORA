<!-- Ruta: /src/modules/settings/views/BrandingView.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 7: Editor de branding per-tenant.

     FIX: uiStore usa showToast(type, message) no toast({type, message})

     Permite a admins de empresa editar:
       - Color primario
       - Logo (upload a Supabase Storage)
       - Nombre de marca (brand_name)
       - Mensaje de bienvenida del widget
       - Mensaje fuera de línea del widget

     Cambios se persisten en:
       - organizations (brand_name, primary_color, logo_url, logo_full_url)
       - widget_configs del canal default

     Solo accesible con permiso 'settings.update'.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useOrganizationStore } from '@/stores/organization.store'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { useSupportMode } from '@/composables/useSupportMode'
import { SupabaseOrganizationsRepo } from '@/repository/supabase/organizations.repo'
import { supabase } from '@/services/supabase.client'
import LogoUploader from '../components/LogoUploader.vue'

const orgStore = useOrganizationStore()
const authStore = useAuthStore()
const uiStore = useUiStore()
const { isSupportMode, supportingOrgName, logSupportAction } = useSupportMode()
const repo = new SupabaseOrganizationsRepo()

// Determinar qué organización se está editando
const targetOrgId = computed(() => {
  if (isSupportMode.value && orgStore.current) {
    return orgStore.current.id
  }
  return authStore.user?.organizationId ?? orgStore.current?.id ?? null
})

// ─── Estado del formulario ───
const form = reactive({
  brandName: '',
  primaryColor: '#0071E3',
  logoUrl: null as string | null,
  welcomeTitle: '¡Hola! 👋',
  welcomeSubtitle: 'Estamos aquí para ayudarte',
  offlineMessage: 'Estamos fuera de línea. Te responderemos pronto.'
})

const initialState = ref<typeof form | null>(null)
const loading = ref(true)
const saving = ref(false)
const activeTab = ref<'brand' | 'widget'>('brand')

const hasChanges = computed(() => {
  if (!initialState.value) return false
  return (
    form.brandName !== initialState.value.brandName ||
    form.primaryColor !== initialState.value.primaryColor ||
    form.logoUrl !== initialState.value.logoUrl ||
    form.welcomeTitle !== initialState.value.welcomeTitle ||
    form.welcomeSubtitle !== initialState.value.welcomeSubtitle ||
    form.offlineMessage !== initialState.value.offlineMessage
  )
})

// ─── Cargar datos actuales ───
async function loadBranding() {
  if (!targetOrgId.value) {
    uiStore.showToast('error', 'No se pudo identificar la empresa')
    return
  }

  loading.value = true
  try {
    // 1. Cargar organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name, brand_name, primary_color, logo_url, logo_full_url')
      .eq('id', targetOrgId.value)
      .maybeSingle()

    if (orgError) throw orgError
    if (!org) throw new Error('Organización no encontrada')

    form.brandName = org.brand_name ?? org.name ?? ''
    form.primaryColor = org.primary_color ?? '#0071E3'
    form.logoUrl = org.logo_full_url ?? org.logo_url ?? null

    // 2. Cargar widget_config del canal default
    const { data: widgetCfg } = await supabase
      .from('widget_configs')
      .select('welcome_title, welcome_subtitle, offline_message')
      .eq('organization_id', targetOrgId.value)
      .maybeSingle()

    if (widgetCfg) {
      form.welcomeTitle = widgetCfg.welcome_title ?? '¡Hola! 👋'
      form.welcomeSubtitle = widgetCfg.welcome_subtitle ?? 'Estamos aquí para ayudarte'
      form.offlineMessage = widgetCfg.offline_message ?? 'Estamos fuera de línea. Te responderemos pronto.'
    }

    // Guardar estado inicial para detectar cambios
    initialState.value = { ...form }
  } catch (e) {
    uiStore.showToast(
      'error',
      e instanceof Error ? e.message : 'Error cargando branding'
    )
  } finally {
    loading.value = false
  }
}

// ─── Guardar ───
async function saveBranding() {
  if (!targetOrgId.value) return

  saving.value = true
  try {
    // Actualizar organization
    await repo.updateBranding(targetOrgId.value, {
      brandName: form.brandName.trim() || null,
      primaryColor: form.primaryColor,
      logoUrl: form.logoUrl,
      logoFullUrl: form.logoUrl
    })

    // Actualizar widget_config
    const { error: widgetError } = await supabase
      .from('widget_configs')
      .update({
        welcome_title: form.welcomeTitle,
        welcome_subtitle: form.welcomeSubtitle,
        offline_message: form.offlineMessage,
        primary_color: form.primaryColor,
        logo_url: form.logoUrl,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', targetOrgId.value)

    if (widgetError) throw widgetError

    // Log de auditoría si estamos en modo soporte
    if (isSupportMode.value) {
      await logSupportAction('branding.update', {
        entityType: 'organization',
        entityId: targetOrgId.value,
        details: {
          brandName: form.brandName,
          primaryColor: form.primaryColor
        }
      })
    }

    // Actualizar el store local para que el branding se vea de inmediato
    if (orgStore.current && orgStore.current.id === targetOrgId.value) {
      orgStore.current.brandName = form.brandName.trim() || null
      orgStore.current.primaryColor = form.primaryColor
      orgStore.current.logoUrl = form.logoUrl
      orgStore.current.logoFullUrl = form.logoUrl
      orgStore.applyBrandingToDOM()
    }

    initialState.value = { ...form }
    uiStore.showToast('success', '✓ Branding guardado correctamente')
  } catch (e) {
    uiStore.showToast(
      'error',
      e instanceof Error ? e.message : 'Error al guardar'
    )
  } finally {
    saving.value = false
  }
}

function resetForm() {
  if (!initialState.value) return
  Object.assign(form, initialState.value)
}

function handleLogoError(msg: string) {
  uiStore.showToast('error', msg)
}

onMounted(loadBranding)
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">🎨 Branding</h1>
        <p class="text-slate-500 mt-1">
          Personaliza cómo se ve tu empresa en el panel y en el widget de chat.
        </p>
      </div>
      <div v-if="isSupportMode" class="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2 rounded-lg">
        Editando como super_admin: <strong>{{ supportingOrgName }}</strong>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-slate-500">
      Cargando branding actual...
    </div>

    <!-- Form -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Columna izquierda: formulario -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Tabs -->
        <div class="flex gap-2 border-b border-slate-200">
          <button
            class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
            :class="activeTab === 'brand'
              ? 'border-brand-500 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'"
            @click="activeTab = 'brand'"
          >
            Identidad de marca
          </button>
          <button
            class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
            :class="activeTab === 'widget'
              ? 'border-brand-500 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'"
            @click="activeTab = 'widget'"
          >
            Mensajes del widget
          </button>
        </div>

        <!-- Tab: Identidad de marca -->
        <div v-if="activeTab === 'brand'" class="space-y-5">
          <!-- Logo -->
          <div class="card p-5">
            <label class="block text-sm font-semibold text-slate-700 mb-3">
              Logo de la empresa
            </label>
            <LogoUploader
              v-model="form.logoUrl"
              :org-id="targetOrgId!"
              @error="handleLogoError"
            />
            <p class="text-xs text-slate-500 mt-2">
              Se muestra en el sidebar del panel y en el widget (si está configurado).
            </p>
          </div>

          <!-- Nombre de marca -->
          <div class="card p-5">
            <label class="block text-sm font-semibold text-slate-700 mb-2">
              Nombre de marca (brand name)
            </label>
            <input
              v-model="form.brandName"
              type="text"
              class="input"
              placeholder="Mi Empresa S.A."
              maxlength="60"
            />
            <p class="text-xs text-slate-500 mt-1">
              Aparece en el sidebar y en la pestaña del navegador.
            </p>
          </div>

          <!-- Color primario -->
          <div class="card p-5">
            <label class="block text-sm font-semibold text-slate-700 mb-3">
              Color primario
            </label>
            <div class="flex items-center gap-3">
              <input
                v-model="form.primaryColor"
                type="color"
                class="w-16 h-12 rounded-lg cursor-pointer border border-slate-200"
              />
              <input
                v-model="form.primaryColor"
                type="text"
                class="input flex-1 font-mono"
                placeholder="#0071E3"
                pattern="^#([A-Fa-f0-9]{6})$"
              />
            </div>
            <p class="text-xs text-slate-500 mt-2">
              Se usa para botones, enlaces y el header del widget.
            </p>
          </div>
        </div>

        <!-- Tab: Widget -->
        <div v-if="activeTab === 'widget'" class="space-y-5">
          <div class="card p-5">
            <label class="block text-sm font-semibold text-slate-700 mb-2">
              Título de bienvenida
            </label>
            <input
              v-model="form.welcomeTitle"
              type="text"
              class="input"
              placeholder="¡Hola! 👋"
              maxlength="80"
            />
            <p class="text-xs text-slate-500 mt-1">
              Aparece arriba del formulario cuando un visitante abre el widget.
            </p>
          </div>

          <div class="card p-5">
            <label class="block text-sm font-semibold text-slate-700 mb-2">
              Subtítulo de bienvenida
            </label>
            <input
              v-model="form.welcomeSubtitle"
              type="text"
              class="input"
              placeholder="Estamos aquí para ayudarte"
              maxlength="120"
            />
          </div>

          <div class="card p-5">
            <label class="block text-sm font-semibold text-slate-700 mb-2">
              Mensaje fuera de línea
            </label>
            <textarea
              v-model="form.offlineMessage"
              class="input min-h-[80px]"
              placeholder="Estamos fuera de línea. Te responderemos pronto."
              maxlength="200"
            />
            <p class="text-xs text-slate-500 mt-1">
              Se muestra cuando no hay agentes disponibles.
            </p>
          </div>
        </div>

        <!-- Acciones -->
        <div v-if="hasChanges" class="flex items-center justify-end gap-3 sticky bottom-0 bg-white p-4 rounded-xl border border-slate-200 shadow-lg">
          <span class="text-sm text-slate-500 flex-1">
            Tienes cambios sin guardar
          </span>
          <button
            type="button"
            class="btn-secondary"
            :disabled="saving"
            @click="resetForm"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn-primary"
            :disabled="saving"
            @click="saveBranding"
          >
            {{ saving ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>
      </div>

      <!-- Columna derecha: preview del widget -->
      <div class="lg:col-span-1">
        <div class="sticky top-4">
          <h3 class="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
            Preview
          </h3>

          <!-- Widget preview -->
          <div
            class="rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white"
            style="max-width: 340px; margin: 0 auto;"
          >
            <!-- Header del widget -->
            <div
              class="p-4 text-white"
              :style="{ background: form.primaryColor }"
            >
              <div class="flex items-center gap-3">
                <img
                  v-if="form.logoUrl"
                  :src="form.logoUrl"
                  alt="Logo"
                  class="w-10 h-10 rounded-lg bg-white/20 object-contain p-1"
                />
                <div
                  v-else
                  class="w-10 h-10 rounded-lg bg-white/20 grid place-items-center text-xl font-bold"
                >
                  {{ form.brandName.charAt(0).toUpperCase() || '💬' }}
                </div>
                <div>
                  <div class="font-semibold">{{ form.brandName || 'Tu empresa' }}</div>
                  <div class="text-xs opacity-80">En línea</div>
                </div>
              </div>
            </div>

            <!-- Body del widget -->
            <div class="p-4 space-y-3 bg-slate-50 min-h-[200px]">
              <div class="text-center py-3">
                <div class="text-xl font-bold text-slate-900">
                  {{ form.welcomeTitle }}
                </div>
                <div class="text-sm text-slate-600 mt-1">
                  {{ form.welcomeSubtitle }}
                </div>
              </div>

              <!-- Mensaje de ejemplo -->
              <div class="bg-white p-3 rounded-xl shadow-sm max-w-[80%]">
                <div class="text-xs font-medium mb-1" :style="{ color: form.primaryColor }">
                  Bot
                </div>
                <div class="text-sm text-slate-700">
                  ¿En qué puedo ayudarte hoy?
                </div>
              </div>
            </div>

            <!-- Footer con input -->
            <div class="p-3 border-t border-slate-200 flex gap-2 bg-white">
              <input
                type="text"
                class="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
                placeholder="Escribe un mensaje..."
                disabled
              />
              <button
                class="px-4 py-2 rounded-lg text-white text-sm font-medium"
                :style="{ background: form.primaryColor }"
              >
                →
              </button>
            </div>
          </div>

          <p class="text-xs text-slate-500 text-center mt-3">
            Así se verá el widget en tu sitio web
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
