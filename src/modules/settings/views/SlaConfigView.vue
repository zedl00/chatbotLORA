<!-- Ruta: /src/modules/settings/views/SlaConfigView.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 9 · Configuración de SLA por tenant.
     Acceso: permiso sla_config.read (ver) / sla_config.update (editar)
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { useCan } from '@/composables/useCan'
import { useUiStore } from '@/stores/ui.store'
import { SupabaseSlaConfigRepo } from '@/repository/supabase/sla-config.repo'
import type { SlaConfig } from '@/types/supervisor.types'

const activeOrgId = useActiveOrganizationId()
const { can } = useCan()
const ui = useUiStore()
const repo = new SupabaseSlaConfigRepo()

const config = ref<SlaConfig | null>(null)
const loading = ref(false)
const saving = ref(false)

const form = ref({
  firstResponseMinutes: 5,
  notifySupervisors: true,
  enabled: true
})

const canEdit = can('sla_config.update')

async function load() {
  if (!activeOrgId.value) return
  loading.value = true
  try {
    const c = await repo.getByOrganization(activeOrgId.value)
    if (c) {
      config.value = c
      form.value = {
        firstResponseMinutes: c.firstResponseMinutes,
        notifySupervisors: c.notifySupervisors,
        enabled: c.enabled
      }
    } else {
      // Usar defaults si no existe
      form.value = {
        firstResponseMinutes: 5,
        notifySupervisors: true,
        enabled: true
      }
    }
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error cargando configuración')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!canEdit) {
    ui.showToast('error', 'No tienes permiso para editar la configuración')
    return
  }
  if (!activeOrgId.value) return

  if (form.value.firstResponseMinutes < 1 || form.value.firstResponseMinutes > 1440) {
    ui.showToast('error', 'El SLA debe estar entre 1 y 1440 minutos (24 horas)')
    return
  }

  saving.value = true
  try {
    const updated = await repo.upsert(activeOrgId.value, {
      firstResponseMinutes: form.value.firstResponseMinutes,
      notifySupervisors: form.value.notifySupervisors,
      enabled: form.value.enabled
    })
    config.value = updated
    ui.showToast('success', 'Configuración guardada')
  } catch (e: any) {
    ui.showToast('error', e?.message ?? 'Error al guardar')
  } finally {
    saving.value = false
  }
}

watch(activeOrgId, load, { immediate: false })
onMounted(load)
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold">Configuración de SLA</h2>
      <p class="text-slate-500 text-sm mt-1">
        Define los tiempos de respuesta esperados del equipo y las alertas automáticas.
      </p>
    </div>

    <div v-if="loading" class="card p-8 text-center text-slate-400 text-sm">
      Cargando configuración...
    </div>

    <div v-else class="card p-6 space-y-5">
      <!-- Enable toggle -->
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <h3 class="font-semibold text-slate-800">Monitoreo de SLA activo</h3>
          <p class="text-xs text-slate-500 mt-0.5">
            Si está apagado, no se detectarán breaches ni se crearán alertas automáticas.
          </p>
        </div>
        <button
          class="w-11 h-6 rounded-full transition-colors flex-shrink-0"
          :class="form.enabled ? 'bg-brand-600' : 'bg-slate-300'"
          :disabled="!canEdit"
          @click="form.enabled = !form.enabled"
        >
          <div
            class="w-5 h-5 bg-white rounded-full transition-all"
            :class="form.enabled ? 'ml-[22px]' : 'ml-0.5'"
          />
        </button>
      </div>

      <div class="border-t border-surface-border" />

      <!-- First response SLA -->
      <div>
        <label class="block font-semibold text-slate-800 mb-1">
          SLA de primera respuesta
        </label>
        <p class="text-xs text-slate-500 mb-2">
          Tiempo máximo que un agente tiene para responder tras el handoff del bot.
          Si se vence, se crea una alerta para los supervisores.
        </p>
        <div class="flex items-center gap-2">
          <input
            v-model.number="form.firstResponseMinutes"
            type="number"
            min="1"
            max="1440"
            class="input w-28"
            :disabled="!canEdit"
          />
          <span class="text-sm text-slate-600">minutos</span>
        </div>
        <p class="text-xs text-slate-400 mt-2">
          Estándar industria: 5 min para chat en vivo, 15-30 min para soporte B2B, 1-4 horas para correo.
        </p>
      </div>

      <div class="border-t border-surface-border" />

      <!-- Notify supervisors -->
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <h3 class="font-semibold text-slate-800">Notificar a supervisores</h3>
          <p class="text-xs text-slate-500 mt-0.5">
            Cuando se vence un SLA, supervisores y admins verán un badge en el header y un banner en la conversación.
          </p>
        </div>
        <button
          class="w-11 h-6 rounded-full transition-colors flex-shrink-0"
          :class="form.notifySupervisors ? 'bg-brand-600' : 'bg-slate-300'"
          :disabled="!canEdit"
          @click="form.notifySupervisors = !form.notifySupervisors"
        >
          <div
            class="w-5 h-5 bg-white rounded-full transition-all"
            :class="form.notifySupervisors ? 'ml-[22px]' : 'ml-0.5'"
          />
        </button>
      </div>

      <!-- Footer -->
      <div class="pt-4 border-t border-surface-border flex justify-end">
        <button
          v-if="canEdit"
          class="btn-primary"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Guardando...' : 'Guardar cambios' }}
        </button>
        <p v-else class="text-sm text-slate-400">
          Solo administradores pueden cambiar esta configuración.
        </p>
      </div>
    </div>

    <!-- Info box -->
    <div class="card p-4 bg-blue-50 border-blue-200">
      <h4 class="text-sm font-semibold text-blue-900 mb-1">ℹ️ ¿Cómo funciona?</h4>
      <ul class="text-xs text-blue-800 space-y-1 list-disc pl-4">
        <li>Cuando el bot pasa la conversación a un humano (handoff), se activa el contador de SLA.</li>
        <li>Si el agente no envía ningún mensaje dentro del tiempo configurado, se crea una alerta.</li>
        <li>La alerta aparece en el badge 🚨 del header (solo para supervisores y admins).</li>
        <li>Al ver la conversación, aparece un banner rojo arriba.</li>
        <li>En cuanto el agente responde, la alerta se resuelve automáticamente.</li>
        <li>Un supervisor puede también tomar el control (🦸) o reasignar la conversación (🔄).</li>
      </ul>
    </div>
  </div>
</template>
