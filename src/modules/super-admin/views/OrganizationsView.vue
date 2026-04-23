<!-- Ruta: /src/modules/super-admin/views/OrganizationsView.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Vista principal del super admin para gestionar organizaciones.
     Sprint 5 · Bloque 6.

     Features:
       - Lista de todas las empresas con métricas
       - Filtro por nombre/subdomain
       - Botón "Nueva empresa" → abre wizard
       - Activar/desactivar empresas
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { SupabaseOrganizationsRepo } from '@/repository/supabase/organizations.repo'
import OrganizationCard from '../components/OrganizationCard.vue'
import CreateOrganizationWizard from '../components/CreateOrganizationWizard.vue'
import type {
  OrganizationWithStats,
  CreateOrganizationResult
} from '@/types/organization.types'

const repo = new SupabaseOrganizationsRepo()

// ── STATE ─────────────────────────────────────────────────
const orgs = ref<OrganizationWithStats[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const showWizard = ref(false)
const showInactive = ref(false)

// ── LOAD ──────────────────────────────────────────────────
async function loadOrgs() {
  loading.value = true
  error.value = null
  try {
    orgs.value = await repo.listAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error cargando organizaciones'
  } finally {
    loading.value = false
  }
}

// ── COMPUTED ──────────────────────────────────────────────
const filteredOrgs = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return orgs.value.filter(o => {
    // Filtro por estado
    if (!showInactive.value && !o.active) return false
    // Filtro por búsqueda
    if (!q) return true
    return (
      o.name.toLowerCase().includes(q) ||
      (o.subdomain?.toLowerCase().includes(q) ?? false) ||
      o.slug.toLowerCase().includes(q)
    )
  })
})

const stats = computed(() => ({
  total: orgs.value.length,
  active: orgs.value.filter(o => o.active).length,
  inactive: orgs.value.filter(o => !o.active).length,
  totalUsers: orgs.value.reduce((sum, o) => sum + o.userCount, 0),
  totalConversations: orgs.value.reduce((sum, o) => sum + o.conversationCount, 0)
}))

// ── ACTIONS ───────────────────────────────────────────────
async function toggleActive(org: OrganizationWithStats) {
  const action = org.active ? 'desactivar' : 'activar'
  const confirmed = confirm(
    `¿Seguro que quieres ${action} "${org.name}"?` +
    (org.active ? '\n\nLos usuarios no podrán acceder al panel mientras esté desactivada.' : '')
  )
  if (!confirmed) return

  try {
    await repo.setActive(org.id, !org.active)
    await loadOrgs()
  } catch (e) {
    alert('Error: ' + (e instanceof Error ? e.message : String(e)))
  }
}

function onOrgCreated(_result: CreateOrganizationResult) {
  // Al crearse, recargar la lista. El wizard se cierra solo al "Listo".
  loadOrgs()
}

onMounted(loadOrgs)
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Organizaciones</h1>
        <p class="text-sm text-slate-500 mt-1">
          Gestiona todas las empresas clientes de LORA
        </p>
      </div>

      <button
        class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        @click="showWizard = true"
      >
        <span class="text-base leading-none">+</span>
        Nueva empresa
      </button>
    </div>

    <!-- Estadísticas rápidas -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="bg-white border border-surface-border rounded-xl p-4">
        <div class="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total</div>
        <div class="text-2xl font-bold text-slate-900 mt-1">{{ stats.total }}</div>
      </div>
      <div class="bg-white border border-surface-border rounded-xl p-4">
        <div class="text-xs text-slate-500 uppercase tracking-wide font-semibold">Activas</div>
        <div class="text-2xl font-bold text-emerald-600 mt-1">{{ stats.active }}</div>
      </div>
      <div class="bg-white border border-surface-border rounded-xl p-4">
        <div class="text-xs text-slate-500 uppercase tracking-wide font-semibold">Usuarios</div>
        <div class="text-2xl font-bold text-slate-900 mt-1">{{ stats.totalUsers }}</div>
      </div>
      <div class="bg-white border border-surface-border rounded-xl p-4">
        <div class="text-xs text-slate-500 uppercase tracking-wide font-semibold">Conversaciones</div>
        <div class="text-2xl font-bold text-slate-900 mt-1">{{ stats.totalConversations }}</div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="flex flex-col md:flex-row gap-3 mb-4">
      <div class="relative flex-1">
        <input
          v-model="searchQuery"
          type="text"
          class="w-full border border-surface-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          placeholder="Buscar por nombre o subdomain..."
        />
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
      </div>
      <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
        <input type="checkbox" v-model="showInactive" class="rounded border-surface-border" />
        Mostrar desactivadas
      </label>
    </div>

    <!-- Lista de orgs -->
    <div v-if="loading" class="py-12 text-center text-slate-400 text-sm">
      Cargando organizaciones...
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
      {{ error }}
      <button class="ml-2 underline" @click="loadOrgs">Reintentar</button>
    </div>

    <div v-else-if="filteredOrgs.length === 0" class="py-12 text-center">
      <div class="text-5xl mb-3">🏢</div>
      <div class="text-sm font-medium text-slate-700">
        {{ orgs.length === 0 ? 'No hay organizaciones todavía' : 'Sin resultados' }}
      </div>
      <p class="text-xs text-slate-500 mt-1">
        {{ orgs.length === 0
          ? 'Crea la primera empresa para empezar'
          : 'Prueba con otro término de búsqueda' }}
      </p>
      <button
        v-if="orgs.length === 0"
        class="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm"
        @click="showWizard = true"
      >
        + Crear primera empresa
      </button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <OrganizationCard
        v-for="org in filteredOrgs"
        :key="org.id"
        :org="org"
        @toggle-active="toggleActive"
      />
    </div>

    <!-- Wizard modal -->
    <CreateOrganizationWizard
      v-if="showWizard"
      @close="showWizard = false"
      @created="onOrgCreated"
    />
  </div>
</template>
