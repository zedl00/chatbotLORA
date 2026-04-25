<!-- Ruta: /src/modules/super-admin/views/SystemConfigView.vue -->
<!-- 🆕 Sprint 11.6 (corregido: tipo explícito en filter) -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSystemConfigStore } from '@/stores/system-config.store'
import { useUiStore } from '@/stores/ui.store'
import { CATEGORY_METADATA } from '@/types/system-config.types'
import type { ConfigCategory, SystemConfigItem } from '@/types/system-config.types'
import ConfigItemEditor from '../components/ConfigItemEditor.vue'
import SystemConfigHelpPanel from '../components/help/SystemConfigHelpPanel.vue'

const store = useSystemConfigStore()
const ui = useUiStore()

const helpOpen = ref(false)
const selectedCategory = ref<ConfigCategory | 'all'>('all')

async function load() {
  await store.loadAll()
}

async function handleSave(key: string, value: any) {
  try {
    await store.updateValue(key, value)
    ui.showToast('success', `"${key}" actualizado`)
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error al guardar')
  }
}

async function handleReset(key: string) {
  try {
    await store.resetToDefault(key)
    ui.showToast('success', `"${key}" restaurado al valor por defecto`)
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error al restaurar')
  }
}

// Filtros — tipo explícito en parámetro para evitar TS7006
const filteredItems = computed<SystemConfigItem[]>(() => {
  if (selectedCategory.value === 'all') return store.allItems
  return store.allItems.filter((item: SystemConfigItem) => item.category === selectedCategory.value)
})

// Stats por categoría
const categoryStats = computed(() => {
  const stats = new Map<string, number>()
  for (const item of store.allItems) {
    stats.set(item.category, (stats.get(item.category) ?? 0) + 1)
  }
  return stats
})

// Categorías visibles (solo las que tienen items)
const availableCategories = computed<ConfigCategory[]>(() => {
  return Array.from(categoryStats.value.keys()) as ConfigCategory[]
})

onMounted(load)
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <!-- Header -->
    <div class="flex items-start justify-between flex-wrap gap-3 mb-5">
      <div>
        <h2 class="text-2xl font-bold flex items-center gap-2">
          🔧 Configuración del Sistema
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 font-semibold uppercase tracking-wide">
            Super Admin
          </span>
        </h2>
        <p class="text-sm text-slate-500 mt-1">
          Parámetros globales de LORA. Los cambios se aplican en tiempo real a todos los tenants.
        </p>
      </div>
      <div class="flex gap-2">
        <button
          class="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
          @click="helpOpen = true"
        >
          💡 Guía
        </button>
        <button
          class="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
          @click="load"
          :disabled="store.loading"
        >
          🔄 Recargar
        </button>
      </div>
    </div>

    <!-- Warning -->
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex gap-3">
      <span class="text-xl">⚠️</span>
      <div class="text-xs text-amber-900 leading-relaxed">
        <strong>Cambios con impacto global.</strong> Modificar estos valores afecta a TODOS los tenants (empresas clientes) y al widget embebido en sus sitios.
        Prueba en producción antes de desplegar cambios mayores.
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading && store.allItems.length === 0" class="text-center py-16 text-slate-400">
      Cargando configuración...
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
      ❌ {{ store.error }}
    </div>

    <template v-else>
      <!-- Tabs de categoría -->
      <div class="flex gap-1 p-1 bg-slate-100 rounded-lg mb-5 overflow-x-auto">
        <button
          class="px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap"
          :class="selectedCategory === 'all'
            ? 'bg-white text-slate-800 font-medium shadow-sm'
            : 'text-slate-500 hover:text-slate-800'"
          @click="selectedCategory = 'all'"
        >
          Todas ({{ store.allItems.length }})
        </button>
        <button
          v-for="cat in availableCategories"
          :key="cat"
          class="px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap"
          :class="selectedCategory === cat
            ? 'bg-white text-slate-800 font-medium shadow-sm'
            : 'text-slate-500 hover:text-slate-800'"
          @click="selectedCategory = cat"
        >
          {{ CATEGORY_METADATA[cat].icon }} {{ CATEGORY_METADATA[cat].label }} ({{ categoryStats.get(cat) }})
        </button>
      </div>

      <!-- Descripción de categoría -->
      <div
        v-if="selectedCategory !== 'all'"
        class="mb-4 px-3 py-2 text-xs text-slate-600 bg-slate-50 rounded-lg border border-surface-border"
      >
        {{ CATEGORY_METADATA[selectedCategory as ConfigCategory].description }}
      </div>

      <!-- Lista de configs -->
      <div class="space-y-3">
        <ConfigItemEditor
          v-for="item in filteredItems"
          :key="item.key"
          :item="item"
          @save="handleSave"
          @reset="handleReset"
        />
      </div>

      <div
        v-if="filteredItems.length === 0"
        class="text-center py-12 text-slate-400 text-sm"
      >
        Sin configuraciones en esta categoría.
      </div>
    </template>

    <!-- Help panel -->
    <SystemConfigHelpPanel v-model="helpOpen" />
  </div>
</template>
