<!-- Ruta: /src/modules/agents/views/AuditLogView.vue -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { SupabaseRbacRepo } from '@/repository/supabase/rbac.repo'
import type { PermissionAuditEntry } from '@/types/rbac.types'
import { formatDateFull, timeAgo } from '@/utils/format'

const activeOrgId = useActiveOrganizationId()
const repo = new SupabaseRbacRepo()

const entries = ref<PermissionAuditEntry[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(0)
const pageSize = 50

const filterAction = ref<string>('')
const filterTargetEmail = ref('')
const selectedEntry = ref<PermissionAuditEntry | null>(null)

const actionOptions = [
  { value: '',                   label: 'Todas las acciones' },
  { value: 'role.granted',       label: '✅ Rol otorgado' },
  { value: 'role.revoked',       label: '❌ Rol revocado' },
  { value: 'permission.granted', label: '✅ Permiso otorgado directamente' },
  { value: 'permission.denied',  label: '🚫 Permiso denegado directamente' },
  { value: 'permission.removed', label: '↩️ Override de permiso eliminado' }
]

async function load() {
  if (!activeOrgId.value) return
  loading.value = true
  try {
    const result = await repo.listAuditLog({
      organizationId: activeOrgId.value,
      action: filterAction.value || undefined,
      limit: pageSize,
      offset: page.value * pageSize
    })
    entries.value = result.data
    total.value = result.count
  } finally {
    loading.value = false
  }
}

const filteredEntries = computed(() => {
  if (!filterTargetEmail.value) return entries.value
  const q = filterTargetEmail.value.toLowerCase()
  return entries.value.filter((e) =>
    e.targetEmail?.toLowerCase().includes(q) ||
    e.actorEmail?.toLowerCase().includes(q)
  )
})

const totalPages = computed(() => Math.ceil(total.value / pageSize))

function actionMeta(action: string): { icon: string; color: string; label: string } {
  const map: Record<string, { icon: string; color: string; label: string }> = {
    'role.granted':       { icon: '✅', color: 'text-emerald-600', label: 'Rol otorgado' },
    'role.revoked':       { icon: '❌', color: 'text-red-600',     label: 'Rol revocado' },
    'permission.granted': { icon: '✅', color: 'text-emerald-600', label: 'Permiso otorgado' },
    'permission.denied':  { icon: '🚫', color: 'text-amber-600',   label: 'Permiso denegado' },
    'permission.removed': { icon: '↩️', color: 'text-slate-600',   label: 'Override eliminado' }
  }
  return map[action] ?? { icon: '📝', color: 'text-slate-600', label: action }
}

watch([filterAction, page], load)

onMounted(load)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-start justify-between">
      <div>
        <h2 class="text-2xl font-bold">Auditoría de Permisos</h2>
        <p class="text-slate-500 mt-1">
          Registro inmutable de cambios en roles y permisos.
          <span class="text-xs">({{ total }} eventos)</span>
        </p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Tipo de acción</label>
        <select v-model="filterAction" class="input">
          <option v-for="opt in actionOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Buscar por email (actor o target)</label>
        <input v-model="filterTargetEmail" class="input" placeholder="usuario@empresa.com" />
      </div>
    </div>

    <!-- Timeline -->
    <div class="card overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-slate-400">Cargando...</div>
      <div v-else-if="filteredEntries.length === 0" class="p-8 text-center text-slate-400">
        Sin eventos de auditoría.
      </div>
      <div v-else class="divide-y divide-surface-border">
        <button
          v-for="e in filteredEntries"
          :key="e.id"
          class="w-full text-left px-4 py-3 hover:bg-surface-muted/50 transition-colors flex items-start gap-3"
          @click="selectedEntry = e"
        >
          <span class="text-xl shrink-0 mt-0.5">{{ actionMeta(e.action).icon }}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2 flex-wrap">
              <span class="font-medium" :class="actionMeta(e.action).color">
                {{ actionMeta(e.action).label }}
              </span>
              <span class="text-xs text-slate-400">· {{ timeAgo(e.createdAt) }}</span>
            </div>
            <div class="text-sm text-slate-700 mt-0.5">
              <span class="font-medium">{{ e.actorEmail ?? 'Sistema' }}</span>
              <span class="text-slate-500"> modificó </span>
              <span class="font-medium">{{ e.targetEmail ?? '—' }}</span>
              <template v-if="e.entityName">
                <span class="text-slate-500"> → </span>
                <code class="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{{ e.entityName }}</code>
              </template>
            </div>
          </div>
          <span class="text-slate-300 text-xs shrink-0">Ver detalle →</span>
        </button>
      </div>
    </div>

    <!-- Paginación -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2">
      <button
        class="btn-secondary text-xs"
        :disabled="page === 0"
        @click="page = Math.max(0, page - 1)"
      >← Anterior</button>
      <span class="text-sm text-slate-600">Página {{ page + 1 }} de {{ totalPages }}</span>
      <button
        class="btn-secondary text-xs"
        :disabled="page >= totalPages - 1"
        @click="page = Math.min(totalPages - 1, page + 1)"
      >Siguiente →</button>
    </div>

    <!-- Modal detalle -->
    <div
      v-if="selectedEntry"
      class="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4"
      @click.self="selectedEntry = null"
    >
      <div class="bg-white rounded-2xl shadow-pop max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-auto">
        <div class="flex items-start justify-between sticky top-0 bg-white pb-2">
          <div>
            <h3 class="text-lg font-bold flex items-center gap-2">
              <span>{{ actionMeta(selectedEntry.action).icon }}</span>
              {{ actionMeta(selectedEntry.action).label }}
            </h3>
            <p class="text-slate-500 text-sm">{{ formatDateFull(selectedEntry.createdAt) }}</p>
          </div>
          <button
            class="text-slate-400 hover:text-slate-600 text-xl"
            @click="selectedEntry = null"
          >✕</button>
        </div>

        <dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
          <dt class="font-medium text-slate-600">Actor:</dt>
          <dd class="font-mono">{{ selectedEntry.actorEmail ?? 'Sistema' }}</dd>

          <dt class="font-medium text-slate-600">Target:</dt>
          <dd class="font-mono">{{ selectedEntry.targetEmail ?? '—' }}</dd>

          <dt class="font-medium text-slate-600">Tabla:</dt>
          <dd><code class="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{{ selectedEntry.entityType }}</code></dd>

          <dt class="font-medium text-slate-600">Entidad:</dt>
          <dd>{{ selectedEntry.entityName ?? '—' }}</dd>

          <template v-if="selectedEntry.reason">
            <dt class="font-medium text-slate-600">Razón:</dt>
            <dd>{{ selectedEntry.reason }}</dd>
          </template>
        </dl>

        <details v-if="selectedEntry.afterState" class="mt-4">
          <summary class="cursor-pointer text-sm font-medium">Estado (JSON)</summary>
          <pre class="bg-slate-50 text-xs p-3 rounded-lg mt-2 overflow-auto">{{ JSON.stringify(selectedEntry.afterState, null, 2) }}</pre>
        </details>

        <details v-if="selectedEntry.beforeState" class="mt-2">
          <summary class="cursor-pointer text-sm font-medium">Estado anterior (JSON)</summary>
          <pre class="bg-slate-50 text-xs p-3 rounded-lg mt-2 overflow-auto">{{ JSON.stringify(selectedEntry.beforeState, null, 2) }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>
