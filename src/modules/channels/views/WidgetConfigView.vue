<!-- Ruta: /src/modules/channels/views/WidgetConfigView.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 11 · Configuración completa de un widget web
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui.store'
import { SupabaseWidgetConfigRepo } from '@/repository/supabase/widget-config.repo'
import type { WidgetChannel, WidgetSettings } from '@/types/widget.types'
import { mergeWidgetSettings } from '@/types/widget.types'
import WidgetAppearanceTab from '../components/widget-config/WidgetAppearanceTab.vue'
import WidgetPreChatTab from '../components/widget-config/WidgetPreChatTab.vue'
import WidgetPostChatTab from '../components/widget-config/WidgetPostChatTab.vue'
import WidgetInstallationTab from '../components/widget-config/WidgetInstallationTab.vue'
import WidgetConfigHelpPanel from '../components/widget-config/help/WidgetConfigHelpPanel.vue'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const repo = new SupabaseWidgetConfigRepo()

const widgetId = computed(() => route.params.id as string)

const widget = ref<WidgetChannel | null>(null)
const localSettings = ref<WidgetSettings | null>(null)
const loading = ref(false)
const saving = ref(false)
const isDirty = ref(false)

const activeTab = ref<'appearance' | 'prechat' | 'postchat' | 'install'>('appearance')
const helpOpen = ref(false)

// ── Cargar widget ──
async function load() {
  if (!widgetId.value) return
  loading.value = true
  try {
    const w = await repo.getWidget(widgetId.value)
    if (!w) {
      ui.showToast('error', 'Widget no encontrado')
      router.push('/admin/channels')
      return
    }
    widget.value = w
    localSettings.value = mergeWidgetSettings(w.settings)
    isDirty.value = false
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error cargando widget')
  } finally {
    loading.value = false
  }
}

// Marca dirty cuando cambian los settings locales
watch(localSettings, () => {
  if (!loading.value) isDirty.value = true
}, { deep: true })

async function save() {
  if (!widget.value || !localSettings.value) return
  saving.value = true
  try {
    const updated = await repo.updateSettings(widget.value.id, localSettings.value)
    widget.value = updated
    localSettings.value = mergeWidgetSettings(updated.settings)
    isDirty.value = false
    ui.showToast('success', 'Configuración guardada')
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error al guardar')
  } finally {
    saving.value = false
  }
}

function discard() {
  if (!widget.value) return
  if (!confirm('¿Descartar cambios no guardados?')) return
  localSettings.value = mergeWidgetSettings(widget.value.settings)
  isDirty.value = false
}

onMounted(load)

// Warning al salir con cambios sin guardar
window.addEventListener('beforeunload', (e) => {
  if (isDirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
})
</script>

<template>
  <div class="p-6 max-w-[1100px] mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <button
          class="text-sm text-slate-500 hover:text-slate-800"
          @click="router.push('/admin/channels')"
        >
          ← Canales
        </button>
        <div>
          <h2 class="text-xl font-bold">
            {{ widget?.name ?? 'Cargando...' }}
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Widget web · ID <code class="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{{ widgetId }}</code>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          @click="helpOpen = true"
        >
          💡 Guía
        </button>
        <button
          v-if="isDirty"
          class="px-3 py-1.5 text-sm rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
          @click="discard"
        >
          Descartar
        </button>
        <button
          class="btn-primary !py-1.5 flex items-center gap-2"
          :disabled="!isDirty || saving"
          @click="save"
        >
          <span v-if="saving">Guardando...</span>
          <template v-else>
            <span>{{ isDirty ? 'Guardar cambios' : '✓ Guardado' }}</span>
          </template>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="card p-12 text-center text-slate-400">
      Cargando configuración...
    </div>

    <template v-else-if="widget && localSettings">
      <!-- Tabs -->
      <div class="border-b border-surface-border mb-5 flex gap-1 overflow-x-auto">
        <button
          v-for="tab in [
            { id: 'appearance', label: '🎨 Apariencia' },
            { id: 'prechat',    label: '📝 Pre-chat' },
            { id: 'postchat',   label: '⭐ Post-chat' },
            { id: 'install',    label: '📋 Instalación' }
          ]"
          :key="tab.id"
          class="px-4 py-2.5 text-sm transition-colors border-b-2 whitespace-nowrap"
          :class="activeTab === tab.id
            ? 'border-brand-500 text-brand-700 font-medium'
            : 'border-transparent text-slate-500 hover:text-slate-700'"
          @click="activeTab = tab.id as any"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Content -->
      <div class="card p-6">
        <WidgetAppearanceTab
          v-if="activeTab === 'appearance'"
          v-model="localSettings.branding"
        />
        <WidgetPreChatTab
          v-else-if="activeTab === 'prechat'"
          v-model="localSettings.pre_chat"
        />
        <WidgetPostChatTab
          v-else-if="activeTab === 'postchat'"
          v-model="localSettings.post_chat"
        />
        <WidgetInstallationTab
          v-else-if="activeTab === 'install'"
          :channel-id="widget.id"
        />
      </div>

      <!-- Dirty warning floating -->
      <div
        v-if="isDirty"
        class="fixed bottom-5 right-5 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 z-30"
      >
        ⚠️ Tienes cambios sin guardar
      </div>
    </template>

    <!-- Help Panel -->
    <WidgetConfigHelpPanel v-model="helpOpen" />
  </div>
</template>
