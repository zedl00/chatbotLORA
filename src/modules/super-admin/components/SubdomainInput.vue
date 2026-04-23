<!-- Ruta: /src/modules/super-admin/components/SubdomainInput.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Input de subdomain con validación en vivo contra la DB.
     Usa debounce de 400ms para no saturar la API.
     Muestra estado visual: checking / available / taken / reserved / invalid.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SupabaseOrganizationsRepo } from '@/repository/supabase/organizations.repo'
import type { SubdomainValidation } from '@/types/organization.types'

interface Props {
  modelValue: string
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'validation', v: SubdomainValidation): void
}>()

const repo = new SupabaseOrganizationsRepo()
const validation = ref<SubdomainValidation>({ status: 'idle', message: '' })
const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const statusColor = computed(() => {
  switch (validation.value.status) {
    case 'available': return 'text-emerald-600'
    case 'taken':
    case 'reserved':
    case 'invalid': return 'text-red-600'
    case 'checking': return 'text-slate-500'
    default: return 'text-slate-400'
  }
})

const statusIcon = computed(() => {
  switch (validation.value.status) {
    case 'available': return '✓'
    case 'taken':
    case 'reserved':
    case 'invalid': return '✕'
    case 'checking': return '⋯'
    default: return ''
  }
})

const borderClass = computed(() => {
  switch (validation.value.status) {
    case 'available': return 'border-emerald-400 ring-1 ring-emerald-300'
    case 'taken':
    case 'reserved':
    case 'invalid': return 'border-red-400 ring-1 ring-red-300'
    default: return 'border-surface-border focus:border-brand-500'
  }
})

function handleInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  // Auto-lowercase y quitar caracteres no permitidos en tiempo real
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9-]/g, '')
  emit('update:modelValue', cleaned)
}

// Validar cuando cambia el valor (debounced)
watch(() => props.modelValue, (value) => {
  if (debounceTimer.value) clearTimeout(debounceTimer.value)

  if (!value || !value.trim()) {
    validation.value = { status: 'idle', message: '' }
    emit('validation', validation.value)
    return
  }

  validation.value = { status: 'checking', message: 'Verificando...' }
  emit('validation', validation.value)

  debounceTimer.value = setTimeout(async () => {
    try {
      const result = await repo.validateSubdomain(value)
      validation.value = result
      emit('validation', result)
    } catch (e) {
      validation.value = {
        status: 'invalid',
        message: e instanceof Error ? e.message : 'Error al validar'
      }
      emit('validation', validation.value)
    }
  }, 400)
}, { immediate: true })
</script>

<template>
  <div class="space-y-2">
    <label class="block text-sm font-medium text-slate-700">
      Subdomain
    </label>

    <div class="flex items-stretch rounded-lg overflow-hidden border transition-colors"
         :class="borderClass">
      <input
        :value="modelValue"
        type="text"
        class="flex-1 px-3 py-2 text-sm outline-none bg-white"
        placeholder="empresa"
        maxlength="63"
        autocomplete="off"
        spellcheck="false"
        @input="handleInput"
      />
      <div class="flex items-center px-3 bg-slate-50 text-sm text-slate-500 font-mono border-l border-surface-border">
        .lorachat.net
      </div>
    </div>

    <!-- Estado de validación -->
    <div v-if="validation.status !== 'idle'"
         class="flex items-center gap-1.5 text-xs transition-all"
         :class="statusColor">
      <span class="font-bold">{{ statusIcon }}</span>
      <span>{{ validation.message }}</span>
    </div>

    <!-- Preview de URL (solo cuando está disponible) -->
    <div v-if="validation.status === 'available' && modelValue"
         class="text-xs text-slate-500 pt-1">
      URL: <code class="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700">
        https://{{ modelValue }}.lorachat.net
      </code>
    </div>
  </div>
</template>
