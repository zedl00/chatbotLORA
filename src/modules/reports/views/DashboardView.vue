<!-- Ruta: /src/modules/reports/views/DashboardView.vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { useCan } from '@/composables/useCan'
import { SupabaseAiRepo } from '@/repository/supabase/ai.repo'
import type { AiMonthlyUsage } from '@/types/ai.types'

const auth = useAuthStore()
const activeOrgId = useActiveOrganizationId()
const { can } = useCan()
const repo = new SupabaseAiRepo()

const usage = ref<AiMonthlyUsage | null>(null)
const tokenLimit = ref<number | null>(null)
const loading = ref(false)

async function load() {
  if (!activeOrgId.value) return
  loading.value = true
  try {
    usage.value = await repo.getMonthlyUsage(activeOrgId.value)
  } finally {
    loading.value = false
  }
}

const usagePercent = computed(() => {
  if (!usage.value || !tokenLimit.value) return 0
  return Math.min(100, Math.round((usage.value.totalTokens / tokenLimit.value) * 100))
})

const usageColor = computed(() => {
  if (usagePercent.value >= 90) return 'bg-red-500'
  if (usagePercent.value >= 75) return 'bg-amber-500'
  return 'bg-brand-500'
})

onMounted(load)
</script>

<template>
  <div class="p-6 space-y-6">
    <div>
      <h2 class="text-2xl font-bold">Dashboard</h2>
      <p class="text-slate-500">Bienvenido, {{ auth.user?.fullName || auth.user?.email }}.</p>
    </div>

    <!-- KPIs operativos (placeholders por ahora) -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card p-5">
        <div class="text-sm text-slate-500">Conversaciones activas</div>
        <div class="text-3xl font-bold mt-1 text-slate-400">—</div>
        <div class="text-xs text-slate-400 mt-1">Pendiente Sprint 4</div>
      </div>
      <div class="card p-5">
        <div class="text-sm text-slate-500">Agentes en línea</div>
        <div class="text-3xl font-bold mt-1 text-slate-400">—</div>
        <div class="text-xs text-slate-400 mt-1">Pendiente Sprint 4</div>
      </div>
      <div class="card p-5">
        <div class="text-sm text-slate-500">CSAT promedio</div>
        <div class="text-3xl font-bold mt-1 text-slate-400">—</div>
        <div class="text-xs text-slate-400 mt-1">Pendiente Sprint 5</div>
      </div>
      <div class="card p-5">
        <div class="text-sm text-slate-500">Respuestas del bot</div>
        <div class="text-3xl font-bold mt-1">
          {{ loading ? '...' : (usage?.chatCount ?? 0).toLocaleString() }}
        </div>
        <div class="text-xs text-slate-400 mt-1">Este mes</div>
      </div>
    </div>

    <!-- Sección IA -->
    <div v-if="can('ai.view_costs') || can('reports.view_costs')" class="space-y-4">
      <h3 class="text-lg font-semibold">🤖 Consumo de IA (mes actual)</h3>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="card p-5">
          <div class="text-sm text-slate-500">Tokens consumidos</div>
          <div class="text-3xl font-bold mt-1">
            {{ loading ? '...' : (usage?.totalTokens ?? 0).toLocaleString() }}
          </div>
          <div v-if="tokenLimit" class="mt-3 space-y-1">
            <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                class="h-full transition-all"
                :class="usageColor"
                :style="{ width: `${usagePercent}%` }"
              />
            </div>
            <div class="text-xs text-slate-500">
              {{ usagePercent }}% del límite mensual ({{ tokenLimit.toLocaleString() }})
            </div>
          </div>
        </div>

        <div class="card p-5">
          <div class="text-sm text-slate-500">Costo estimado</div>
          <div class="text-3xl font-bold mt-1">
            ${{ loading ? '...' : (usage?.totalCostUsd ?? 0).toFixed(2) }}
          </div>
          <div class="text-xs text-slate-500 mt-1">USD · acumulado del mes</div>
        </div>

        <div class="card p-5">
          <div class="text-sm text-slate-500">Llamadas totales</div>
          <div class="text-3xl font-bold mt-1">
            {{ loading ? '...' : (usage?.callCount ?? 0).toLocaleString() }}
          </div>
          <div v-if="usage && usage.errorCount > 0" class="text-xs text-red-600 mt-1">
            ⚠️ {{ usage.errorCount }} con error
          </div>
          <div v-else class="text-xs text-emerald-600 mt-1">✓ Sin errores</div>
        </div>
      </div>
    </div>

    <div class="card p-4 bg-brand-50/50 border border-brand-200 text-sm">
      <strong>💡 Tip:</strong> Puedes probar el bot en
      <RouterLink to="/admin/playground" class="text-brand-700 underline font-medium">Playground</RouterLink>
      sin necesidad de canales reales conectados.
    </div>
  </div>
</template>
